const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('./dist/route-engine.js');
const places = JSON.parse(fs.readFileSync(path.join(__dirname,'dist','places.json'),'utf8')).places;
const byId = (id) => places.find((p) => p.id === id);
const station = {id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const validate = (p,minute,duration,date) => {
  const daily=engine.datedHours(p,date);
  if (daily?.closed) return {kind:'bad',title:'해당 날짜 휴무'};
  if (!p.hours && !daily?.open) return {kind:'unknown',title:'운영시간 확인 필요'};
  const h=daily?.open ? {...p.hours,...daily,breaks:daily.breaks?.length ? daily.breaks : p.hours?.breaks} : p.hours, time=minute%1440;
  const open=engine.minutes(h.open), close=engine.minutes(h.close);
  if (h.closedDates?.includes(date) || (!daily?.open && h.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))) return {kind:'bad',title:'휴무'};
  if (time<open || time>=close || time+duration>close) return {kind:'bad',title:'운영시간 외'};
  if (h.breaks?.some(([a,b]) => time<engine.minutes(b) && time+duration>engine.minutes(a))) return {kind:'bad',title:'브레이크 중'};
  return {kind:'ok',title:'운영시간상 가능'};
};
const routeProvider = async (a,b) => {
  const direct=engine.distanceKm(a,b);
  return {meters:Math.ceil(direct*1450),minutes:Math.ceil(direct*1.45/3.8*60)};
};
async function check(input) {
  const routes=await engine.generate({places,origin:station,destination:station,start:'10:00',end:'24:00',date:'2026-10-03',theme:'balanced',mealTimes:[],routeProvider,validate,...input});
  for (const route of routes) {
    assert(route.rows.length >= 2);
    assert(route.walkMeters <= 8000);
    assert(route.endArrival <= route.end);
    assert(route.endWalk.meters <= 1600 && route.endWalk.minutes <= 30);
    for (const row of route.rows) {
      assert(row.walkMeters <= 1600 && row.walkEstimate <= 30);
      assert(row.minute >= route.start && row.minute+row.duration <= route.end);
      assert.notEqual(row.result.kind,'bad');
    }
    for (const meal of (input.mealTimes || [])) {
      const row=route.rows.find((item) => item.minute === engine.minutes(meal) && item.kind === 'meal');
      assert(row,`식사 ${meal} 누락`);
      assert(['food','cafe'].includes(byId(row.placeId).category));
    }
  }
  return routes;
}
(async () => {
  const basic=await check({});
  const lateMeal=await check({mealTimes:['15:30']});
  const shops=await check({theme:'shops',mealTimes:['12:30']});
  const food=await check({theme:'food',mealTimes:['12:30','18:30']});
  const distant=await check({destination:byId('p14')});
  const evening=await check({start:'21:00',end:'24:00',mealTimes:[]});
  assert(basic.length > 0,'기본 경로 없음');
  assert(lateMeal.length > 0,'늦은 식사 경로 없음');
  assert(shops.length > 0,'소품샵 경로 없음');
  assert(food.length > 0,'음식 경로 없음');
  assert(shops.every((r) => r.rows.filter((x) => engine.SHOP_IDS.has(x.placeId)).length >= 2),'소품샵 테마 반영 부족');
  assert(food.every((r) => r.rows.filter((x) => byId(x.placeId).category === 'food').length >= 2),'음식 테마 반영 부족');
  assert.equal(distant.length,0,'먼 종료 지점까지 억지 도보 경로가 생성됨');
  assert.equal(engine.datedHours(byId('p63'),'2026-10-03')?.closed,true,'10/3 김정림선지해장국 휴무 누락');
  assert.equal(engine.datedHours(byId('p64'),'2026-10-03')?.close,'16:30','10/3 정성김밥 종료시간 누락');
  console.log(JSON.stringify({basic:basic.map((r) => r.rows.map((x) => byId(x.placeId).name)),lateMeal:lateMeal.length,shops:shops.map((r) => r.rows.filter((x) => engine.SHOP_IDS.has(x.placeId)).length),food:food.length,distant:distant.length,evening:evening.length},null,2));
})().catch((error) => { console.error(error); process.exitCode=1; });
