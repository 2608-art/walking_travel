import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { changedMaterialIds, changedWindows, isUnavailable, materialInput, titleNamedPlaceIds, updateStatus, validateAvailability } from './theme-route-refresh-core.mjs';

const place = { id: 'x', name: '불국사', lat: 35.8, lon: 129.3, hours: { open: '09:00', close: '18:00' } };
assert.deepEqual(changedMaterialIds({ x: materialInput(place) }, { x: materialInput({ ...place, priceInfo: { price: '12,000원' } }) }), [], 'price change should not reroute');
assert.deepEqual(changedMaterialIds({ x: materialInput(place) }, { x: materialInput({ ...place, availability: { status: 'construction', from: '2026-10-08', through: '2026-10-10' } }) }), ['x']);
assert.deepEqual(changedWindows(['x'], new Map([['x', { ...place, hours: { open: '11:00', close: '18:00' } }]]),
  { x: materialInput(place) }, '2026-10-08'), [{ from: '2026-10-08', through: '9999-12-31' }],
  'opening-hour change should trigger a new route window');
assert(isUnavailable({ ...place, availability: { status: 'construction', from: '2026-10-08', through: '2026-10-10' } }, '2026-10-09'));
assert(!isUnavailable(place, '2026-10-09'));
assert.throws(() => validateAvailability({ ...place, availability: { status: 'construction', from: '2026-10-08' } }), /source URL/);
assert.deepEqual(titleNamedPlaceIds('불국사 마을', [place]), ['x']);
assert.deepEqual(titleNamedPlaceIds('불국사거리', [place]), []);
assert.deepEqual(titleNamedPlaceIds('동궁과 월지·밤 산책', [{ id: 'y', name: '동궁과 월지' }]), ['y']);
assert.equal(updateStatus({ count: 4, issues: [], titleMissing: false }), 'suppressed');
assert.equal(updateStatus({ count: 6, issues: [], titleMissing: false }), 'needs-review');
assert.equal(updateStatus({ count: 8, issues: [], titleMissing: true }), 'needs-review');
assert.equal(updateStatus({ count: 8, issues: [], titleMissing: false }), 'walking-geometry-checked');

// Exercise the build-time refresh against an isolated copy, preserving the user's source files.
const base = fs.realpathSync('verification');
const temp = fs.mkdtempSync(path.join(base, '.tmp-route-refresh-'));
assert(temp.startsWith(base + path.sep), 'temporary checkout must stay inside verification');
try {
  fs.mkdirSync(path.join(temp, 'public'));
  fs.mkdirSync(path.join(temp, 'scripts'));
  for (const name of ['places.json','gangneung-places.json','gyeongju-places.json','theme-weekday-routes.json',
    'theme-courses.json','gangneung-theme-review-routes.json','gyeongju-six-theme-routes.geojson',
    'theme-route-updates.json','theme-place-drafts.json','gangneung-theme-place-picks.json','gyeongju-theme-candidates.geojson'])
    fs.copyFileSync(path.join('public', name), path.join(temp, 'public', name));
  for (const name of ['theme-route-refresh-core.mjs','refresh-theme-route-changes.mjs','verify-theme-route-updates.mjs'])
    fs.copyFileSync(path.join('scripts', name), path.join(temp, 'scripts', name));
  const file = path.join(temp, 'public', 'gyeongju-places.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const target = data.places.find((item) => item.id === 'j17');
  target.availability = { status: 'construction', from: '2026-10-08', through: '2026-10-09',
    source: 'https://example.com/test-fixture', checkedAt: '2026-10-08' };
  fs.writeFileSync(file, JSON.stringify(data));
  const run = spawnSync(process.execPath, ['scripts/refresh-theme-route-changes.mjs'], { cwd: temp, encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(fs.readFileSync(path.join(temp, 'public', 'theme-route-updates.json'), 'utf8'));
  const verifyFirst = spawnSync(process.execPath, ['scripts/verify-theme-route-updates.mjs'], { cwd: temp, encoding: 'utf8' });
  assert.equal(verifyFirst.status, 0, verifyFirst.stderr || verifyFirst.stdout);
  const changed = result.overrides.filter((route) => route.region === 'gyeongju' && route.themeId === 'bulguksa' &&
    route.validFrom <= '2026-10-08' && route.validThrough >= '2026-10-08');
  assert(changed.length, 'Bulguksa closure should create date-specific alternatives');
  assert(changed.some((route) => route.sourceChange.unavailablePlaceIds.includes('j17')));
  assert(changed.every((route) => route.status !== 'walking-geometry-checked'), 'title named Bulguksa must not be silently recommended');
  const laterData = JSON.parse(fs.readFileSync(file, 'utf8'));
  laterData.places.find((item) => item.id === 'j103').availability = {
    status: 'construction', from: '2026-10-08', through: '2026-10-09',
    source: 'https://example.com/second-test-fixture', checkedAt: '2026-10-08' };
  fs.writeFileSync(file, JSON.stringify(laterData));
  const later = spawnSync(process.execPath, ['scripts/refresh-theme-route-changes.mjs'], { cwd: temp, encoding: 'utf8', timeout: 120000 });
  assert.equal(later.status, 0, later.stderr || later.stdout);
  const laterRoutes = JSON.parse(fs.readFileSync(path.join(temp, 'public', 'theme-route-updates.json'), 'utf8')).overrides;
  const verifyLater = spawnSync(process.execPath, ['scripts/verify-theme-route-updates.mjs'], { cwd: temp, encoding: 'utf8' });
  assert.equal(verifyLater.status, 0, verifyLater.stderr || verifyLater.stdout);
  assert(laterRoutes.some((route) => route.themeId === 'hwangridan' &&
    route.sourceChange.replacements.some((item) => item.removed === 'j103')),
    'same-theme verified candidate should replace a closed stop when reachable');
  assert(laterRoutes.some((route) => route.themeId === 'bulguksa'), 'unrelated existing closure alternatives must be retained');
  const saved = fs.readFileSync(path.join(temp, 'public', 'theme-route-updates.json'), 'utf8');
  const second = spawnSync(process.execPath, ['scripts/refresh-theme-route-changes.mjs'], { cwd: temp, encoding: 'utf8', timeout: 120000 });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(fs.readFileSync(path.join(temp, 'public', 'theme-route-updates.json'), 'utf8'), saved,
    'no material change must reuse saved route output');
  console.log(JSON.stringify({ closureAlternatives: changed.length, status: [...new Set(changed.map((route) => route.status))],
    replacementRoutes: laterRoutes.filter((route) => route.themeId === 'hwangridan').length, unchangedBuildReused: true }));
} finally {
  const resolved = fs.realpathSync(temp);
  assert(resolved.startsWith(base + path.sep), 'recursive cleanup target must stay inside verification');
  fs.rmSync(resolved, { recursive: true, force: true });
}
