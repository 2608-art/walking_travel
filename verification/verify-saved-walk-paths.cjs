const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {module: {exports: {}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/saved-walk-paths.js'), 'utf8'), context);
const savedPaths = context.module.exports;
const from = {id: 'lodging-1', lat: 34.79, lon: 126.38};
const to = {id: 'station', lat: 34.791, lon: 126.381};
const short = [[from.lon, from.lat], [to.lon, to.lat]];
const around = [[from.lon, from.lat], [126.379, 34.7905], [to.lon, to.lat]];
const segment = {
  from, to,
  source: {label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright'},
  variants: [
    {id: 'short', label: '지름길', meters: 180, minutes: 3, points: short},
    {id: 'around', label: '돌아가는 길', meters: 260, minutes: 5, points: around},
  ],
};

savedPaths.setCatalog({version: 1, paths: [segment]});
assert.equal(savedPaths.options(from, to).length, 2);
assert.equal(savedPaths.select(from, to).savedPathId, 'short');
assert.equal(savedPaths.select(from, to, 'around').savedPathId, 'around');
assert.equal(savedPaths.select(to, from), null);
assert.equal(savedPaths.select({...from, lat: from.lat + .001}, to), null);
assert.throws(() => savedPaths.setCatalog({version: 1, paths: [{...segment, variants: [{...segment.variants[0], points: [[126.3, 34.7], [to.lon, to.lat]]}]}]}), /좌표/);

const production = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/walk-paths.json'), 'utf8'));
assert.equal(production.version, 1);
assert.equal(production.paths.length, 0);
console.log('PASS: two saved routes, reverse/coordinate mismatch rejection, no fabricated production paths.');
