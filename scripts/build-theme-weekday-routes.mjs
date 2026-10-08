import fs from 'node:fs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'));
const audit = JSON.parse(fs.readFileSync(new URL('../verification/qa/theme-weekday-audit-2026-10-08.json', import.meta.url), 'utf8'));
const placeMaps = Object.fromEntries(['mokpo', 'gangneung', 'gyeongju'].map((region) => [
  region, new Map(read(region === 'mokpo' ? 'places.json' : `${region}-places.json`).places.map((place) => [place.id, place]))
]));
const gangneung = new Map(read('gangneung-theme-review-routes.json').routes.map((route) => [route.themeId, route]));
const gyeongju = new Map(read('gyeongju-six-theme-routes.geojson').features.map((feature) => [feature.properties.themeId, feature]));
const endpoint = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cache = new Map();
const previous = new Map();
try {
  for (const route of read('theme-weekday-routes.json').routes || []) previous.set(route.id, route);
} catch { /* First build has no saved route geometry. */ }
let requestCount = 0;

function coordinate(place) {
  const lat = place?.lat, lon = place?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`Missing coordinates: ${place?.id}`);
  return [lon, lat];
}

function breakAfter(region, themeId, stops) {
  const breaks = new Set();
  if (region === 'gangneung') {
    const route = gangneung.get(themeId);
    for (let index = 0; index < route.legs.length; index++) if (route.legs[index].mode === 'transit') breaks.add(index);
  }
  if (region === 'gyeongju' && themeId === 'bulguksa') {
    const original = gyeongju.get(themeId).properties;
    for (let index = 0; index < stops.length - 1; index++) {
      const a = stops[index], b = stops[index + 1];
      if (!original.stops.some((stop) => stop.placeId === a.placeId) ||
          !original.stops.some((stop) => stop.placeId === b.placeId)) breaks.add(index);
    }
  }
  return breaks;
}

async function routeChunk(stops) {
  const key = stops.map((stop) => stop.placeId).join('|');
  if (cache.has(key)) return cache.get(key);
  const coordinates = stops.map((stop) => coordinate(stop));
  const path = coordinates.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const url = `${endpoint}${path}?overview=full&geometries=geojson&steps=true`;
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Hangeoreum-route-research/1.0 (static route audit)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body.code !== 'Ok' || !body.routes?.[0] || body.routes[0].legs.length !== stops.length - 1)
        throw new Error(body.message || body.code || 'Missing route legs');
      result = body;
      requestCount++;
      break;
    } catch (error) {
      if (attempt === 2) throw new Error(`${key}: ${error.message}`);
      await sleep(800 * (attempt + 1));
    }
  }
  await sleep(180);
  cache.set(key, result);
  return result;
}

function extractLegCoordinates(leg) {
  const points = [];
  for (const step of leg.steps || []) for (const point of step.geometry?.coordinates || []) {
    if (!points.length || point[0] !== points.at(-1)[0] || point[1] !== points.at(-1)[1]) points.push(point);
  }
  return points;
}

function originalTransit(region, themeId, fromId, toId) {
  if (region === 'gangneung') {
    const leg = gangneung.get(themeId).legs.find((item) => item.from === fromId && item.to === toId && item.mode === 'transit');
    return leg ? { mode: 'bus', minutes: leg.minutes, busRideMinutes: null, accessWalkMinutes: null,
      meters: null, coordinates: [], route: leg.buses || '', status: leg.surveyed ? 'saved-transit' : 'transit-unverified' } : null;
  }
  if (region === 'gyeongju' && themeId === 'bulguksa') {
    const feature = gyeongju.get(themeId).properties;
    const leg = feature.busLegs?.find((item) => item.from === placeMaps.gyeongju.get(fromId)?.name && item.to === placeMaps.gyeongju.get(toId)?.name);
    return leg ? { mode: 'bus', minutes: null, busRideMinutes: null, accessWalkMinutes: null,
      meters: null, coordinates: [], route: leg.route || '', status: 'saved-transit-schedule-unverified' } : null;
  }
  return null;
}

async function buildVariant(course, variant) {
  const region = course.region, map = placeMaps[region];
  const allStops = course.stops.map((stop) => ({
    placeId: stop.placeId, name: stop.name, category: stop.category,
    mealRole: stop.mealRole,
    lat: Number.isFinite(map.get(stop.placeId)?.lat) ? map.get(stop.placeId).lat : map.get(stop.placeId)?.mapLat,
    lon: Number.isFinite(map.get(stop.placeId)?.lon) ? map.get(stop.placeId).lon : map.get(stop.placeId)?.mapLon
  }));
  const keep = new Set(variant.remainingPlaceIds);
  const stops = allStops.filter((stop) => keep.has(stop.placeId));
  if (region === 'mokpo' && course.themeId === 'gatbawi') {
    const farBreakfast = stops.findIndex((stop) => stop.placeId === 'p61');
    if (farBreakfast >= 0) stops.splice(farBreakfast, 1);
    const rock = map.get('p7');
    const rockStop = { placeId: rock.id, name: rock.name, category: rock.category,
      mealRole: null, lat: rock.lat, lon: rock.lon };
    const lastMuseum = stops.findIndex((stop) => stop.placeId === 'p16');
    stops.splice(lastMuseum >= 0 ? lastMuseum + 1 : 0, 0, rockStop);
    if (variant.days.length === 1 && variant.days[0] === 1) {
      const plaza = map.get('p14');
      stops.splice(1, 0, { placeId: plaza.id, name: plaza.name, category: plaza.category,
        mealRole: null, lat: plaza.lat, lon: plaza.lon });
    }
  }
  if (region === 'mokpo' && course.themeId === 'peace') {
    const rock = map.get('p7'), lunch = map.get('p62');
    const stopFor = (place, mealRole = null) => ({ placeId: place.id, name: place.name,
      category: place.category, mealRole, lat: place.lat, lon: place.lon });
    const existing = new Map(stops.map((stop) => [stop.placeId, stop]));
    stops.splice(0, stops.length, stopFor(rock), stopFor(lunch, 'lunch'),
      existing.get('p101'), existing.get('p14'), existing.get('p55'), existing.get('p74'));
  }
  const addMealAfter = (placeId, afterId, mealRole) => {
    const place = map.get(placeId);
    const after = stops.findIndex((stop) => stop.placeId === afterId);
    if (!place || after < 0) throw new Error(`Missing meal insertion: ${placeId} after ${afterId}`);
    stops.splice(after + 1, 0, { placeId: place.id, name: place.name, category: place.category,
      mealRole, lat: Number.isFinite(place.lat) ? place.lat : place.mapLat,
      lon: Number.isFinite(place.lon) ? place.lon : place.mapLon });
  };
  if (region === 'gangneung' && course.themeId === 'food' && variant.days.length === 1) {
    if (variant.days[0] === 2) addMealAfter('g41', 'g49', 'lunch');
    if (variant.days[0] === 3) addMealAfter('g180', 'g5', 'dinner');
  }
  if (region === 'gangneung' && course.themeId === 'sea' && variant.days.length === 1 && variant.days[0] === 1)
    addMealAfter('g82', 'g4', 'lunch');
  if (region === 'mokpo' && ['oldtown', 'seosandong'].includes(course.themeId)) {
    const place = map.get('p63');
    stops.push({ placeId: place.id, name: place.name, category: place.category,
      mealRole: 'dinner', lat: place.lat, lon: place.lon });
  }
  if (region === 'gyeongju' && course.themeId === 'wolseong' && variant.days.length === 1 && variant.days[0] === 0) {
    const place = map.get('j109');
    const after = stops.findIndex((stop) => stop.placeId === 'j1');
    stops.splice(after + 1, 0, { placeId: place.id, name: place.name, category: place.category,
      mealRole: 'lunch', lat: place.lat, lon: place.lon });
  }
  if (region === 'gyeongju' && course.themeId === 'bulguksa' && variant.days.length === 1 && variant.days[0] === 0) {
    const place = map.get('j109');
    stops.unshift({ placeId: place.id, name: place.name, category: place.category,
      mealRole: 'lunch', lat: place.lat, lon: place.lon });
  }
  const nearbyLunch = region === 'gyeongju' && ['donggung', 'bunhwang'].includes(course.themeId) && !variant.days.includes(3);
  if (nearbyLunch) {
    const oldLunch = stops.findIndex((stop) => stop.placeId === 'j42');
    if (oldLunch >= 0) stops.splice(oldLunch, 1);
    const place = map.get('j178');
    const stop = { placeId: place.id, name: place.name, category: place.category,
      mealRole: 'lunch', lat: place.lat, lon: place.lon };
    const insertAt = course.themeId === 'donggung' ? stops.findIndex((item) => item.placeId === 'j2') + 1 : 0;
    stops.splice(insertAt, 0, stop);
  }
  const nearbyDinner = region === 'gyeongju' && ['donggung', 'bunhwang'].includes(course.themeId) && !variant.days.includes(3);
  if (nearbyDinner) {
    const dinnerIndex = stops.findIndex((stop) => stop.placeId === 'j43');
    if (dinnerIndex >= 0) {
      const place = map.get('j177');
      stops[dinnerIndex] = { placeId: place.id, name: place.name, category: place.category,
        mealRole: 'dinner', lat: place.lat, lon: place.lon };
    }
  }
  if (region === 'gyeongju' && ['donggung', 'bunhwang'].includes(course.themeId) && variant.days.length === 1 && variant.days[0] === 3) {
    const oldLunch = stops.findIndex((stop) => stop.placeId === 'j42');
    if (oldLunch >= 0) stops.splice(oldLunch, 1);
    const place = map.get('j179');
    const stop = { placeId: place.id, name: place.name, category: place.category,
      mealRole: 'lunch', lat: place.lat, lon: place.lon };
    const insertAt = course.themeId === 'donggung' ? stops.findIndex((item) => item.placeId === 'j2') + 1 : 0;
    stops.splice(insertAt, 0, stop);
  }
  if (region === 'gyeongju' && course.themeId === 'hwangridan' && variant.days.length === 1 && variant.days[0] === 0) {
    const place = map.get('j178');
    stops.push({ placeId: place.id, name: place.name, category: place.category,
      mealRole: 'dinner', lat: place.lat, lon: place.lon });
  }
  const originalIndices = stops.map((stop) => allStops.findIndex((item) => item.placeId === stop.placeId));
  const barriers = breakAfter(region, course.themeId, allStops);
  const legs = new Array(Math.max(0, stops.length - 1));
  const routeId = `${region}-${course.themeId}-${variant.days.join('')}`;
  const saved = previous.get(routeId);
  const canReuse = saved?.stops.length === stops.length && saved?.legs.length === legs.length &&
    saved.stops.every((stop, index) => stop.placeId === stops[index].placeId && stop.lat === stops[index].lat && stop.lon === stops[index].lon) &&
    saved.legs.every((leg) => leg.mode === 'bus' || leg.status === 'api-routed');
  if (canReuse) legs.splice(0, legs.length, ...saved.legs.map((leg) => leg.mode === 'bus'
    ? { ...leg, busRideMinutes: leg.busRideMinutes ?? null, accessWalkMinutes: leg.accessWalkMinutes ?? null }
    : leg));
  const chunks = [];
  let chunkStart = 0;
  for (let index = 0; !canReuse && index < stops.length - 1; index++) {
    const crossesTransit = [...barriers].some((barrier) => barrier >= originalIndices[index] && barrier < originalIndices[index + 1]);
    if (!crossesTransit) continue;
    if (index > chunkStart) chunks.push({ first: chunkStart, last: index });
    const saved = originalTransit(region, course.themeId, stops[index].placeId, stops[index + 1].placeId);
    legs[index] = { fromId: stops[index].placeId, toId: stops[index + 1].placeId,
      ...(saved || { mode: 'bus', minutes: null, busRideMinutes: null, accessWalkMinutes: null,
        meters: null, coordinates: [], route: '', status: 'transit-connection-unverified' }) };
    chunkStart = index + 1;
  }
  if (!canReuse && stops.length - 1 > chunkStart) chunks.push({ first: chunkStart, last: stops.length - 1 });
  for (const chunk of chunks) {
    try {
      const subset = stops.slice(chunk.first, chunk.last + 1);
      const response = await routeChunk(subset);
      for (let local = 0; local < subset.length - 1; local++) {
        const routeLeg = response.routes[0].legs[local];
        const snapStart = response.waypoints[local]?.distance ?? null;
        const snapEnd = response.waypoints[local + 1]?.distance ?? null;
        legs[chunk.first + local] = {
          fromId: subset[local].placeId, toId: subset[local + 1].placeId,
          mode: 'walk', meters: Math.round(routeLeg.distance), minutes: Math.max(1, Math.round(routeLeg.duration / 60)),
          coordinates: extractLegCoordinates(routeLeg), snapStartMeters: Math.round(snapStart),
          snapEndMeters: Math.round(snapEnd), status: Math.max(snapStart, snapEnd) <= 80 ? 'api-routed' : 'pin-access-unverified'
        };
      }
    } catch (error) {
      for (let index = chunk.first; index < chunk.last; index++) legs[index] = {
        fromId: stops[index].placeId, toId: stops[index + 1].placeId,
        mode: 'walk', meters: null, minutes: null, coordinates: [], status: 'api-route-unavailable', error: error.message
      };
    }
  }
  const issues = [];
  if (region === 'mokpo' && stops.some((stop) => stop.placeId === 'p7'))
    issues.push('갓바위 해상보행교 2026년 보수 통제 뒤 재개방 여부 미확인: 현장 접근 확인 전 추천 보류');
  const mealFallbacks = [];
  const placeCountException = region === 'gyeongju' && course.themeId === 'bulguksa' && stops.length < 5 ? {
    reason: '월·화 휴관으로 경내 박물관·문학관이 빠집니다. 석굴암은 12번 버스로 약 20분 거리지만 시내 왕복까지 포함하면 버스 4회가 되어 한 코스 최대 3회 기준을 넘습니다.',
    candidate: { place: '석굴암', mode: 'bus', route: '12', busRideMinutes: 20,
      accessWalkMinutes: null, busRideWithin30Minutes: true, included: false,
      excludedBecause: '시내 왕복 포함 예상 버스 4회로 한 코스 최대 3회 초과' },
    checkedOn: '2026-10-08', sources: ['https://www.gyeongju.go.kr/tour/page.do?mnu_uid=4676', 'https://www.buswhen.com/gyeongju/12']
  } : null;
  if ((stops.length < 5 && !placeCountException) || stops.length > 15) issues.push(`방문 ${stops.length}곳: 5~15곳 기준 밖`);
  const mealStops = stops.filter((stop) => stop.mealRole && /점심|저녁|아침|lunch|dinner|breakfast/.test(stop.mealRole));
  const cafeStops = stops.filter((stop) => stop.category === 'cafe');
  const cafeTour = /cafe/i.test(course.themeId) || course.themeId === 'cafeWalk';
  if (!cafeTour) {
    if (!mealStops.some((stop) => /점심|lunch/.test(stop.mealRole))) issues.push('점심 식사 누락');
    if (!mealStops.some((stop) => /저녁|dinner/.test(stop.mealRole))) issues.push('저녁 식사 누락');
    if (cafeStops.length > mealStops.length) issues.push(`카페 ${cafeStops.length}곳: 식사 ${mealStops.length}회보다 많음`);
    const lunchIndex = stops.findIndex((stop) => /점심|lunch/.test(stop.mealRole || ''));
    const dinnerIndex = stops.findIndex((stop) => /저녁|dinner/.test(stop.mealRole || ''));
    if (lunchIndex >= 0 && dinnerIndex === lunchIndex + 1) issues.push('점심과 저녁이 연속 방문: 식사 사이 활동·시간 검토 필요');
  }
  for (let index = 1; index < stops.length; index++) {
    const leg = legs[index - 1], stop = stops[index];
    if (stop.mealRole && /점심|저녁|아침|lunch|dinner|breakfast/.test(stop.mealRole) && leg?.mode === 'walk' && leg.minutes > 15) {
      const researchedFallback = region === 'gyeongju' &&
        ((course.themeId === 'donggung' && stop.placeId === 'j178') ||
         (course.themeId === 'donggung' && variant.days.includes(3) && ['j179', 'j43'].includes(stop.placeId)) ||
         (course.themeId === 'bunhwang' && variant.days.includes(3) && stop.placeId === 'j43') ||
         (course.themeId === 'hwangridan' && ['j42', 'j178'].includes(stop.placeId))) && leg.minutes <= 30;
      if (researchedFallback) mealFallbacks.push({ placeId: stop.placeId, minutes: leg.minutes,
        reason: '편도 15분 안의 평점 4.0 이상·요일 영업 대안을 아직 확인하지 못해 사용자가 허용한 30분 이내 예외를 적용했습니다.',
        checkedOn: '2026-10-08', alternativesChecked: ['소사이어티나귀(Google 4.5, 동궁과 월지에서 19분)', '반월성화덕피자(Google 4.1, 동궁과 월지에서 23분)', '경주원조콩국(저장 장소, 동궁과 월지에서 20분)'] });
      if (!researchedFallback) issues.push(`${stop.name} 식사까지 편도 도보 ${leg.minutes}분: 15분 초과`);
    }
    if (leg?.mode === 'walk' && (leg.minutes > 30 || leg.meters > 1600) &&
        !(stop.mealRole && mealFallbacks.some((fallback) => fallback.placeId === stop.placeId)))
      issues.push(`${stops[index - 1].name}→${stop.name} 도보 ${leg.minutes}분·${leg.meters}m: 구간 재검토`);
  }
  const walkMeters = legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + (leg.meters || 0), 0);
  if (walkMeters > 8000) issues.push(`총 도보 ${(walkMeters / 1000).toFixed(1)}km: 8km 기준 초과`);
  const busCount = legs.filter((leg) => leg.mode === 'bus').length;
  if (busCount > 3) issues.push(`버스 ${busCount}회: 최대 3회 초과`);
  if (legs.some((leg) => !['api-routed', 'saved-transit', 'saved-transit-schedule-unverified'].includes(leg.status)))
    issues.push('일부 구간의 보행 길선 또는 버스 연결 미확인');
  return {
    id: routeId, region, themeId: course.themeId, title: course.title,
    weekdays: variant.days, dayNames: variant.dayNames, excludedClosed: variant.closed,
    status: issues.length ? 'needs-review' : 'walking-geometry-checked',
    operatingHoursStatus: 'recurring-closure-reviewed; visit-time-and-exceptions-unverified',
    routeProvider: 'FOSSGIS OSRM foot / OpenStreetMap', checkedOn: '2026-10-08',
    stops, legs, walkMeters,
    walkMinutes: legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + (leg.minutes || 0), 0),
    busCount, issues, mealFallbacks, placeCountException
  };
}

const routes = [];
for (const course of audit.courses) {
  for (const variant of course.variants) {
    const hasWednesdayAlternative = course.region === 'gyeongju' && ['donggung', 'bunhwang'].includes(course.themeId) && variant.days.includes(3) && variant.days.length > 1;
    const variants = hasWednesdayAlternative ? [
      { ...variant, days: variant.days.filter((day) => day !== 3), dayNames: variant.dayNames.filter((_, index) => variant.days[index] !== 3) },
      { ...variant, days: [3], dayNames: [variant.dayNames[variant.days.indexOf(3)]] }
    ] : [variant];
    for (const weekdayVariant of variants) {
      const route = await buildVariant(course, weekdayVariant);
      routes.push(route);
      console.log(`${route.region}/${route.themeId} ${route.dayNames.join('')} ${route.status} ${route.stops.length} stops, ${route.walkMeters}m, ${route.issues.length} issues`);
    }
  }
}
const output = {
  version: 1, checkedOn: '2026-10-08', status: 'saved-api-walking-geometry; operating-hours-and-invalid-routes-not-final',
  source: { label: 'FOSSGIS OSRM foot / OpenStreetMap pedestrian network', url: 'https://routing.openstreetmap.de/' },
  requestCount, routes
};
fs.writeFileSync(new URL('../public/theme-weekday-routes.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
const features = routes.map((route) => ({
  type: 'Feature', id: route.id,
  geometry: { type: 'MultiLineString', coordinates: route.legs.filter((leg) => leg.mode === 'walk' && leg.coordinates.length > 1).map((leg) => leg.coordinates) },
  properties: { id: route.id, region: route.region, themeId: route.themeId, title: route.title,
    weekdays: route.weekdays, dayNames: route.dayNames, status: route.status, issues: route.issues,
    stopIds: route.stops.map((stop) => stop.placeId), walkMeters: route.walkMeters, walkMinutes: route.walkMinutes,
    busCount: route.busCount, mealFallbacks: route.mealFallbacks, placeCountException: route.placeCountException,
    routeProvider: route.routeProvider, checkedOn: route.checkedOn }
}));
fs.writeFileSync(new URL('../public/theme-weekday-routes.geojson', import.meta.url), JSON.stringify({
  type: 'FeatureCollection', name: '목포·강릉·경주 요일별 테마 보행 길선', features
}, null, 2) + '\n');
const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const tracks = routes.map((route) => {
  const segments = route.legs.filter((leg) => leg.mode === 'walk' && leg.coordinates.length > 1)
    .map((leg) => `<trkseg>${leg.coordinates.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('')}</trkseg>`).join('');
  return `<trk><name>${xml(route.region + ' ' + route.title + ' ' + route.dayNames.join('·'))}</name><desc>${xml(route.status + ' · ' + route.issues.join('; '))}</desc>${segments}</trk>`;
}).join('');
fs.writeFileSync(new URL('../public/theme-weekday-routes.gpx', import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Hangeoreum saved weekday route audit" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>목포·강릉·경주 요일별 테마 루트 보행선</name></metadata>${tracks}</gpx>\n`);
console.log(JSON.stringify({ total: routes.length, requests: requestCount, geometryChecked: routes.filter((route) => route.legs.every((leg) => leg.mode === 'bus' || leg.status === 'api-routed')).length, ready: routes.filter((route) => route.status === 'walking-geometry-checked').length }));
