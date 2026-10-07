const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'),sandbox);
const engine = sandbox.module.exports;
engine.configureRegion('gangneung');
const places = JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places;
const byId = id => places.find(place => place.id===id);
const preset = engine.THEME_PRESETS.sea;
const input = {
  places,origin:byId(preset.originId),destination:byId(preset.destinationId),
  date:'2026-10-06',start:'09:00',theme:'sea',busProvider:async()=>[],
  validate(place,minute,duration) {
    if(place.unrestrictedAccess) return minute>=7*60 && minute+duration<=18*60 ? {kind:'ok'} : {kind:'bad'};
    const hours={...place.hours,...place.weeklyHours?.[2]};
    if(!hours.open || hours.closedWeekdays?.includes(2)) return {kind:'bad'};
    const open=engine.minutes(hours.open),close=engine.minutes(hours.close);
    return minute>=open && minute+duration<=close && (!hours.lastOrder || minute<=engine.minutes(hours.lastOrder)) ? {kind:'ok'} : {kind:'bad'};
  }
};

(async()=>{
  assert(!byId('g13'),'오죽헌 내부 시립박물관이 독립 장소로 남음');
  assert(byId('g9').description.includes('문성사') && byId('g9').description.includes('시립박물관'));
  const routes=await engine.generateThemeDay({...input,routeProvider:async(from,to)=>({...engine.estimate(from,to),actual:true})});
  assert.equal(routes.length,1,'해변 테마의 초기 탐색이 5곳 코스를 만들지 못함');
  const route=routes[0], ids=Array.from(route.rows,row=>row.placeId);
  assert.deepEqual(ids,['g4','g14','g36','g5','g35'],'카페와 해변의 방문 순서가 바뀜');
  assert(route.walkMeters<=8000,'하루 도보 8km 상한 초과');
  assert(route.rows.every(row=>row.walkMeters<=2400 && row.walkEstimate<=40),'긴 도보 구간 상한 초과');
  assert(route.endWalk.meters<=2400 && route.endWalk.minutes<=40,'마지막 구간 상한 초과');
  const unavailable=await engine.generateThemeDay({...input,routeProvider:async()=>{throw Error('경로 API 이용 불가');}});
  assert.equal(unavailable.length,0,'실제 도보를 조회하지 못했는데 확정 코스가 표시됨');
  console.log('PASS: 강릉 오죽헌 통합 설명, 바다·카페 5곳 동선, 도보 상한, API 실패 시 미확정');
})().catch(error=>{console.error(error);process.exitCode=1;});
