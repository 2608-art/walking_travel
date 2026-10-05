const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('./dist/route-engine.js');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const byId=id=>places.find(p=>p.id===id);
const source=fs.readFileSync('./dist/app.js','utf8');
const evaluate=vm.runInNewContext(source.slice(source.indexOf('  function evaluate('),source.indexOf('  function pillFor('))+'\nevaluate;',{
  routeEngine:engine,entryPlace:e=>byId(e.placeId),toMin:engine.minutes,
  dateAt:(base,m)=>{const d=new Date(base+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(m/1440));return d.toISOString().slice(0,10);},
  weekday:d=>new Date(d+'T12:00:00Z').getUTCDay()
});
const validate=(p,m,d,date)=>evaluate({placeId:p.id,duration:d},m,date);
const defaults={places,origin:station,destination:byId('p9'),start:'10:00',end:'18:00',date:'2026-10-04',theme:'balanced',routeFocus:'through',validate};
// 회귀용 공급자 응답이며 현장 실측 경로를 뜻하지 않는다.
const fixtureWalk=async(a,b)=>engine.estimate(a,b);
function mealOptions(route,input,kind){return engine.mealChoices({...defaults,...input,route,kind});}
(async()=>{
  const recovered=[];
  for(const [origin,destination] of [['p7','p14'],['p8','p19'],['p19','p8']]) {
    const input={...defaults,origin:byId(origin),destination:byId(destination),routeProvider:fixtureWalk};
    const routes=await engine.generateAdaptive(input);
    assert(routes.length,'이전에 없던 코스를 복원하지 못함');
    for(const r of routes) {
      assert.equal(r.destinationName,input.destination.name);
      assert(r.endArrival<=1080 && r.walkMeters<=8000);
      assert(r.rows.every(row=>row.minute<1020 || byId(row.placeId).category!=='spot' || byId(row.placeId).hours || engine.datedHours(byId(row.placeId),input.date)?.open || row.placeId==='p14'),'미확인 관광지가 17시 이후 보조 코스에 삽입됨');
      if(r.fallbackFocus) assert.notEqual(r.routeFocus,r.requestedFocus);
    }
    recovered.push({origin:input.origin.name,destination:input.destination.name,focus:routes[0].routeFocus,fallback:routes[0].fallbackFocus,visits:routes[0].rows.length,km:routes[0].walkMeters/1000});
  }
  const skyInput={...defaults,origin:byId('p8'),destination:byId('p19'),end:'24:00',routeProvider:fixtureWalk};
  const sky=(await engine.generateAdaptive(skyInput))[0];
  const lunchOptions=[...mealOptions(sky,skyInput,'meal'),...mealOptions(sky,skyInput,'cafe')];
  const recommended=engine.recommendMealTimes(lunchOptions,{from:660,to:960,target:750});
  assert(recommended.length>0,'스카이워크 코스의 점심 목록 소실');
  assert(recommended.some(item=>byId(item.choice.placeId).category==='food'),'스카이워크 점심에 음식점이 모두 탈락하고 카페만 남음');
  assert.equal(new Set(recommended.map(x=>x.choice.placeId)).size,recommended.length,'식당별 시각 중복');
  assert.equal(recommended.length,lunchOptions.filter(c=>c.slots.some(s=>s.minute>=660&&s.minute<960)).length,'추천 시각을 줄이며 식당도 임의로 제외함');
  const start=await engine.generateAdaptive({...defaults,routeFocus:'start',routeProvider:fixtureWalk});
  const end=await engine.generateAdaptive({...defaults,routeFocus:'end',routeProvider:fixtureWalk});
  assert.notDeepEqual(start.map(r=>r.signature),end.map(r=>r.signature),'출발/도착 중심 선택이 동일하게 구현됨');
  const base=(await engine.generate(defaults))[0];
  const lunch=mealOptions(base,{},'meal').find(c=>c.placeName==='대명춘').slots.find(s=>s.minute===760);
  assert(lunch,'기존 식사시각 오류 재현용 점심 없음');
  const chosen=engine.addMeal(base,lunch);
  const cafes=mealOptions(chosen,{},'cafe');
  assert(cafes.some(c=>c.slots.some(s=>s.minute<660)),'고정된 점심 앞에 가능한 카페도 모두 제거됨');
  for(const cafe of cafes) for(const slot of cafe.slots) assert.equal(slot.preview.rows.find(r=>r.placeId===lunch.placeId)?.minute,760,'먼저 정한 점심이 움직임');
  const restored=engine.restoreFixedMeals(base,[{kind:'meal',placeId:lunch.placeId,minute:760,period:'lunch'}],defaults);
  assert.equal(restored?.chosenMeals[0].minute,760);
  assert.equal(restored?.chosenMeals[0].period,'lunch');
  const impossible=await engine.generateAdaptive({...defaults,requiredPlaceId:'p14',routeProvider:fixtureWalk});
  assert.equal(impossible.length,0,'대체 동선이 먼 필수 방문을 생략함');
  const optional=await engine.generateAdaptive({...defaults,preferredPlaceId:'p14',routeProvider:fixtureWalk});
  assert(optional.length>0);
  const queries=[];
  const apiRoutes=await engine.generateAdaptive({...defaults,routeProvider:async(a,b)=>{queries.push(a.id+':'+b.id);return engine.estimate(a,b);}});
  const finalEdges=new Set(apiRoutes.flatMap(r=>{const ids=[defaults.origin.id,...r.rows.map(x=>x.placeId),defaults.destination.id];return ids.slice(1).map((id,i)=>ids[i]+':'+id);}));
  assert(queries.every(key=>finalEdges.has(key)),'최종 코스에 없는 구간에 API 사용');
  assert.equal(new Set(queries).size,queries.length,'같은 요청에서 중복 API 사용');
  const badApi=await engine.generateAdaptive({...defaults,routeProvider:async()=>({meters:2500,minutes:50})});
  assert.equal(badApi.length,0,'실제 경로의 거리 상한 위반을 추정값으로 덮음');
  // 미래 음식 분류 연결: 검증용 데이터에서만 태그를 부여하며 실제 장소 분류는 추측하지 않는다.
  const tagged=places.map(p=>p.id===lunch.placeId?{...p,cuisineTags:['test-cuisine']}:p);
  const cuisine=engine.mealChoices({...defaults,places:tagged,route:base,kind:'meal',cuisineTags:['test-cuisine']});
  assert(cuisine.length && cuisine.every(c=>c.placeId===lunch.placeId));
  console.log(JSON.stringify({recovered,lunchRestaurants:recommended.length,fixedLunch:'12:40 유지',apiQueries:queries.length},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
