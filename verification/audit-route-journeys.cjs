// 실제 화면과 같은 영업 판정 및 기본 동선으로 대표 사용자 조건을 비교한다.
// 실행: node audit-route-journeys.cjs (외부 API 호출 없음)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const engine = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/route-engine.js'),'utf8')+';module.exports', {module:{exports:{}}});
const places = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/places.json'), 'utf8')).places;
const station = {id:'station', name:'목포역', lat:34.7914, lon:126.3859};
const byId = id => id === 'station' ? station : places.find(p => p.id === id);
// 앱의 실제 evaluate 함수를 읽어 검사에 재사용한다. 브라우저 조작은 별도로 수행한다.
const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const evaluateSource = source.slice(source.indexOf('  function evaluate('), source.indexOf('  function pillFor('));
assert(evaluateSource.includes('function evaluate'), '앱의 영업 판정 함수 추출 실패');
const evaluate = vm.runInNewContext(evaluateSource + '\nevaluate;', {
  routeEngine: engine, entryPlace: entry => byId(entry.placeId),
  toMin: value => {const [h,m] = String(value || '09:00').split(':').map(Number); return h*60+m;},
  dateAt: (base,minute) => {const d = new Date(base+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+Math.floor(minute/1440)); return d.toISOString().slice(0,10);},
  weekday: date => new Date(date+'T12:00:00Z').getUTCDay()
});
const validate = (p,minute,duration,date) => evaluate({placeId:p.id,duration},minute,date);
const clock = minute => String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
const cases = [
  ['목포역 왕복','station','station'],
  ['역사관1관→역','p8','station'],
  ['역→역사관2관','station','p9'],
  ['역사관1관→스카이워크','p8','p19'],
  ['역사관1관→스카이워크 자정','p8','p19',{end:'24:00'}],
  ['스카이워크→역사관1관','p19','p8'],
  ['역→스카이워크','station','p19'],
  ['갓바위→평화광장','p7','p14'],
  ['평화광장→갓바위','p14','p7'],
  ['평화광장 왕복','p14','p14'],
  ['자연사박물관→평화광장','p16','p14'],
  ['스카이워크 왕복','p19','p19'],
  ['북항승강장 왕복','p3','p3'],
  ['고하도 전망대 왕복','p6','p6'],
  ['역→평화광장','station','p14'],
  ['역사관1관→노적봉 근거리','p8','p2'],
  ['역 왕복 오후 3시간','station','station',{start:'15:00',end:'18:00'}],
  ['역 왕복 저녁','station','station',{start:'18:00',end:'22:00'}],
  ['평화광장 왕복 자연사 필수','p14','p14',{requiredPlaceId:'p16'}],
  ['역 왕복 평화광장 필수','station','station',{requiredPlaceId:'p14'}],
  ['역 왕복 평화광장 선택','station','station',{preferredPlaceId:'p14'}]
];
const summaries = [];
const violations = [];
function check(route,input) {
  const errors=[];
  const ids=route.rows.map(r=>r.placeId);
  if(new Set(ids).size !== ids.length) errors.push('방문 장소 중복');
  if(route.endArrival>route.end) errors.push('도착 시각 초과');
  if(route.walkMeters>8000) errors.push('하루 8km 초과');
  if(input.requiredPlaceId && !ids.includes(input.requiredPlaceId) && ![input.origin.id,input.destination.id].includes(input.requiredPlaceId)) errors.push('필수 장소 누락');
  let previousEnd=route.start;
  for(const row of route.rows) {
    if(row.minute<previousEnd+row.walkEstimate) errors.push('이동·체류 시각 겹침');
    if(row.walkMeters>1600 || row.walkEstimate>30) errors.push('한 구간 도보 상한 초과');
    if(row.result.kind==='bad' || row.result.kind==='warn' && /체류 중 브레이크|폐관을 넘/.test(row.result.title)) errors.push('영업시간 위반');
    previousEnd=row.minute+row.duration;
  }
  if(route.endWalk.meters>1600 || route.endWalk.minutes>30 || route.endArrival<previousEnd+route.endWalk.minutes) errors.push('마지막 이동 조건 위반');
  if(route.walkMeters !== route.rows.reduce((sum,r)=>sum+r.walkMeters,0)+route.endWalk.meters) errors.push('도보 합계 불일치');
  return errors;
}
(async()=>{
  for(const [name,originId,destinationId,extra={}] of cases) {
    for(const routeFocus of ['through','start','end']) {
      const input={places,origin:byId(originId),destination:byId(destinationId),start:'10:00',end:'18:00',date:'2026-10-04',theme:'balanced',mealTimes:[],routeFocus,routeProvider:null,validate,...extra};
      const routes=await engine.generateAdaptive(input);
      const detail=routes.map(route=>{
        const errors=check(route,input);
        errors.forEach(error=>violations.push({name,routeFocus,title:route.title,error}));
        let previous=input.origin;
        const rows=route.rows.map(row=>{const p=byId(row.placeId);const item={name:p.name,id:p.id,arrival:clock(row.minute),departure:clock(row.minute+row.duration),walkMeters:row.walkMeters,walkMinutes:row.walkEstimate,directKm:+engine.distanceKm(previous,p).toFixed(3),distanceToDestinationKm:+engine.distanceKm(p,input.destination).toFixed(3)};previous=p;return item;});
        let lunchPlaces=null;
        if(routeFocus==='through' && name==='역사관1관→스카이워크 자정') {
          lunchPlaces=[...engine.mealChoices({route,places,origin:input.origin,destination:input.destination,date:input.date,validate,kind:'meal'}),...engine.mealChoices({route,places,origin:input.origin,destination:input.destination,date:input.date,validate,kind:'cafe'})].filter(c=>c.slots.some(s=>s.minute>=660 && s.minute<960)).length;
        }
        return {title:route.title,visits:rows.length,walkKm:route.walkMeters/1000,arrival:clock(route.endArrival),lunchPlaces,errors,rows};
      });
      summaries.push({name,origin:input.origin.name,destination:input.destination.name,start:input.start,end:input.end,routeFocus,count:routes.length,routes:detail});
    }
  }
  const mealInput={places,origin:station,destination:byId('p9'),start:'10:00',end:'18:00',date:'2026-10-04',theme:'balanced',routeFocus:'through',validate,routeProvider:null};
  // 최초 오류를 발견했던 기존 순서를 유지해 같은 회귀 조건을 검사한다.
  const mealBase=(await engine.generate(mealInput))[0];
  const lunch=engine.mealChoices({...mealInput,route:mealBase,kind:'meal'}).find(c=>c.placeName==='대명춘').slots.find(s=>s.minute===760);
  const withLunch=engine.addMeal(mealBase,lunch);
  const breakfastChoices=engine.mealChoices({...mealInput,route:withLunch,kind:'cafe'});
  const cafe=breakfastChoices.find(c=>c.placeName==='혹호')?.slots.find(s=>s.minute===605);
  const lunchAfter=cafe ? engine.addMeal(withLunch,cafe).rows.find(r=>r.placeId===lunch.placeId).minute : lunch.minute;
  const interactionFindings=[];
  if(lunchAfter!==lunch.minute) interactionFindings.push({problem:'이미 선택한 점심 시각이 후속 아침 카페 선택으로 변경됨',lunch:'대명춘',before:clock(lunch.minute),after:clock(lunchAfter),added:'10:05 혹호',markedAsKeepingVisits:!cafe.replaceName&&!cafe.preview.droppedVisits});
  for(const choice of breakfastChoices) for(const slot of choice.slots) assert.equal(slot.preview.rows.find(r=>r.placeId===lunch.placeId)?.minute,lunch.minute,'제안된 후속 선택이 확정한 점심을 변경함');
  const identicalFocusCases=cases.filter(([name])=>{
    const a=summaries.find(s=>s.name===name&&s.routeFocus==='start'), b=summaries.find(s=>s.name===name&&s.routeFocus==='end');
    return JSON.stringify(a.routes)===JSON.stringify(b.routes);
  }).length;
  const output={date:'2026-10-04',method:'앱의 실제 영업 판정 함수 + 보수적 거리 추정. 외부 API 호출 없음. 브라우저 사용자 검증과 별도.',scenarios:summaries.length,routeCount:summaries.reduce((n,s)=>n+s.count,0),violations,interactionFindings,identicalStartEndFocusCases:identicalFocusCases,summaries};
  const outdir=path.join(__dirname,'qa');fs.mkdirSync(outdir,{recursive:true});
  fs.writeFileSync(path.join(outdir,'route-journeys-2026-10-04-after.json'),JSON.stringify(output,null,2)+'\n');
  console.table(cases.map(([name])=>({name,...Object.fromEntries(summaries.filter(s=>s.name===name).map(s=>[s.routeFocus,s.count]))})));
  console.log(JSON.stringify({scenarios:output.scenarios,routes:output.routeCount,violations,interactionFindings,identicalFocusCases},null,2));
  if(violations.length || interactionFindings.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
