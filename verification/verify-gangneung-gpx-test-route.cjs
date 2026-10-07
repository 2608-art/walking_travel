const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const original = fs.readFileSync(path.join(__dirname, 'fixtures', 'gangneung-gpx-test-2026-10-07.gpx'));
const route = JSON.parse(fs.readFileSync(path.join(root, 'verification', 'qa', 'gangneung-gpx-test-route-2026-10-07.json')));
const saved = JSON.parse(fs.readFileSync(path.join(root, 'public', 'walk-paths.json')));
const sourcePoints = [...original.toString('utf8').matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g)]
  .map((match) => [Number(match[1]), Number(match[2])]);

assert.equal(route.status, 'local-preview-only');
assert.equal(route.label, '강릉 GPX 시험 경로');
assert.equal(route.sourceSha256, crypto.createHash('sha256').update(original).digest('hex'));
assert.equal(sourcePoints.length, 29);
assert.deepEqual(route.points, sourcePoints, 'GPX의 경로점 29개가 순서대로 보존돼야 합니다.');
assert.equal(route.lengthMeters, 1279);
assert.equal(saved.paths.some((item) => item.source?.label?.includes('GPX 시험 경로')), false,
  '시험 경로를 추천용 저장 도보 구간에 넣지 않습니다.');
console.log('PASS: 원본 GPX 해시·29개 좌표·거리 일치, 추천 경로 목록과 분리됨.');
