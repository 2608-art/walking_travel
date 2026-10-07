const assert=require('node:assert/strict');
const fs=require('node:fs');
const picks=require('../public/gangneung-theme-place-picks.json');
const places=require('../public/gangneung-places.json').places;
const app=fs.readFileSync('public/app.js','utf8');
const byId=new Map(places.map(place=>[place.id,place]));
assert.equal(picks.status,'draft-place-picks-only');
assert.equal(picks.themes.length,5);
const pinDistanceKm=(point,center)=>Math.hypot((point[0]-center[0])*111,(point[1]-center[1])*88);
for(const theme of picks.themes){
  if(theme.id==='cafe') assert.equal(theme.placeIds.length,30,'cafe tour retains its 30 citywide candidates');
  else {
    assert.ok(theme.pinScope,theme.id+' has a defined regional pin scope');
    assert.equal(theme.pinScope.radiusKm,2,theme.id+' uses a 2km radius');
    assert.ok(theme.placeIds.length<=30,theme.id+' keeps the regional candidate list within 30 pins');
  }
  assert.equal(new Set(theme.placeIds).size,theme.placeIds.length,theme.id+' has no duplicate pins');
  for(const id of theme.placeIds){
    const place=byId.get(id);
    assert.ok(place,theme.id+' known place '+id);
    const lat=place.lat??place.mapLat,lon=place.lon??place.mapLon;
    assert.ok(Number.isFinite(lat)&&Number.isFinite(lon),theme.id+' has map pin '+id);
    if(theme.pinScope)assert.ok(theme.pinScope.centers.some(center=>pinDistanceKm([lat,lon],center)<=theme.pinScope.radiusKm),theme.id+' keeps only in-scope pin '+id);
  }
}
const cafe=picks.themes.find(theme=>theme.id==='cafe');
assert.ok(cafe.placeIds.every(id=>byId.get(id).category==='cafe'),'cafe theme contains cafes only');
assert.ok(cafe.placeIds.includes('g258'),'distinctive strawberry cafe included');
const food=picks.themes.find(theme=>theme.id==='food');
assert.ok(food.placeIds.includes('g332'),'Gangmun/Chodang scope keeps Chodang Haejangguk');
const market=picks.themes.find(theme=>theme.id==='shops');
assert.ok(market.placeIds.filter(id=>byId.get(id).category==='market').length>=25,'market theme emphasizes market snacks');
for(const id of ['g3','g27','g200'])assert.ok(market.placeIds.includes(id),'market theme includes nearby non-food place '+id);
const history=picks.themes.find(theme=>theme.id==='history');
assert.ok(history.placeIds.filter(id=>byId.get(id).category==='culture').length>=10,'history theme emphasizes nearby culture sites');
assert.match(app,/showGangneungThemePlacePicks\(picks\)/);
assert.match(app,/2km 권역 필터 적용/,'theme screen labels the 2km scope filter');
assert.match(app,/theme\.id==='shops'\?theme\.placeIds\.length>30/,'market theme can reach its 30-pin candidate target');
const render=app.slice(app.indexOf('function showGangneungThemePlacePicks'),app.indexOf('function showRouteResults'));
assert.match(render,/theme-place-picks-list/,'candidate places remain available as a list');
assert.doesNotMatch(render,/route-result-map|L\.marker\(|L\.polyline\(/,'theme place-picks screen has no map or route line');
console.log('PASS: regional 2km pin filtering, 30-cafe citywide tour, nearby market sightseeing pins, and list-only place-picks screen.');
