const assert=require('node:assert/strict');
const fs=require('node:fs');
const data=require('../public/gangneung-theme-review-routes.json');
const audit=require('./qa/gangneung-straight-line-order-2026-10-07.json');
const places=require('../public/gangneung-places.json').places;
const app=fs.readFileSync('public/app.js','utf8');
const byId=new Map(places.map(place=>[place.id,place]));
const themes=['food','sea','shops','history'];
const expectedCafeIds=['g24','g25','g258','g223','g195','g193','g98','g189','g187','g17'];
const coords=id=>{const p=byId.get(id);return [p.lat??p.mapLat,p.lon??p.mapLon];};
const km=(a,b)=>Math.hypot((a[0]-b[0])*111,(a[1]-b[1])*88);
assert.equal(data.version,3);
assert.equal(data.status,'review-only');
assert.equal(data.routes.length,5);
assert.deepEqual(audit.routes.map(route=>route.themeId),['food','sea','shops','history','cafe']);
for(const theme of [...themes,'cafe'])assert.equal(data.routes.filter(route=>route.themeId===theme).length,1);
for(const route of data.routes){
  const expectedCount={food:11,sea:9,shops:10,history:9,cafe:10}[route.themeId];
  assert.equal(route.placeIds.length,expectedCount,route.id);
  assert.equal(new Set(route.placeIds).size,expectedCount,route.id);
  assert.equal(route.legs.length,expectedCount-1,route.id);
  for(const id of route.placeIds){const place=byId.get(id);assert.ok(place,route.id+' '+id);assert.ok(Number.isFinite(place.lat??place.mapLat)&&Number.isFinite(place.lon??place.mapLon),route.id+' '+id+' pin');}
  if(route.themeId==='cafe'){
    assert.deepEqual(route.placeIds,expectedCafeIds,route.id+' preserves the cafe route');
    assert.ok(route.placeIds.every(id=>byId.get(id).category==='cafe'),route.id+' cafe-only');
    assert.deepEqual(route.mealSlots,{},route.id+' no meals in cafe tour');
    continue;
  }
  if(route.themeId==='food'){
    assert.deepEqual(route.placeIds.slice(8),['g56','g257','g35'],route.id+' shifts glass shop, take-home food, and bridge one position after removing stop 1');
    assert.equal(route.stopKinds.g257,'take-home',route.id+' marks Seoul Chicken as take-home food, not a meal');
    assert.equal(route.stopKinds.g56,'place');
    assert.equal(byId.get('g257').name,'서울양계');
    assert.equal(byId.get('g56').name,'유리알유희');
  }
  if(route.themeId==='shops'){
    for(const id of ['g3','g27','g200'])assert.ok(route.placeIds.includes(id),route.id+' includes nearby non-food sightseeing '+id);
    assert.ok(route.orderBasis.walkingOrderMeters<2000,route.id+' consolidates the market-area loop to under 2km in straight-line segments');
    assert.equal(route.placeIds.filter(id=>byId.get(id).category==='cafe').length,1,route.id+' keeps one market-area cafe');
    assert.ok(route.placeIds.indexOf('g40')<route.placeIds.indexOf('g58'),route.id+' keeps lunch before dinner');
    assert.match(route.orderBasis.source,/minimization across all stops/);
  }
  assert.equal(route.transitLegCount,0,route.id+' uses no buses in the straight-line draft');
  assert.equal(route.directionStatus,'saved-walking-geometry-review');
  assert.equal(route.orderStatus,'user-confirmed');
  assert.equal(route.startTime,'08:00');
  if(['food','sea','history'].includes(route.themeId)){
    assert.notEqual(route.placeIds[0],'g33',route.id+' removes stop 1 breakfast place');
    assert.ok(!Object.hasOwn(route.mealSlots,'g33'),route.id+' removes breakfast slot with stop 1');
    assert.ok(!route.placeIds.includes('g33'),route.id+' removes stop 1 from route');
  }else assert.equal(route.placeIds[0],'g33',route.id+' retains city breakfast start');
  const expectedMeals=route.themeId==='shops'?['아침','점심','저녁']:['점심','저녁'];
  assert.deepEqual(Object.values(route.mealSlots),expectedMeals,route.id+' keeps remaining meals in order');
  const meals=Object.entries(route.mealSlots).map(([id])=>id);
  assert.deepEqual(meals.map(id=>route.placeIds.indexOf(id)).sort((a,b)=>a-b),meals.map(id=>route.placeIds.indexOf(id)),route.id+' meals ordered');
  for(const id of meals)assert.ok(['food','market'].includes(byId.get(id).category),route.id+' meal stop category');
  assert.ok(route.placeIds.filter(id=>byId.get(id).category==='cafe').length<=2,route.id+' max two cafes');
  assert.match(route.planNote,/방문 순서는 확정/);
  assert.ok(route.orderBasis.corePlaceIds.every(id=>route.placeIds.includes(id)),route.id+' retains all core stops');
  const coreIndices=route.orderBasis.corePlaceIds.map(id=>route.placeIds.indexOf(id));
  assert.ok(coreIndices.every((index,i)=>i===0||coreIndices[i-1]<index),route.id+' keeps core order');
  assert.ok(route.orderBasis.walkingOrderMeters>0,route.id+' has straight-line path length');
  for(const [i,leg] of route.legs.entries()){
    assert.equal(leg.from,route.placeIds[i]);assert.equal(leg.to,route.placeIds[i+1]);
    assert.equal(leg.geometrySource,'OpenStreetMap/Valhalla pedestrian routing');assert.equal(leg.surveyed,false);
    assert.equal(leg.routeUrl,undefined,route.id+' does not attach map directions to a straight-line draft');
    assert.ok(Number.isFinite(leg.geometryMinutes)&&leg.geometryMinutes>0,route.id+' OSM walking time');
    assert.ok(Number.isFinite(leg.geometryMeters)&&leg.geometryMeters>0,route.id+' OSM walking distance');
    assert.ok(leg.walkPoints.length>1,route.id+' follows mapped walking path');
    const [a,b]=[coords(leg.from),coords(leg.to)];
    assert.equal(leg.straightLineMeters,Math.round(km(a,b)*1000),route.id+' retains direct distance separately');
  }
}
assert.match(app,/geometrySource==='straight-line-order-draft'/,'straight-line draft rendering is still explicit');
assert.match(app,/expectedStops=\{food:11,sea:9,shops:10,history:9,cafe:10\}/,'loader permits the updated stop counts');
assert.match(app,/id="show-straight-line-route"/,'straight-line routes are reachable from the themed pin map');
assert.doesNotMatch(app,/id="back-to-theme-pins"|테마 핀 지도/,'the route preview no longer links back to the themed pin map');
assert.match(app,/confirmedOrder\?'장소 순서 확정':'루트 초안'/,'route summary uses a short status label');
assert.match(app,/id="route-info-link"/,'detailed route methodology is available from a separate page');
assert.match(app,/id="review-details-back"/,'the route detail page can return to the route');
assert.doesNotMatch(app,/id="save-theme-route-draft"/,'the bottom theme-draft save button is removed');
assert.match(app,/핀 사이 직선 약/);
assert.match(app,/포장해 갈 먹거리/,'take-home food label is shown distinctly from meal stops');
assert.match(app,/route-stop-time">1<\/div><div><strong>출발 · /,'confirmed route list explicitly starts with departure at 1');
assert.match(app,/numberedStops\?index\+2:index\+1/,'confirmed route stop numbers continue after departure');
console.log('PASS: Gangmun, sea, and history omit stop 1 and retain ordered numbered lists; market and cafe tour are preserved; remaining meals and saved OSM geometry match the updated routes.');
