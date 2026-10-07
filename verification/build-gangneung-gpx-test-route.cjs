const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const source = path.join(__dirname, 'fixtures', 'gangneung-gpx-test-2026-10-07.gpx');
const target = path.join(root, 'verification', 'qa', 'gangneung-gpx-test-route-2026-10-07.json');
const bytes = fs.readFileSync(source);
const xml = bytes.toString('utf8');
const points = [...xml.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g)]
  .map((match) => [Number(match[1]), Number(match[2])]);

if (points.length !== 29 || points.some(([lat, lon]) => !Number.isFinite(lat) || !Number.isFinite(lon))) {
  throw new Error('사용자가 제공한 GPX 경로점 29개를 확인할 수 없습니다.');
}

const radians = Math.PI / 180;
let meters = 0;
for (let index = 1; index < points.length; index++) {
  const [latA, lonA] = points[index - 1];
  const [latB, lonB] = points[index];
  const latDelta = (latB - latA) * radians;
  const lonDelta = (lonB - lonA) * radians;
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(latA * radians) * Math.cos(latB * radians) * Math.sin(lonDelta / 2) ** 2;
  meters += 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

const data = {
  id: 'gangneung-gpx-test-2026-10-07',
  label: '강릉 GPX 시험 경로',
  status: 'local-preview-only',
  source: 'verification/fixtures/gangneung-gpx-test-2026-10-07.gpx',
  sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  checkedOn: '2026-10-07',
  lengthMeters: Math.round(meters),
  coordinateOrder: 'lat,lon',
  note: '앱 길선 표시 시험 전용. 대도호부 관아·굿즈임당·월화교 대표 핀과 일치하지 않아 추천 코스에 사용하지 않는다.',
  points,
};
fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
console.log(`${data.label}: ${points.length} points, ${data.lengthMeters} m`);
