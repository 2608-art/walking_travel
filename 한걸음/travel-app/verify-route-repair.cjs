const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const setup=fs.readFileSync(path.join(__dirname,'audit-route-journeys.cjs'),'utf8').split('const cases =')[0];
const {engine,places,station,byId,validate}=vm.runInNewContext(setup+';({engine,places,station,byId,validate})',{require,__dirname,console});
const legs=JSON.parse(fs.readFileSync(path.join(__dirname,'qa/live-route-legs-2026-10-04.json'),'utf8')).legs;
const missing=new Set();
const provider=async(a,b)=>{
  const key=[a.id,a.lat,a.lon,b.id,b.lat,b.lon].join(':');
  if(!legs[key]){missing.add(key);throw Error('저장된 실제 구간 없음');}
  return legs[key];
};
function check(route,input){
  assert(route.rows.length>=2);
  assert.equal(new Set(route.rows.map(r=>r.placeId)).size,route.rows.length);
  assert(route.endArrival<=engine.minutes(input.end));
  assert(route.walkMeters<=8000);
  let now=engine.minutes(input.start),meters=0;
  for(const row of route.rows){
    assert(row.walkMeters<=1600 && row.walkEstimate<=30);
    assert(row.minute>=now+row.walkEstimate);
    const result=input.validate(input.places.find(p=>p.id===row.placeId),row.minute,row.duration,input.date);
    assert(result.kind!=='bad' && !(result.kind==='warn' && /체류 중 브레이크|폐관을 넘/.test(result.title)));
    now=row.minute+row.duration;meters+=row.walkMeters;
  }
  assert(route.endWalk.meters<=1600 && route.endWalk.minutes<=30);
  assert(route.endArrival>=now+route.endWalk.minutes);
  assert.equal(route.walkMeters,meters+route.endWalk.meters);
  if(input.requiredPlaceId) assert([input.origin.id,input.destination.id,...route.rows.map(r=>r.placeId)].includes(input.requiredPlaceId));
}
(async()=>{
  let checked=0;
  for(const [from,to,end,expected] of [['station','station','24:00',12],['station','station','18:00',10],['p8','station','18:00',10],['station','p9','18:00',11],['p8','p2','18:00',null]]){
    const input={places,origin:byId(from),destination:byId(to),start:'10:00',end,date:'2026-10-04',theme:'balanced',mealTimes:[],routeFocus:'through',validate,routeProvider:provider};
    const routes=await engine.generateAdaptive(input);assert(routes.length);
    if(expected)assert.equal(routes[0].rows.length,expected);
    for(const route of routes){check(route,input);assert(route.rows.every(r=>r.actual)&&route.endWalk.actual);checked++;}
    if(from===to && end==='24:00')assert.equal(routes[0].adjustedDroppedNames.length,0);
    if(from===to && end==='18:00')assert.equal(routes[0].adjustedDroppedNames.length,1);
  }
  // 새 순서 탐색은 저장되지 않은 구간도 시험한다. 최종 코스만 실제 구간인지 위에서 확인한다.
  const smallPlaces=['a','b','c'].map((id,i)=>({id,name:id,lat:station.lat+.001*(i+1),lon:station.lon,category:'culture'}));
  const input={places:smallPlaces,origin:station,destination:station,start:'10:00',end:'13:00',date:'2026-10-04',theme:'balanced',mealTimes:[],requiredPlaceId:'c',validate:()=>({kind:'ok'}),routeProvider:async()=>({meters:1000,minutes:20})};
  const reduced=await engine.generateAdaptive(input);assert(reduced.length);
  for(const route of reduced){check(route,input);assert.equal(route.rows.length,2);assert.equal(route.adjustedDroppedNames.length,1);checked++;}
  const short=(await engine.generateAdaptive({...input,end:'11:30'}))[0];
  assert(short && short.rows.length===1 && short.rows[0].placeId==='c','가능한 한 곳 방문을 누락함');
  assert.equal((await engine.generateAdaptive({...input,end:'11:20'})).length,0,'불가능한 종료 시각을 완화함');
  assert.equal((await engine.generateAdaptive({...input,routeProvider:async()=>({meters:1700,minutes:20})})).length,0,'도보 거리 상한을 완화함');
  assert.equal((await engine.generateAdaptive({...input,routeProvider:async()=>({meters:1000,minutes:31})})).length,0,'도보 시간 상한을 완화함');
  const offline=await engine.generateAdaptive({...input,routeProvider:async()=>{throw Error('offline');}});
  assert.equal(offline.length,0,'API 실패로 확인되지 않은 이동을 확정 코스로 표시함');
  console.log(JSON.stringify({passed:true,checked,realLegs:Object.keys(legs).length,unrecordedAlternatives:missing.size,cases:['실제 왕복 순서 조정','선택 장소 축소','편도·근거리','필수 보존','짧은 시간 한 곳 방문','불가능 시간·거리·시간 상한','API 실패 시 확정 제외']}));
})().catch(error=>{console.error(error);process.exitCode=1;});
