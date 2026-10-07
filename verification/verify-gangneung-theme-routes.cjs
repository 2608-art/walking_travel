const assert = require('node:assert/strict');
const fs = require('node:fs');

const data = JSON.parse(fs.readFileSync('verification/qa/gangneung-theme-routes-naver-2026-10-07.json', 'utf8'));
const expectedThemes = ['food','sea','shops','cafe','history'];
const places = new Map(JSON.parse(fs.readFileSync('public/gangneung-places.json', 'utf8')).places.map(place => [place.id, place]));
assert.equal(data.routeCount, 25, 'five candidate routes per Gangneung theme');
assert.equal(data.routes.length, 25, 'all candidate routes are saved');
for (const theme of expectedThemes) {
  const routes = data.routes.filter(route => route.themeId === theme);
  assert.equal(routes.length, 5, `${theme} route count`);
  assert.equal(new Set(routes.map(route => route.placeIds.join('>'))).size, 5, `${theme} routes are distinct`);
  if (theme === 'cafe') {
    assert.ok(routes.every(route => route.placeIds.every(id => places.get(id)?.category === 'cafe')),
      'cafe-tour candidates contain cafes only, with no meal stops');
  }
  if (theme === 'history') {
    assert.ok(routes.every(route => route.placeIds.some(id => places.get(id)?.category === 'food')),
      'history candidates include a realistic nearby meal stop');
  }
}
for (const route of data.routes) {
  assert.equal(route.legs.length, route.placeIds.length - 1, `${route.id} has every adjacent leg`);
  assert.deepEqual(route.legs.map(leg => leg.from), route.placeIds.slice(0,-1), `${route.id} leg origins match stop order`);
  assert.deepEqual(route.legs.map(leg => leg.to), route.placeIds.slice(1), `${route.id} leg destinations match stop order`);
  assert.ok(route.legs.every(leg => leg.routeUrl.startsWith('https://way-m.map.naver.com/')),
    `${route.id} has direct Naver directions for every leg`);
  assert.ok(route.legs.every(leg => ['walk','transit'].includes(leg.mode) && leg.minutes > 0),
    `${route.id} has a checked mode and duration for every leg`);
  assert.ok(route.legs.filter(leg => leg.mode === 'walk').every(leg => Number.isFinite(leg.meters) && leg.meters <= 1600),
    `${route.id} has no walking segment longer than 1.6 km`);
  assert.ok(route.legs.filter(leg => leg.mode === 'transit').every(leg => leg.buses),
    `${route.id} names the checked transit line(s)`);
  assert.equal(route.mapPathStatus, '각 인접 구간 네이버 길찾기 확인 완료');
  assert.match(route.operatingStatus, /미완료/);
}
console.log(JSON.stringify({
  passed:true,
  routeCount:data.routes.length,
  routesByTheme:data.routesByTheme,
  routeLegUses:data.routes.reduce((sum,route)=>sum+route.legs.length,0),
  uniqueDirectedLegs:new Set(data.routes.flatMap(route=>route.legs.map(leg=>`${leg.from}>${leg.to}`))).size,
  allWalkSegmentsAtMost1600m:true,
  operatingScheduleReview:'pending; data does not label these routes fully verified'
}, null, 2));
