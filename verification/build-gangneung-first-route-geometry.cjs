const fs = require('node:fs');

const qaFile = 'verification/qa/gangneung-theme-routes-naver-2026-10-07.json';
const geometryFile = 'verification/qa/gangneung-first-route-geometry-2026-10-07.json';
const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
const places = new Map(JSON.parse(fs.readFileSync('public/gangneung-places.json', 'utf8')).places.map(place => [place.id, place]));
const candidate = qa.routes.find(route => route.id === 'food-01');
if (!candidate) throw new Error('강문·초당 첫 후보(food-01)가 없습니다.');

function routePoint(place) {
  const lat = Number.isFinite(place.lat) ? place.lat : place.mapLat;
  const lon = Number.isFinite(place.lon) ? place.lon : place.mapLon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`${place.id} 좌표를 확인할 수 없습니다.`);
  return {lat, lon};
}

function decodePolyline6(encoded) {
  let index = 0, lat = 0, lon = 0;
  const points = [];
  while (index < encoded.length) {
    let result = 0, shift = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lon / 1e6, lat / 1e6]);
  }
  return points;
}

function endpointNear(point, endpoint) {
  return Math.abs(point[0] - endpoint.lon) < 0.0005 && Math.abs(point[1] - endpoint.lat) < 0.0005;
}

async function main() {
  const generated = [];
  for (const leg of candidate.legs) {
    if (leg.mode !== 'walk') throw new Error(`${leg.from}>${leg.to}는 보행 구간이 아닙니다.`);
    const fromPlace = places.get(leg.from), toPlace = places.get(leg.to);
    const from = routePoint(fromPlace), to = routePoint(toPlace);
    const request = {locations:[from,to],costing:'pedestrian',units:'kilometers',shape_format:'polyline6'};
    const geometryUrl = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(request))}`;
    const response = await fetch(geometryUrl);
    const payload = await response.json();
    if (!response.ok || !payload.trip?.legs?.[0]?.shape) throw new Error(`Valhalla 보행 경로 실패 (${leg.from}>${leg.to}): ${JSON.stringify(payload).slice(0,240)}`);
    const geometryLeg = payload.trip.legs[0];
    const points = decodePolyline6(geometryLeg.shape);
    if (points.length < 2 || !endpointNear(points[0],from) || !endpointNear(points.at(-1),to)) {
      throw new Error(`${leg.from}>${leg.to} geometry의 시작·끝 좌표가 장소 대표점과 맞지 않습니다.`);
    }
    const meters = Math.round(payload.trip.summary.length * 1000);
    const minutes = Math.max(1, Math.ceil(payload.trip.summary.time / 60));
    const naverDifferencePercent = leg.meters ? Math.round(Math.abs(meters - leg.meters) / leg.meters * 100) : null;
    generated.push({
      from:{id:leg.from,lat:from.lat,lon:from.lon},
      to:{id:leg.to,lat:to.lat,lon:to.lon},
      source:{
        label:'OpenStreetMap 보행 길선(Valhalla) · 네이버 길찾기 대조',
        url:geometryUrl,
        naverUrl:leg.routeUrl
      },
      verification:{
        checkedOn:'2026-10-07',
        geometryProvider:'Valhalla public routing service using OpenStreetMap pedestrian network',
        geometrySourceUrl:geometryUrl,
        geometryDistanceMeters:meters,
        geometryMinutes:minutes,
        geometryPointCount:points.length,
        naverMap:{meters:leg.meters,minutes:leg.minutes,url:leg.routeUrl},
        naverDistanceDifferencePercent:naverDifferencePercent,
        naverComparisonStatus:naverDifferencePercent !== null && naverDifferencePercent <= 25
          ? '거리 차이 25% 이내; 두 지도 서비스의 경로선은 별도 출처'
          : `거리 차이 ${naverDifferencePercent}%로 큼; 두 경로의 통행 구간·출입구를 추가 대조해야 함`,
        note:'보행 길선 좌표는 OSM/Valhalla에서 받았고, 네이버 지도는 별도로 해당 장소 사이의 보행 가능 경로·거리·시간을 확인하는 데 사용했다. 경로선 geometry 자체는 네이버 자료가 아니다. 대표 좌표와 실제 출입구 차이는 미확인.'
      },
      variants:[{id:`osm-valhalla-${leg.from}-${leg.to}`,label:'OSM 보행 길선(Valhalla)',meters,minutes,points}]
    });
  }
  const artifact={
    route:candidate.id,
    checkedOn:'2026-10-07',
    status:'comparison-only; not enabled in app route catalog',
    enableForApp:false,
    reason:'OSM/Valhalla and Naver Map segment lengths differ by more than 25% on four of five legs; Naver UI does not export path geometry. Keep every OSM geometry candidate out of the solid app route catalog until corridor and entrance discrepancies are reviewed.',
    paths:generated
  };
  fs.writeFileSync(geometryFile,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({route:candidate.id,comparisonOnly:true,enableForApp:false,geometryLegs:generated.length,points:generated.map(path=>({from:path.from.id,to:path.to.id,count:path.variants[0].points.length,meters:path.variants[0].meters,minutes:path.variants[0].minutes,naverMeters:path.verification.naverMap.meters,naverMinutes:path.verification.naverMap.minutes,distanceDifferencePercent:path.verification.naverDistanceDifferencePercent,comparison:path.verification.naverComparisonStatus}))},null,2));
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
