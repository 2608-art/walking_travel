import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => JSON.parse(fs.readFileSync(`public/${file}`, 'utf8'));
const data = read('theme-weekday-routes.json');
const geojson = read('theme-weekday-routes.geojson');
const gpx = fs.readFileSync('public/theme-weekday-routes.gpx', 'utf8');
const byTheme = new Map();

assert.equal(data.routes.length, geojson.features.length);
assert.equal((gpx.match(/<trk>/g) || []).length, data.routes.length);
for (const route of data.routes) {
  const theme = `${route.region}/${route.themeId}`;
  const counts = byTheme.get(theme) || Array(7).fill(0);
  for (const day of route.weekdays) counts[day]++;
  byTheme.set(theme, counts);
  assert.equal(route.legs.length, route.stops.length - 1, `${route.id}: leg count`);
  assert(route.busCount <= 3, `${route.id}: too many buses`);
  for (const leg of route.legs.filter((item) => item.mode === 'bus')) {
    assert(Object.hasOwn(leg, 'busRideMinutes') && Object.hasOwn(leg, 'accessWalkMinutes'), `${route.id}: bus ride and access walk must be separate`);
    if (leg.busRideMinutes != null) assert(leg.busRideMinutes <= 30, `${route.id}: bus ride over 30 minutes`);
  }
  if (route.placeCountException?.candidate?.mode === 'bus') {
    const candidate = route.placeCountException.candidate;
    assert(candidate.busRideMinutes <= 30 && candidate.busRideWithin30Minutes, `${route.id}: bus candidate ride exceeds 30 minutes`);
    assert(candidate.accessWalkMinutes == null || candidate.accessWalkMinutes >= 0, `${route.id}: access walk must be separately measured`);
  }
  const lines = route.legs.filter((leg) => leg.mode === 'walk').map((leg) => {
    assert.equal(leg.status, 'api-routed', `${route.id}: missing walking API line`);
    assert(leg.coordinates.length > 1, `${route.id}: empty walking line`);
    assert(Math.max(leg.snapStartMeters, leg.snapEndMeters) <= 80, `${route.id}: pin too far from walking network`);
    return leg.coordinates;
  });
  const feature = geojson.features.find((item) => item.id === route.id);
  assert(feature, `${route.id}: GeoJSON feature missing`);
  assert.deepEqual(feature.geometry.coordinates, lines, `${route.id}: GeoJSON line mismatch`);
  assert.equal(feature.properties.walkMeters, route.walkMeters);
  for (const fallback of route.mealFallbacks || []) {
    assert(fallback.minutes > 15 && fallback.minutes <= 30, `${route.id}: invalid meal walk exception`);
    assert(route.stops.some((stop) => stop.placeId === fallback.placeId), `${route.id}: unknown meal exception`);
  }
  if (route.status === 'walking-geometry-checked') {
    assert.deepEqual(route.issues, [], `${route.id}: checked route has issues`);
    assert(route.stops.length >= 5 && route.stops.length <= 15, `${route.id}: stop count`);
    assert(route.walkMeters <= 8000, `${route.id}: daily walking limit`);
  } else assert(route.issues.length > 0, `${route.id}: review state needs a reason`);
}
assert.equal(byTheme.size, 17);
for (const [theme, days] of byTheme) assert.deepEqual(days, Array(7).fill(1), `${theme}: weekday coverage`);
assert.equal((gpx.match(/<trkseg>/g) || []).length,
  data.routes.reduce((sum, route) => sum + route.legs.filter((leg) => leg.mode === 'walk').length, 0));
console.log(JSON.stringify({ themes: byTheme.size, groups: data.routes.length,
  apiWalkingGeometry: data.routes.length,
  checked: data.routes.filter((route) => route.status === 'walking-geometry-checked').length,
  needsReview: data.routes.filter((route) => route.status === 'needs-review').length }));
