const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const design = JSON.parse(fs.readFileSync(path.join(__dirname, 'qa', 'gangneung-market-first-route-design-2026-10-07.json'), 'utf8'));
const output = path.join(__dirname, 'qa', 'gangneung-market-route-geometry-2026-10-07.geojson');
const stopIds = ['g27', 'g8', 'g26', 'g1', 'g72', 'g7'];
if (design.status !== 'design-only' || design.places.map((place) => place.id).join(',') !== stopIds.join(',')) {
  throw new Error('시장 첫 코스의 장소 선정·순서가 바뀌었습니다.');
}

function decodePolyline6(encoded) {
  const points = [];
  let index = 0, latitude = 0, longitude = 0;
  while (index < encoded.length) {
    let value = 0, shift = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; value |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    latitude += value & 1 ? ~(value >> 1) : value >> 1;
    value = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; value |= (byte & 31) << shift; shift += 5; } while (byte >= 32);
    longitude += value & 1 ? ~(value >> 1) : value >> 1;
    points.push([longitude / 1e6, latitude / 1e6]);
  }
  return points;
}

function metersBetween(a, b) {
  const toRadians = Math.PI / 180;
  const latDelta = (b[1] - a[1]) * toRadians;
  const lonDelta = (b[0] - a[0]) * toRadians;
  const h = Math.sin(latDelta / 2) ** 2 + Math.cos(a[1] * toRadians) *
    Math.cos(b[1] * toRadians) * Math.sin(lonDelta / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

async function main() {
  const request = {
    locations: design.places.map((place) => ({lat:place.lat,lon:place.lon})),
    costing: 'pedestrian', units: 'kilometers', shape_format: 'polyline6'
  };
  const sourceUrl = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(request))}`;
  const response = await fetch(sourceUrl);
  const payload = await response.json();
  if (!response.ok || payload.trip?.legs?.length !== stopIds.length - 1) {
    throw new Error(`보행 경로 응답을 확인할 수 없습니다: ${JSON.stringify(payload).slice(0, 220)}`);
  }

  const coordinates = [];
  const stopPointIndices = [0];
  const legs = [];
  payload.trip.legs.forEach((leg, index) => {
    const points = decodePolyline6(leg.shape);
    if (points.length < 2) throw new Error(`${stopIds[index]}→${stopIds[index + 1]} 길선이 비어 있습니다.`);
    const start = design.places[index], end = design.places[index + 1];
    if (metersBetween(points[0], [start.lon, start.lat]) > 30 ||
        metersBetween(points.at(-1), [end.lon, end.lat]) > 30) {
      throw new Error(`${stopIds[index]}→${stopIds[index + 1]} 길선이 장소 대표점과 30m 이상 떨어져 있습니다.`);
    }
    if (index && metersBetween(coordinates.at(-1), points[0]) < 2) points.shift();
    coordinates.push(...points);
    stopPointIndices.push(coordinates.length - 1);
    legs.push({from:stopIds[index],to:stopIds[index+1],meters:Math.round(leg.summary.length * 1000),seconds:Math.round(leg.summary.time)});
  });

  const result = {
    type:'Feature',
    geometry:{type:'LineString',coordinates},
    properties:{
      id:'gangneung-market-first-route-2026-10-07',
      status:'routing-preview; entrance and market-interior access unconfirmed',
      label:'시장·먹거리 첫 코스',
      stopIds,
      stopPointIndices,
      meters:Math.round(payload.trip.summary.length * 1000),
      seconds:Math.round(payload.trip.summary.time),
      legs,
      routingProvider:'Valhalla public pedestrian routing using OpenStreetMap',
      routingSourceUrl:sourceUrl,
      attribution:'© OpenStreetMap contributors',
      checkedOn:'2026-10-07',
      note:'대표 좌표까지의 OSM 보행망 검토 경로다. 관아·굿즈임당의 실제 출입문, 시장 내부 통로 및 월화교 진입점은 현장 확인 전이다. 앱 추천 경로에는 등록하지 않았다.'
    }
  };
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({meters:result.properties.meters,pointCount:coordinates.length,stopPointIndices,legs},null,2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
