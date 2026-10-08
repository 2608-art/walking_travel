import assert from 'node:assert/strict';
import fs from 'node:fs';
import { titleNamedPlaceIds, updateStatus } from './theme-route-refresh-core.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'));
const data = read('theme-route-updates.json');
const features = read('theme-route-updates.geojson').features;
const gpx = fs.readFileSync(new URL('../public/theme-route-updates.gpx', import.meta.url), 'utf8');
const maps = Object.fromEntries(Object.entries({ mokpo:'places.json', gangneung:'gangneung-places.json', gyeongju:'gyeongju-places.json' })
  .map(([region, name]) => [region, read(name).places]));
assert.equal(data.version, 1);
assert.equal(features.length, data.overrides.length);
assert.equal((gpx.match(/<trk>/g) || []).length, data.overrides.length);
const windows = new Map();
for (const route of data.overrides) {
  assert(route.validFrom <= route.validThrough, `${route.id}: invalid date range`);
  assert.equal(route.weekdays.length, 1, `${route.id}: date-specific update must have one weekday`);
  assert.equal(route.legs.length, Math.max(0, route.stops.length - 1), `${route.id}: stop/leg mismatch`);
  assert(route.busCount <= 3, `${route.id}: bus limit exceeded`);
  assert.equal(route.status, updateStatus({ count: route.stops.length,
    issues: route.issues.filter((issue) => !/방문지 5~7곳|방문지 4곳 이하/.test(issue)),
    titleMissing: route.sourceChange.titleNamedPlaceMissing }), `${route.id}: status policy mismatch`);
  if (route.status === 'walking-geometry-checked') {
    assert(route.stops.length >= 8, `${route.id}: checked route has too few stops`);
    assert.equal(route.issues.length, 0, `${route.id}: checked route still has issues`);
    const named = titleNamedPlaceIds(route.title, maps[route.region]);
    assert(named.every((id) => route.stops.some((stop) => stop.placeId === id)), `${route.id}: title place missing`);
    assert.equal(route.operatingHoursStatus, 'estimated-visit-time-checked; real-day-exceptions-unverified');
  }
  for (const leg of route.legs.filter((item) => item.mode === 'walk')) {
    if (route.status === 'walking-geometry-checked') assert.equal(leg.status, 'api-routed');
    if (leg.status === 'api-routed') assert(leg.coordinates.length > 1, `${route.id}: empty walking line`);
  }
  const feature = features.find((item) => item.id === route.id);
  assert(feature, `${route.id}: GeoJSON missing`);
  assert.deepEqual(feature.geometry.coordinates,
    route.legs.filter((leg) => leg.mode === 'walk' && leg.coordinates?.length > 1).map((leg) => leg.coordinates), `${route.id}: GeoJSON mismatch`);
  const key = `${route.region}/${route.themeId}/${route.weekdays[0]}`;
  const earlier = windows.get(key) || [];
  assert(!earlier.some((item) => item.from <= route.validThrough && route.validFrom <= item.through), `${route.id}: overlapping date updates`);
  earlier.push({ from: route.validFrom, through: route.validThrough }); windows.set(key, earlier);
}
console.log(JSON.stringify({ overrides: data.overrides.length,
  recommended: data.overrides.filter((route) => route.status === 'walking-geometry-checked').length,
  review: data.overrides.filter((route) => route.status === 'needs-review').length,
  suppressed: data.overrides.filter((route) => route.status === 'suppressed').length }));
