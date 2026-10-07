const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname,'..');
const window = {};
const context = vm.createContext({window});
for (const file of ['public/place-media.js','public/gangneung-media.js','public/gangneung-media-expansion.js','public/gangneung-media-audit.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const places = JSON.parse(fs.readFileSync(path.join(root,'public/gangneung-places.json'),'utf8')).places;
const ids = new Set(places.map(place=>place.id));
let photos = 0;
let examples = 0;
for (const place of places) {
  const actual = window.HANGEORUM_PLACE_MEDIA[place.id];
  const example = window.HANGEORUM_PLACE_EXAMPLE_MEDIA[place.id];
  assert.ok(Boolean(actual) !== Boolean(example),`${place.id} needs exactly one photo class`);
  const item = actual || example;
  assert.equal(item.kind,actual ? 'photo' : 'example');
  assert.ok(item.source?.startsWith('https://'),`${place.id} source`);
  assert.ok(item.credit && item.alt,`${place.id} credit and alt`);
  if (example) assert.match(item.alt,/실제|미확인|아닙니다/,`${place.id} example disclosure`);
  const file = path.resolve(root,'public',item.src);
  assert.ok(file.startsWith(path.resolve(root,'public','assets','photos') + path.sep),`${place.id} photo path`);
  assert.ok(fs.statSync(file).size > 10000,`${place.id} image file`);
  if (actual) photos++; else examples++;
}
for (const id of Object.keys(window.HANGEORUM_PLACE_MEDIA).concat(Object.keys(window.HANGEORUM_PLACE_EXAMPLE_MEDIA))) {
  if (id.startsWith('g')) assert.ok(ids.has(id),`stale media ${id}`);
}
assert.equal(photos,25);
assert.equal(examples,places.length - photos);
console.log(`PASS: Gangneung ${photos} actual-place photos, ${examples} labeled examples, all ${places.length} places covered.`);
