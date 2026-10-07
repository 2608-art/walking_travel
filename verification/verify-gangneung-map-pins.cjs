const assert = require('node:assert/strict');
const fs = require('node:fs');

const places = JSON.parse(fs.readFileSync('public/gangneung-places.json', 'utf8')).places;
const byId = new Map(places.map(place => [place.id, place]));
const files = [
  '지도핀-음식시장-검증.json',
  '지도핀-카페책방-검증.json',
  '지도핀-자연문화체험-검증.json',
  '지도핀-음식재검증.json',
  '지도핀-카페소품-재검증.json',
  '지도핀-권역체험-재검증.json'
];
const root = '한걸음/docs/지역/강릉/';
const matched = [];
const unresolved = [];
for (const file of files) {
  const audit = JSON.parse(fs.readFileSync(root + file, 'utf8'));
  matched.push(...audit.matches);
  unresolved.push(...audit.unresolved);
}
assert.equal(places.length, 300);
assert.equal(new Set(matched.map(match => match.id)).size, matched.length);
assert.equal(matched.length, 261);
for (const match of matched) {
  const place = byId.get(match.id);
  assert.equal(place?.name, match.name, `${match.id} name`);
  assert.equal(place.mapLat, match.mapLat, `${match.id} latitude`);
  assert.equal(place.mapLon, match.mapLon, `${match.id} longitude`);
  assert.equal(place.mapPinSource, match.source, `${match.id} source`);
  assert.equal(place.lat, null, `${match.id} route latitude remains unverified`);
  assert.equal(place.lon, null, `${match.id} route longitude remains unverified`);
}
const resolved = new Set(matched.map(match => match.id));
for (const pending of unresolved) {
  if (pending.id === 'g15' || resolved.has(pending.id)) continue; // Existing pin or resolved by follow-up.
  const place = byId.get(pending.id);
  assert.ok(place, `${pending.id} unresolved place still listed`);
  assert.ok(place.lat === null && place.mapLat == null, `${pending.id} unresolved pin must stay absent`);
}
const pinned = places.filter(place =>
  Number.isFinite(place.lat) && Number.isFinite(place.lon) ||
  Number.isFinite(place.mapLat) && Number.isFinite(place.mapLon));
assert.equal(pinned.length, 294);
assert.equal(places.filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon)).length, 31);
console.log(`PASS: ${pinned.length}/300 Gangneung map pins; ${matched.length} new map-only points, ${300 - pinned.length} unresolved.`);
