const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=require('../public/gangneung-theme-review-routes.json');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const qa=require('./qa/gangneung-theme-route-geometries-2026-10-07.json');
const mapDistance=require('./qa/gangneung-cafe-map-distance-2026-10-07.json');
const expected=['food','sea','shops','history','cafe'];
assert.deepEqual(data.routes.map(route=>route.themeId),expected);
assert.deepEqual(qa.routes.map(route=>route.themeId),expected);
for(const route of data.routes){
  assert.equal(route.orderStatus,'user-confirmed',route.themeId+' order confirmed');
  assert.equal(route.directionStatus,'saved-walking-geometry-review',route.themeId+' walk geometry marked for review');
  assert.ok(route.walkGeometry,route.themeId+' has geometry metadata');
  assert.equal(route.walkGeometry.acceptedLegs+route.walkGeometry.rejectedLegs,route.walkGeometry.walkLegs);
  const geo=JSON.parse(fs.readFileSync(path.join(root,'public',route.walkGeometry.file),'utf8'));
  const gpx=fs.readFileSync(path.join(root,'public',route.walkGeometry.gpx),'utf8');
  const routeQa=qa.routes.find(item=>item.themeId===route.themeId);
  assert.equal(routeQa.walkLegCount,route.walkGeometry.walkLegs);
  assert.equal(routeQa.acceptedLegCount,route.walkGeometry.acceptedLegs);
  assert.equal(routeQa.rejectedLegCount,route.walkGeometry.rejectedLegs);
  assert.equal(geo.features.length,route.walkGeometry.walkLegs,route.themeId+' GeoJSON features');
  assert.match(gpx,/<trkseg>/,route.themeId+' GPX has track segments');
  for(const feature of geo.features){
    assert.equal(feature.geometry.type,'LineString');
    assert.ok(feature.geometry.coordinates.length>=2);
    const leg=route.legs[feature.properties.legIndex-1];
    assert.equal(leg.from,feature.properties.from);assert.equal(leg.to,feature.properties.to);
    assert.equal(leg.geometryMeters,feature.properties.meters);
    assert.equal(leg.geometryMinutes,feature.properties.minutes);
    assert.equal(leg.geometrySnap.accepted,feature.properties.accepted);
    if(feature.properties.accepted){
      assert.equal(leg.actual,true);assert.equal(leg.geometrySource,'OpenStreetMap/Valhalla pedestrian routing');
      assert.deepEqual(leg.walkPoints,feature.geometry.coordinates);
    }else{
      assert.equal(leg.actual,false);assert.equal(leg.walkPoints,undefined,route.themeId+' rejected geometry is not drawn as pin-to-pin fallback');
    }
  }
}
const cafe=data.routes.find(route=>route.themeId==='cafe');
const cafeNaverWalk=cafe.legs.filter(leg=>leg.mode==='walk'&&leg.naverMeters!=null);
assert.equal(cafeNaverWalk.length,7,'all seven cafe walk legs have Naver comparisons');
assert.equal(cafeNaverWalk.reduce((sum,leg)=>sum+leg.naverMeters,0),2359);
assert.equal(cafeNaverWalk.reduce((sum,leg)=>sum+leg.naverMinutes,0),34);
assert.ok(cafeNaverWalk.every(leg=>leg.naverSource==='Naver Map'&&leg.naverCheckedOn===mapDistance.checkedOn));
const cafeTransit=cafe.legs.filter(leg=>leg.mode==='transit');
assert.equal(cafeTransit.length,2,'cafe route has two surveyed bus connections');
for(const leg of cafeTransit){
  assert.equal(leg.surveyed,true);
  assert.ok(leg.busDistanceMetersApprox>0);
  assert.ok(leg.busRideMinutes>0&&leg.totalRouteMinutes>=leg.busRideMinutes);
  assert.ok(leg.boardingStop?.name&&leg.alightingStop?.name);
  assert.equal(leg.distanceSource,'Naver Map');
  assert.equal(leg.distanceCheckedOn,mapDistance.checkedOn);
  assert.match(leg.distanceMethod,/does not label bus-only kilometers/);
}
assert.equal(cafeTransit.reduce((sum,leg)=>sum+leg.busDistanceMetersApprox,0),7500);
for(const theme of ['food','sea','shops','history'])
  assert.equal(data.routes.find(route=>route.themeId===theme).legs.filter(leg=>leg.mode==='transit').length,0,theme+' does not need an added bus connection');
assert.match(app,/confirmedOrder\?'장소 순서 확정':'루트 초안'/,'route summary uses a short status label');
assert.match(app,/meters:leg\.geometryMeters\?\?leg\.straightLineMeters/,'displayed distance uses pedestrian path distance first');
assert.match(app,/leg\.actual && leg\.walkPoints\?\.length>1 \? '도보 약 /,'walking legs use a concise distance-and-time label');
assert.match(app,/도보 거리 합계/,'route summary shows accumulated OSM walking distance and time');
assert.match(app,/버스 거리는 지도 눈금 추산/,'the separate route-details page explains approximate Naver bus distance');
assert.match(app,/review\.transitSummary\?\.busDistanceMetersApprox/,'cafe route summarizes the two Naver bus connections');
assert.match(app,/지도 약 '\+leg\.naverMinutes/,'each cafe walking leg shows a map distance comparison');
assert.match(app,/네이버 도보 '\+review\.naverWalkSummary\.legs\+'/,'route summary shows the separate Naver walking total');
assert.match(app,/id="route-info-link"/,'long route methodology is moved behind a details link');
assert.match(app,/const showMapLink=review\.theme!=='cafe'/,'cafe review hides per-segment Naver route links');
assert.match(app,/const busConnector=route\.reviewOnly&&route\.theme==='cafe'&&leg\.mode==='transit'/,'cafe bus legs are represented on the map');
assert.match(app,/dashArray:busConnector\?'9,8'/,'bus connector is visually distinct from pedestrian GPX');
assert.match(app,/실제 노선 형상 미표시/,'map tooltip clarifies the bus connector is not road geometry');
console.log('PASS: five Gangneung themes have valid saved walk tracks; cafe transit shows two Naver bus results with approximate bus distances; the four other themes need no added bus segment.');
