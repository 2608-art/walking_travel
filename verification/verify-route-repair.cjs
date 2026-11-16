const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
// Pair the recorded legs with their original place snapshot (commit ab77fba).
// The engine and opening-hours evaluator still come from current public sources.
const setup=fs.readFileSync(path.join(__dirname,'audit-route-journeys.cjs'),'utf8').split('const cases =')[0]
  .replace("'../public/places.json'", "'fixtures/route-repair-places-2026-10-04.json'");
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
  // Current ranking may explore different candidates than the recording-era engine.
  // Exact stop preservation/reduction is checked with controlled inputs below.
  for(const [from,to,end] of [['station','station','24:00'],['station','station','18:00'],['p8','station','18:00'],['station','p9','18:00'],['p8','p2','18:00']]){
    const input={places,origin:byId(from),destination:byId(to),start:'10:00',end,date:'2026-10-04',theme:'balanced',mealTimes:[],routeFocus:'through',validate,routeProvider:provider};
    const routes=await engine.generateAdaptive(input);assert(routes.length);
    for(const route of routes){check(route,input);assert(route.rows.every(r=>r.actual)&&route.endWalk.actual);checked++;}
    for(const route of routes) for(const name of route.adjustedDroppedNames || [])
      assert(!route.rows.some(row=>byId(row.placeId).name===name),'dropped stop remains in itinerary');
    for(const route of routes) {
      let previous=input.origin;
      for(const row of [...route.rows,{placeId:to,walkMeters:route.endWalk.meters,walkEstimate:route.endWalk.minutes}]) {
        const next=byId(row.placeId);
        const recorded=legs[[previous.id,previous.lat,previous.lon,next.id,next.lat,next.lon].join(':')];
        assert(recorded,'returned route must only use recorded legs');
        assert.equal(row.walkMeters,recorded.meters);
        assert.equal(row.walkEstimate,recorded.minutes);
        previous=next;
      }
    }
  }
  // Missing exploratory legs deliberately throw; no returned leg may use that fallback.
  const smallPlaces=['a','b','c'].map((id,i)=>({id,name:id,lat:station.lat+.001*(i+1),lon:station.lon,category:'culture'}));
  const input={places:smallPlaces,origin:station,destination:station,start:'10:00',end:'13:00',date:'2026-10-04',theme:'balanced',mealTimes:[],requiredPlaceId:'c',validate:()=>({kind:'ok'}),routeProvider:async()=>({meters:1000,minutes:20})};
  const reduced=await engine.generateAdaptive(input);assert(reduced.length);
  for(const route of reduced){check(route,input);assert.equal(route.rows.length,2);assert.equal(route.adjustedDroppedNames.length,1);checked++;}
  const retained=await engine.generateAdaptive({...input,end:'15:00'});assert(retained.length);
  for(const route of retained){check(route,{...input,end:'15:00'});assert.equal(route.rows.length,3,'ample time retains every fixture stop');assert.equal((route.adjustedDroppedNames || []).length,0);checked++;}
  const boundary=await engine.generateAdaptive({...input,end:'11:30'});
  assert(boundary.length,'exactly feasible required-stop route should remain available');
  for(const route of boundary){assert.equal(route.rows.length,1);assert.equal(route.rows[0].placeId,'c');assert.equal(route.endArrival,690);}
  assert.equal((await engine.generateAdaptive({...input,end:'11:29'})).length,0,'불가능한 종료 시각을 완화함');
  assert.equal((await engine.generateAdaptive({...input,routeProvider:async()=>({meters:1700,minutes:20})})).length,0,'도보 거리 상한을 완화함');
  assert.equal((await engine.generateAdaptive({...input,routeProvider:async()=>({meters:1000,minutes:31})})).length,0,'도보 시간 상한을 완화함');
  const offline=await engine.generateAdaptive({...input,routeProvider:async()=>{throw Error('offline');}});
  assert.equal(offline.length,0,'API failure must not produce confirmed recommendations');
  const review=await engine.generateReviewRoute({...input,offlineOnly:true});
  assert(review.review && review.rows.length && review.rows.every(row=>!row.actual) && !review.endWalk.actual,'offline draft must be explicitly unverified');
  console.log(JSON.stringify({passed:true,checked,realLegs:Object.keys(legs).length,cases:['실제 왕복 순서 조정','선택 장소 축소','편도·근거리','필수 보존','불가능 시간·거리·시간 상한','API 실패 추정 표시']}));
})().catch(error=>{console.error(error);process.exitCode=1;});
