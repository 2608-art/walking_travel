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
  assert(engine.distanceKm(station,byId(basic[0].rows[0].placeId)) < .3,'목포역 근처를 지나치고 먼 곳부터 방문함');
  for (const route of basic) for (let i=3;i<route.rows.length;i++) {
    const current=byId(route.rows[i].placeId), previous=byId(route.rows[i-1].placeId);
    assert(!route.rows.slice(0,i-2).some((row) => {
      const visited=byId(row.placeId);
      return engine.distanceKm(previous,visited)>.35 && engine.distanceKm(current,visited)<.12;
    }),'이미 떠난 블록으로 다시 되돌아감');
  }
  assert(lateMeal.length > 0,'늦은 식사 경로 없음');
  assert(shops.length > 0,'소품샵 경로 없음');
  assert(food.length > 0,'음식 경로 없음');
  assert(shops.every((r) => r.rows.filter((x) => engine.SHOP_IDS.has(x.placeId)).length >= 2),'소품샵 테마 반영 부족');
  assert(food.every((r) => r.rows.filter((x) => byId(x.placeId).category === 'food').length >= 2),'음식 테마 반영 부족');
  assert.equal(distant.length,0,'먼 종료 지점까지 억지 도보 경로가 생성됨');
  assert.equal(engine.datedHours(byId('p63'),'2026-10-03')?.closed,true,'10/3 김정림선지해장국 휴무 누락');
  assert.equal(engine.datedHours(byId('p64'),'2026-10-03')?.close,'16:30','10/3 정성김밥 종료시간 누락');
  const endpoint=byId('p9');
  for (const routeFocus of ['start','end','through']) {
    const focused=await check({destination:endpoint,end:'18:00',routeFocus,requiredPlaceId:'p17'});
    assert(focused.length>0,`${routeFocus} 동선 없음`);
    assert(focused.every((route) => route.rows.some((row) => row.placeId === 'p17')),'필수 장소 누락');
    assert(focused.every((route) => route.endArrival <= engine.minutes('18:00')),'도착 시각 초과');
  }
  const impossibleMust=await check({requiredPlaceId:'p14',routeFocus:'through'});
  const fallback=await check({preferredPlaceId:'p14',routeFocus:'through'});
  const foodMust=await check({requiredPlaceId:'p47',routeFocus:'through'});
  assert.equal(impossibleMust.length,0,'먼 필수 장소를 억지로 포함함');
  assert(fallback.length>0,'필수 장소가 불가능할 때 대체 동선 없음');
  assert(foodMust.length>0 && foodMust.every((route) => route.rows.some((row) => row.placeId === 'p47')),'식당을 필수 장소로 선택했을 때 누락');
  const reversed=await engine.reverseRoundTrip({route:basic[0],places,origin:station,date:'2026-10-03',validate,routeProvider});
  assert(reversed && reversed.rows.length >= 2,'왕복 코스의 반대 방향을 만들지 못함');
  assert(reversed.rows.every(row=>row.actual)&&reversed.endWalk.actual,'반대 방향의 이동 구간이 확인되지 않음');
  assert(reversed.endArrival <= reversed.end && reversed.walkMeters <= 8000,'반대 방향 도착·거리 조건 위반');
  const originalOrder=basic[0].rows.map((row) => row.placeId).reverse();
  assert(reversed.rows.every((row,i) => i === 0 || originalOrder.indexOf(reversed.rows[i-1].placeId) < originalOrder.indexOf(row.placeId)),'반대 방향 방문 순서 오류');
  const mealRoute=basic.find((route) => engine.mealChoices({route,places,origin:station,destination:station,date:'2026-10-03',validate,kind:'lunch'}).length);
  assert(mealRoute,'동선에서 점심 후보를 찾지 못함');
  const lunch=engine.mealChoices({route:mealRoute,places,origin:station,destination:station,date:'2026-10-03',validate,kind:'lunch'})[0];
  const withLunch=engine.addMeal(mealRoute,lunch);
  assert(withLunch.rows.some((row) => row.kind === 'meal' && row.placeId === lunch.placeId),'선택한 식당 누락');
  const checkedLunch=await engine.verifyEditedRoute(withLunch,{places,origin:station,destination:station,date:'2026-10-03',theme:'balanced',validate,routeProvider});
  assert(checkedLunch?.rows.every(row=>row.actual)&&checkedLunch.endWalk.actual,'식사 추가 구간을 실제 응답으로 재확인하지 못함');
  assert(withLunch.endArrival <= withLunch.end && withLunch.walkMeters <= 8000,'식사 추가 후 도착 조건 위반');
  assert(withLunch.rows.every((row,i) => !i || row.minute >= withLunch.rows[i-1].minute+withLunch.rows[i-1].duration+row.walkEstimate),'식사 추가 후 방문 시각 겹침');
  const allMeals=engine.mealChoices({route:mealRoute,places,origin:station,destination:station,date:'2026-10-03',validate,kind:'meal'});
  assert(allMeals.length>3,'식당 선택지가 임시 3곳 제한에 머묾');
  assert(allMeals.every((choice) => choice.slots.length && choice.ranges.length && choice.slots.every((slot) => slot.preview.endArrival<=mealRoute.end)),'식당 방문 가능 시간 또는 도착 검증 누락');
  const cafeChoices=engine.mealChoices({route:mealRoute,places,origin:station,destination:station,date:'2026-10-03',validate,kind:'cafe'});
  assert(cafeChoices.length>0 && cafeChoices.every((choice) => choice.slots.every((slot) => slot.kind==='cafe')),'카페 휴식 선택지 누락');
  const withCafe=engine.addMeal(mealRoute,cafeChoices[0].slots[0]);
  assert(withCafe.rows.some((row) => row.kind==='cafe' && row.placeId===cafeChoices[0].placeId),'선택한 카페 누락');
  console.log(JSON.stringify({basic:basic.map((r) => r.rows.map((x) => byId(x.placeId).name)),lateMeal:lateMeal.length,shops:shops.map((r) => r.rows.filter((x) => engine.SHOP_IDS.has(x.placeId)).length),food:food.length,distant:distant.length,evening:evening.length},null,2));
})().catch((error) => { console.error(error); process.exitCode=1; });
