const assert = require('node:assert/strict');
const fs = require('node:fs');
const qa = JSON.parse(fs.readFileSync('verification/qa/gangneung-theme-routes-naver-2026-10-07.json','utf8'));
const artifact = JSON.parse(fs.readFileSync('verification/qa/gangneung-first-route-geometry-2026-10-07.json','utf8'));
const catalog = JSON.parse(fs.readFileSync('public/walk-paths.json','utf8'));
const candidate = qa.routes.find(route=>route.id==='food-01');
assert.ok(candidate);
assert.equal(artifact.enableForApp,false,'unmatched geometry must remain disabled');
assert.equal(artifact.paths.length,candidate.legs.length);
for (const leg of candidate.legs) {
  const path=artifact.paths.find(item=>item.from.id===leg.from&&item.to.id===leg.to);
  assert.ok(path,`missing route geometry ${leg.from}>${leg.to}`);
  assert.ok(path.variants[0].points.length>1);
  assert.ok(path.source.url.startsWith('https://valhalla1.openstreetmap.de/route?json='));
  assert.ok(path.source.naverUrl.startsWith('https://way-m.map.naver.com/'));
  assert.equal(path.verification.geometryProvider,'Valhalla public routing service using OpenStreetMap pedestrian network');
  assert.equal(path.verification.naverMap.meters,leg.meters);
  assert.equal(path.verification.naverMap.minutes,leg.minutes);
  assert.match(path.verification.naverComparisonStatus,/거리 차이/);
  assert.equal(catalog.paths.some(item=>item.from.id===leg.from&&item.to.id===leg.to),false,
    `${leg.from}>${leg.to} geometry must not be selectable as a confirmed app path`);
  const near=(a,b)=>Math.abs(a[0]-b.lon)<.0005&&Math.abs(a[1]-b.lat)<.0005;
  assert.ok(near(path.variants[0].points[0],path.from));
  assert.ok(near(path.variants[0].points.at(-1),path.to));
}
console.log(JSON.stringify({passed:true,route:candidate.id,comparisonOnly:true,appEnabled:false,geometryLegs:candidate.legs.length,geometrySource:'OSM/Valhalla',naverComparisons:candidate.legs.map(leg=>{const p=artifact.paths.find(x=>x.from.id===leg.from&&x.to.id===leg.to);return {from:leg.from,to:leg.to,distanceDifferencePercent:p.verification.naverDistanceDifferencePercent}})},null,2));
