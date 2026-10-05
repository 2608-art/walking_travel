const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const engine=require('./dist/route-engine.js');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const byId=id=>places.find(p=>p.id===id);
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const source=fs.readFileSync('./dist/app.js','utf8');
const evaluate=vm.runInNewContext(source.slice(source.indexOf('  function evaluate('),source.indexOf('  function pillFor('))+'\nevaluate;',{
  routeEngine:engine,entryPlace:e=>byId(e.placeId),toMin:engine.minutes,
  dateAt:(base,m)=>{const d=new Date(base+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(m/1440));return d.toISOString().slice(0,10);},
  weekday:d=>new Date(d+'T12:00:00Z').getUTCDay()
});
const validate=(p,m,d,date)=>evaluate({placeId:p.id,duration:d},m,date);
const input={places,origin:station,destination:station,date:'2026-10-04',start:'10:00',end:'20:00',theme:'balanced',validate};
const bus={minutes:33,meters:7228,walkMeters:443,walkMinutes:8,busRideMinutes:25,steps:[{type:'BUS',minutes:25,guidance:'검증용 22번 버스'}]};
(async()=>{
  let busCalls=0,walkCalls=0;
  const walk=async(a,b)=>{walkCalls++;return engine.estimate(a,b);};
  const provider=async()=>{busCalls++;return [bus];};
  const themes=[];
  for(const theme of Object.keys(engine.THEME_PRESETS)) {
    const preset=engine.THEME_PRESETS[theme];
    const route=(await engine.generateThemeDay({...input,origin:byId(preset.originId)||station,destination:byId(preset.destinationId)||station,theme,routeProvider:walk,busProvider:provider}))[0];
    assert(route,theme+' 실제경로 검증 후 결과 없음');
    assert.equal(route.transport,'walk');
    assert.equal(busCalls,0,'도보 가능 테마에서 버스 조회');
    assert(route.rows.every(r=>r.actual),'테마 실제 도보 재검증 누락');
    const fixed=route.chosenMeals || [];
    for(const meal of fixed) assert.equal(route.rows.find(r=>r.placeId===meal.placeId).minute,meal.minute);
    themes.push({theme,visits:route.rows.length,walkKm:route.walkMeters/1000});
  }
  assert(walkCalls>0);
  const remote={...input,destination:byId('p14'),routeProvider:walk,busProvider:provider};
  const mixed=(await engine.generateAdaptive(remote))[0];
  assert(mixed && mixed.transport==='walk-bus','먼 권역 버스 연결 실패');
  assert(mixed.rows.some(r=>r.mode==='bus') || mixed.endWalk.mode==='bus');
  assert(mixed.endArrival<=1200 && mixed.walkMeters<=8000);
  const context={...remote,route:mixed,kind:'lunch'};
  const meals=engine.mealChoices(context);
  for(const choice of meals) for(const slot of choice.slots) {
    const before=mixed.rows.map((r,i)=>r.mode==='bus'?[i?mixed.rows[i-1].placeId:station.id,r.placeId]:null).filter(Boolean);
    const after=slot.preview.rows.map((r,i)=>r.mode==='bus'?[i?slot.preview.rows[i-1].placeId:station.id,r.placeId]:null).filter(Boolean);
    assert.deepEqual(after,before,'식사 추가가 버스 승하차 장소를 변경');
  }
  assert.equal((await engine.generateAdaptive({...remote,busProvider:async()=>[]})).length,0);
  assert.equal((await engine.generateAdaptive({...remote,busProvider:async()=>[{...bus,steps:[{type:'SUBWAY'}]}]})).length,0);
  assert.equal((await engine.generateAdaptive({...remote,busProvider:async()=>[{...bus,walkMeters:2000}]})).length,0);
  assert.equal((await engine.generateAdaptive({...remote,busProvider:async()=>[{...bus,busRideMinutes:60,steps:[{type:'BUS',minutes:60}]}]})).length,0);
  const report={themes,walkCalls,busCalls,busFallback:{visits:mixed.rows.length,endArrival:mixed.endArrival,walkMeters:mixed.walkMeters},mealChoices:meals.length,checks:'도보 우선·버스 실패·철도 제외·접근도보 상한·식사 후 버스 연결 보존 통과'};
  fs.writeFileSync('qa/theme-transport-2026-10-04.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
