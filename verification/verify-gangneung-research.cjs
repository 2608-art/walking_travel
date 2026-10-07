const assert = require('node:assert/strict');
const fs = require('node:fs');

const data = JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8'));
const places = data.places;
const categories = new Set(['food','cafe','outdoors','culture','experience','market','books']);
const ids = new Set();
for (const p of places) {
  assert.ok(!ids.has(p.id),`duplicate ${p.id}`);
  ids.add(p.id);
  assert.ok(categories.has(p.category),`${p.id} category`);
  for (const field of ['name','locationText','source','description','scheduleText','closureText','scheduleSource']) {
    assert.ok(p[field]?.trim(),`${p.id} ${field}`);
  }
  assert.ok(p.source.startsWith('https://') && p.scheduleSource.startsWith('https://'),`${p.id} source URL`);
  if (p.hours) {
    assert.match(p.hours.open,/^\d{2}:\d{2}$/,`${p.id} open`);
    assert.match(p.hours.close,/^\d{2}:\d{2}$/,`${p.id} close`);
    assert.ok(p.hours.source?.startsWith('https://'),`${p.id} hours source`);
  }
  if (p.priceInfo) {
    assert.ok(p.priceInfo.label && p.priceInfo.price && p.priceInfo.checked === data.updated,`${p.id} price provenance`);
    assert.ok(p.priceInfo.source?.startsWith('https://'),`${p.id} price source`);
    if (p.priceInfo.comparisonSource) assert.ok(p.priceInfo.comparisonSource.startsWith('https://'),`${p.id} comparison source`);
  }
  if (p.menuItems) assert.ok(p.menuItems.every(x=>x.label && x.price),`${p.id} menu items`);
  if (p.mapRating) {
    assert.ok(p.mapRating.score > 0 && p.mapRating.score <= 5,`${p.id} map rating range`);
    assert.ok(p.mapRating.reviewCount > 0 && p.mapRating.source.startsWith('https://place.map.kakao.com/'),`${p.id} map rating provenance`);
  }
  assert.equal(p.lat === null,p.lon === null,`${p.id} coordinate pair`);
}
const byId = id => places.find(p=>p.id===id);
assert.ok(places.length > 130,`expected a broader Gangneung set, found ${places.length}`);
assert.ok(places.length <= 300,`Gangneung app limit exceeded: ${places.length}`);
assert.equal(new Set(places.map(p=>p.name.replaceAll(/\s/g,''))).size,places.length,'duplicate normalized place name');
assert.equal(places.filter(p=>Number(p.id.slice(1))>=37 && p.lat!==null).length,3);
assert.ok(places.filter(p=>p.mapRating).length >= 10,'map rating cross-checks');
assert.ok(!places.some(p=>['food','market'].includes(p.category) && p.mapRating?.score < 4),'confirmed low-rated food must be replaced');
assert.ok(!places.some(p=>['현대장칼국수 본점','금학칼국수','이만구교동짬뽕','정남미명과 강릉본점','명성오징어순대','형제칼국수','강릉불고기 초당점','모자호떡','삼교리동치미막국수 강릉포남점'].includes(p.name)),'lowest-rated food replacements');
assert.ok(places.some(p=>p.name==='서울양계'&&p.mapRating?.score===4.3),'Seoul Yang-gye Kakao verification');
assert.ok(places.some(p=>p.name==='베리베리딸기'&&p.mapRating?.score===4.9),'Berry Berry Kakao verification');
assert.ok(!places.some(p=>p.name==='장미경양식'),'duplicate Jungang Market restaurant alias');
assert.ok(!byId('g28').hours && !byId('g30').hours,'conflicting schedules cannot drive recommendations');
assert.match(byId('g19').closureText,/월요일이 공휴일이면 개관/);
assert.match(byId('g50').scheduleText,/2026-05-01~10-31/);
assert.ok(!byId('g13'),'Ojukheon exhibits must remain one visit');
console.log(`PASS: Gangneung ${places.length} places, seven categories, map rating provenance and conflict guards.`);
