import fs from 'node:fs';
import { changedMaterialIds, changedWindows, dateAfter, dateBefore, firstWeekdayInRange, isUnavailable,
  KST_TODAY, materialInput, titleNamedPlaceIds, updateStatus, validateAvailability } from './theme-route-refresh-core.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'));
const write = (name, value) => fs.writeFileSync(new URL(`../public/${name}`, import.meta.url), value);
const placeFiles = { mokpo: 'places.json', gangneung: 'gangneung-places.json', gyeongju: 'gyeongju-places.json' };
const maps = Object.fromEntries(Object.entries(placeFiles).map(([region, name]) =>
  [region, new Map(read(name).places.map((place) => [place.id, place]))]));
for (const map of Object.values(maps)) for (const place of map.values()) validateAvailability(place);
const bases = read('theme-weekday-routes.json').routes.filter((route) => !route.validFrom);
const startTimes = new Map([
  ...read('theme-courses.json').courses.map((item) => [`mokpo/${item.theme}`, item.start]),
  ...read('gangneung-theme-review-routes.json').routes.map((item) => [`gangneung/${item.themeId}`, item.startTime || '10:00']),
  ...read('gyeongju-six-theme-routes.geojson').features.map(({ properties: item }) => [`gyeongju/${item.themeId}`, item.startTime || '10:00'])
]);
const pools = new Map();
for (const item of read('theme-place-drafts.json').themes) pools.set(`mokpo/${item.theme}`, item.placeIds);
for (const item of read('gangneung-theme-place-picks.json').themes) pools.set(`gangneung/${item.id}`, item.placeIds);
for (const feature of read('gyeongju-theme-candidates.geojson').features) {
  const key = `gyeongju/${feature.properties.themeId}`;
  if (!pools.has(key)) pools.set(key, []);
  if (!pools.get(key).includes(feature.properties.placeId)) pools.get(key).push(feature.properties.placeId);
}
const today = KST_TODAY();
const current = Object.fromEntries(Object.entries(maps).flatMap(([region, map]) =>
  [...map].map(([id, place]) => [`${region}/${id}`, materialInput(place)])));
const prior = (() => { try { return read('theme-route-updates.json'); } catch { return null; } })();
const priorInputs = prior?.inputSchemaVersion === 2 ? prior.sourceInputs : null;
const changed = priorInputs ? changedMaterialIds(priorInputs, current) : [];

function point(place) { return [place.lon ?? place.mapLon, place.lat ?? place.mapLat]; }
function radians(value) { return value * Math.PI / 180; }
function crowMeters(a, b) {
  const [ax, ay] = point(a), [bx, by] = point(b);
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.sin(radians(by - ay) / 2) ** 2 +
    Math.cos(radians(ay)) * Math.cos(radians(by)) * Math.sin(radians(bx - ax) / 2) ** 2));
}
const footCache = new Map();
let walkingRequests = 0;
async function foot(a, b) {
  const key = `${a.id}:${point(a).join(',')}>${b.id}:${point(b).join(',')}`;
  if (footCache.has(key)) return footCache.get(key);
  const [ax, ay] = point(a), [bx, by] = point(b);
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${ax},${ay};${bx},${by}?overview=full&geometries=geojson`;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fetched = await fetch(url, { headers: { 'User-Agent': 'Hangeoreum-route-change-audit/1.0' } });
      if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
      response = await fetched.json();
      if (response.code !== 'Ok' || !response.routes?.[0]) throw new Error(response.message || 'No walking route');
      walkingRequests++;
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  const route = response.routes[0];
  const result = { mode: 'walk', meters: Math.round(route.distance), minutes: Math.max(1, Math.round(route.duration / 60)),
    coordinates: route.geometry.coordinates, snapStartMeters: Math.round(response.waypoints?.[0]?.distance ?? 999),
    snapEndMeters: Math.round(response.waypoints?.[1]?.distance ?? 999),
    status: Math.max(response.waypoints?.[0]?.distance ?? 999, response.waypoints?.[1]?.distance ?? 999) <= 80 ? 'api-routed' : 'pin-access-unverified' };
  footCache.set(key, result);
  return result;
}

function candidateHasHours(place, day) {
  if (place.unrestrictedAccess || place.category === 'outdoors') return true;
  const weekly = place.weeklyHours?.[day];
  return Boolean((place.hours?.open && place.hours?.close) || (weekly?.open && weekly?.close));
}
function minutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
function checkOperatingPlan(region, themeId, stops, legs, map, date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const issues = [], visits = [];
  let clock = minutes(startTimes.get(`${region}/${themeId}`)) ?? 600;
  for (let index = 0; index < stops.length; index++) {
    const stop = stops[index], place = map.get(stop.placeId);
    if (index) {
      const leg = legs[index - 1];
      if (!Number.isFinite(leg?.minutes)) {
        issues.push(`${stop.name}: 직전 이동시간 미확인으로 방문시각 검증 불가`);
        break;
      }
      clock += leg.minutes;
    }
    const weekly = place.weeklyHours?.[day];
    const hours = weekly && typeof weekly === 'object' ? weekly : place.hours || null;
    if (isUnavailable(place, date)) issues.push(`${stop.name}: 선택 날짜에 방문 불가`);
    if (!place.unrestrictedAccess && !(place.category === 'outdoors' && !hours)) {
      const open = minutes(hours?.open), close = minutes(hours?.close);
      if (open == null || close == null) issues.push(`${stop.name}: 계산 가능한 운영시간 미확인`);
      else {
        if (clock < open) {
          if (open - clock > 30) issues.push(`${stop.name}: 개점 전 ${open - clock}분 대기 필요`);
          clock = open;
        }
        const last = minutes(hours?.lastEntry || hours?.lastOrder);
        if (last != null && clock > last) issues.push(`${stop.name}: 입장·주문 마감 뒤 도착`);
        const stay = /점심|저녁|lunch|dinner/.test(stop.mealRole || '') ? 60 :
          stop.category === 'culture' || stop.category === 'experience' ? 50 :
            stop.category === 'cafe' ? 35 : 25;
        if (clock + stay > close) issues.push(`${stop.name}: 예상 체류가 종료 시각을 넘음`);
        if ((hours?.breaks || []).some(([start, end]) => clock < minutes(end) && clock + stay > minutes(start)))
          issues.push(`${stop.name}: 예상 방문이 브레이크타임과 겹침`);
      }
    }
    const stay = /점심|저녁|lunch|dinner/.test(stop.mealRole || '') ? 60 :
      stop.category === 'culture' || stop.category === 'experience' ? 50 :
        stop.category === 'cafe' ? 35 : 25;
    if (/점심|lunch/.test(stop.mealRole || '') && (clock < 660 || clock > 870)) issues.push(`${stop.name}: 점심 예상 방문시각 재검토`);
    if (/저녁|dinner/.test(stop.mealRole || '') && (clock < 1020 || clock > 1230)) issues.push(`${stop.name}: 저녁 예상 방문시각 재검토`);
    visits.push({ placeId: stop.placeId, estimatedArrival: `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}` });
    clock += stay;
  }
  return { issues, visits, estimatedStart: startTimes.get(`${region}/${themeId}`) || '10:00' };
}

async function replacementFor({ lost, before, after, stops, map, pool, date }) {
  if (!before && !after) return null;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const options = pool.map((id) => map.get(id)).filter((place) => place && place.id !== lost.placeId &&
    place.category === lost.category && !stops.some((stop) => stop.placeId === place.id) &&
    Number.isFinite(point(place)[0]) && Number.isFinite(point(place)[1]) &&
    !isUnavailable(place, date) && candidateHasHours(place, day) &&
    Math.min(before ? crowMeters(map.get(before.placeId), place) : Infinity,
      after ? crowMeters(place, map.get(after.placeId)) : Infinity) <= 1800);
  const ranked = options.sort((a, b) => {
    const score = (place) => (before ? crowMeters(map.get(before.placeId), place) : 0) +
      (after ? crowMeters(place, map.get(after.placeId)) : 0);
    return score(a) - score(b);
  }).slice(0, 8);
  for (const place of ranked) {
    try {
      const inbound = before ? await foot(map.get(before.placeId), place) : null;
      const outbound = after ? await foot(place, map.get(after.placeId)) : null;
      if ([inbound, outbound].filter(Boolean).every((leg) => leg.status === 'api-routed' && leg.minutes <= 30))
        return { placeId: place.id, name: place.name, category: place.category,
          mealRole: lost.mealRole, lat: point(place)[1], lon: point(place)[0] };
    } catch { /* Try another stored candidate; never infer a missing walking link. */ }
  }
  return null;
}

async function buildOverride(base, date, from, through, manualReview, manualReviewPlaceIds = []) {
  const map = maps[base.region], pool = pools.get(`${base.region}/${base.themeId}`) || [];
  const original = base.stops.map((stop) => ({ ...stop }));
  const blocked = original.filter((stop) => isUnavailable(map.get(stop.placeId), date));
  const stops = original.filter((stop) => !blocked.some((item) => item.placeId === stop.placeId));
  const replacements = [];
  for (const lost of blocked) {
    const index = original.findIndex((stop) => stop.placeId === lost.placeId);
    const before = [...original.slice(0, index)].reverse().find((stop) => stops.some((item) => item.placeId === stop.placeId));
    const after = original.slice(index + 1).find((stop) => stops.some((item) => item.placeId === stop.placeId));
    const replacement = await replacementFor({ lost, before, after, stops, map, pool, date });
    if (!replacement) continue;
    const insertAt = before ? stops.findIndex((stop) => stop.placeId === before.placeId) + 1 : 0;
    stops.splice(insertAt, 0, replacement);
    replacements.push({ removed: lost.placeId, added: replacement.placeId });
  }
  for (const stop of stops) {
    const place = map.get(stop.placeId), [lon, lat] = point(place);
    stop.lat = lat; stop.lon = lon;
  }
  const legs = [];
  const issues = [...manualReview];
  for (let index = 1; index < stops.length; index++) {
    const a = stops[index - 1], b = stops[index], before = base.legs.find((leg) => leg.fromId === a.placeId && leg.toId === b.placeId);
    if (before?.mode === 'bus') { legs.push({ ...before }); continue; }
    const originalA = base.stops.find((stop) => stop.placeId === a.placeId);
    const originalB = base.stops.find((stop) => stop.placeId === b.placeId);
    if (before?.mode === 'walk' && before.status === 'api-routed' &&
        originalA?.lat === a.lat && originalA?.lon === a.lon && originalB?.lat === b.lat && originalB?.lon === b.lon) {
      legs.push({ ...before });
      continue;
    }
    try {
      const result = await foot(map.get(a.placeId), map.get(b.placeId));
      legs.push({ fromId: a.placeId, toId: b.placeId, ...result });
    } catch (error) {
      legs.push({ fromId: a.placeId, toId: b.placeId, mode: 'walk', meters: null, minutes: null,
        coordinates: [], status: 'api-route-unavailable' });
      issues.push(`${a.name}→${b.name}: 보행 길선 확인 실패 (${error.message})`);
    }
  }
  for (let index = 1; index < stops.length; index++) {
    const a = stops[index - 1], b = stops[index], leg = legs[index - 1];
    if (leg.mode !== 'walk') continue;
    if (leg.status !== 'api-routed') issues.push(`${a.name}→${b.name}: 출입구·보행망 접점 미확인`);
    const meal = /점심|저녁|lunch|dinner/.test(b.mealRole || '');
    const documentedFallback = meal && base.mealFallbacks?.some((item) => item.placeId === b.placeId &&
      leg.fromId === base.legs.find((old) => old.toId === b.placeId)?.fromId);
    if (leg.minutes > 30 || (leg.meters > 1600 && !documentedFallback))
      issues.push(`${a.name}→${b.name}: 도보 ${leg.minutes}분·${leg.meters}m 재검토`);
    if (meal && leg.minutes > 15 && !documentedFallback)
      issues.push(`${b.name}: 식사까지 편도 ${leg.minutes}분. 15분 이내 대안 조사 또는 30분 예외 근거 필요`);
  }
  const meals = stops.filter((stop) => /점심|저녁|lunch|dinner/.test(stop.mealRole || ''));
  const cafeTour = /cafe/i.test(base.themeId);
  if (!cafeTour && (!meals.some((stop) => /점심|lunch/.test(stop.mealRole)) ||
    !meals.some((stop) => /저녁|dinner/.test(stop.mealRole)))) issues.push('점심 또는 저녁 식사 누락');
  if (!cafeTour && stops.filter((stop) => stop.category === 'cafe').length > meals.length)
    issues.push('식사 횟수보다 카페 방문이 많음');
  for (let index = 1; index < stops.length; index++) if (
    /점심|lunch/.test(stops[index - 1].mealRole || '') && /저녁|dinner/.test(stops[index].mealRole || ''))
    issues.push('점심과 저녁이 연속 방문');
  const walkMeters = legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + (leg.meters || 0), 0);
  if (walkMeters > 8000) issues.push(`하루 도보 ${(walkMeters / 1000).toFixed(1)}km: 8km 초과`);
  const busCount = legs.filter((leg) => leg.mode === 'bus').length;
  if (busCount > 3) issues.push('버스 3회 초과');
  if (legs.some((leg) => leg.mode === 'bus' && (!Number.isFinite(leg.busRideMinutes) || leg.busRideMinutes > 30)))
    issues.push('버스 탑승 시간 30분 이내 여부 미확인 또는 초과: 정류장 접근 도보와 별도 검사');
  if (legs.some((leg) => leg.mode === 'bus' && !['saved-transit'].includes(leg.status))) issues.push('버스 승하차·배차 미확인');
  if (blocked.length && !replacements.length && stops.length < 8)
    issues.push('방문 불가 장소의 검증된 대체 장소를 찾지 못함');
  const named = titleNamedPlaceIds(base.title, [...map.values()]);
  const titleMissing = named.some((id) => !stops.some((stop) => stop.placeId === id));
  if (titleMissing) issues.push('테마 제목에 적힌 장소가 루트에서 빠짐');
  const operating = checkOperatingPlan(base.region, base.themeId, stops, legs, map, date);
  issues.push(...operating.issues);
  const status = updateStatus({ count: stops.length, issues, titleMissing });
  if (stops.length >= 5 && stops.length <= 7) issues.push('방문지 5~7곳: 루트 표시 후 재검토 필요');
  if (stops.length < 5) issues.push('방문지 4곳 이하: 추천 중지');
  return { ...base, id: `${base.id}-update-${from}-${through}`, weekdays: [new Date(`${date}T12:00:00Z`).getUTCDay()],
    dayNames: [base.dayNames[base.weekdays.indexOf(new Date(`${date}T12:00:00Z`).getUTCDay())]],
    validFrom: from, validThrough: through, status, checkedOn: today,
    operatingHoursStatus: operating.issues.length ? 'estimated-visit-time-needs-review' : 'estimated-visit-time-checked; real-day-exceptions-unverified',
    estimatedVisits: operating.visits, estimatedStart: operating.estimatedStart,
    sourceChange: { unavailablePlaceIds: blocked.map((stop) => stop.placeId), replacements,
      manualReviewPlaceIds,
      titleNamedPlaceMissing: titleMissing, majorChange: true },
    stops, legs, issues, walkMeters,
    walkMinutes: legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + (leg.minutes || 0), 0),
    busCount };
}

const overrides = [];
const affectedThemes = new Set();
if (changed.length) {
  for (const [theme, pool] of pools) {
    const region = theme.split('/')[0], map = maps[region], themeBases = bases.filter((route) => `${route.region}/${route.themeId}` === theme);
    const routePlaceIds = [...new Set(themeBases.flatMap((route) => route.stops.map((stop) => stop.placeId)))];
    const impacted = routePlaceIds.filter((id) => changed.includes(`${region}/${id}`));
    if (!impacted.length) continue;
    affectedThemes.add(theme);
    const beforeForRegion = Object.fromEntries(routePlaceIds.map((id) => [id, priorInputs?.[`${region}/${id}`]]));
    const changeWindows = changedWindows(impacted, map, beforeForRegion, today);
    const oldManual = new Set((prior?.overrides || []).filter((route) => `${route.region}/${route.themeId}` === theme)
      .flatMap((route) => route.sourceChange?.manualReviewPlaceIds || []));
    const manuallyChanged = routePlaceIds.filter((id) => {
      const previous = beforeForRegion[id], now = materialInput(map.get(id));
      return ((previous?.closureAlert !== now.closureAlert && now.closureAlert) || oldManual.has(id)) &&
        !now.availability && Boolean(now.closureAlert);
    });
    const boundaries = new Set(changeWindows.flatMap((window) =>
      window.through === '9999-12-31' ? [window.from] : [window.from, dateAfter(window.through)]));
    for (const id of routePlaceIds) {
      const place = map.get(id), events = Array.isArray(place.availability) ? place.availability : place.availability ? [place.availability] : [];
      for (const event of events) {
        if (!['closed', 'permanently_closed', 'construction', 'suspended'].includes(event.status)) continue;
        const start = event.from || today, through = event.through || '9999-12-31';
        if (through < today) continue;
        boundaries.add(start < today ? today : start);
        if (through !== '9999-12-31') boundaries.add(dateAfter(through));
      }
    }
    if (manuallyChanged.length) boundaries.add(today);
    const sorted = [...boundaries].sort();
    const windows = sorted.map((from, index) => ({ from,
      through: index + 1 < sorted.length ? dateBefore(sorted[index + 1]) : '9999-12-31' }))
      .filter((window) => window.from <= window.through);
    for (const window of windows) for (let day = 0; day < 7; day++) {
      const date = firstWeekdayInRange(window.from, window.through, day);
      if (!date) continue;
      const base = themeBases.find((route) => route.weekdays.includes(day));
      if (!base) continue;
      const unavailable = impacted.some((id) => isUnavailable(map.get(id), date));
      const coordinatesChanged = impacted.some((id) => {
        const before = beforeForRegion[id], now = materialInput(map.get(id));
        return before?.lat !== now.lat || before?.lon !== now.lon;
      });
      const operatingChanged = impacted.some((id) => {
        const before = beforeForRegion[id], now = materialInput(map.get(id));
        return JSON.stringify([before?.closedWeekdays, before?.closedDates, before?.open, before?.close,
          before?.lastEntry, before?.breaks, before?.weeklyHours]) !==
          JSON.stringify([now.closedWeekdays, now.closedDates, now.open, now.close,
            now.lastEntry, now.breaks, now.weeklyHours]);
      });
      if (!unavailable && !coordinatesChanged && !operatingChanged && !manuallyChanged.length) continue;
      const review = manuallyChanged.map((id) => `${map.get(id).name}: 폐업·공사 관련 문구 변경. 적용 날짜를 구조화해 확인해야 함`);
      overrides.push(await buildOverride(base, date, window.from, window.through, review, manuallyChanged));
    }
  }
  overrides.push(...(prior?.overrides || []).filter((route) => !affectedThemes.has(`${route.region}/${route.themeId}`)));
}
if (!changed.length && !priorInputs && prior?.overrides?.length) overrides.push(...prior.overrides);
const output = { version: 1, inputSchemaVersion: 2, checkedOn: today, changedPlaceIds: changed, walkingRequests,
  sourceInputs: current, overrides };
if (!prior || !priorInputs || changed.length) {
  write('theme-route-updates.json', JSON.stringify(output, null, 2) + '\n');
  const features = overrides.map((route) => ({ type: 'Feature', id: route.id,
    geometry: { type: 'MultiLineString', coordinates: route.legs.filter((leg) => leg.mode === 'walk' && leg.coordinates?.length > 1).map((leg) => leg.coordinates) },
    properties: { id: route.id, region: route.region, themeId: route.themeId,
      validFrom: route.validFrom, validThrough: route.validThrough, weekdays: route.weekdays, status: route.status } }));
  write('theme-route-updates.geojson', JSON.stringify({ type: 'FeatureCollection', features }, null, 2) + '\n');
  const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const tracks = overrides.map((route) => '<trk><name>' + xml(`${route.region} ${route.title} ${route.validFrom}~${route.validThrough}`) +
    '</name><desc>' + xml(`${route.status} · ${route.issues.join('; ')}`) + '</desc>' + route.legs.filter((leg) => leg.mode === 'walk' && leg.coordinates?.length > 1)
      .map((leg) => '<trkseg>' + leg.coordinates.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('') + '</trkseg>').join('') + '</trk>').join('');
  write('theme-route-updates.gpx', `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Hangeoreum route change refresh" xmlns="http://www.topografix.com/GPX/1/1">${tracks}</gpx>\n`);
}
console.log(JSON.stringify({ materialChanges: changed.length, affectedRoutes: overrides.length,
  suppressed: overrides.filter((route) => route.status === 'suppressed').length, walkingRequests, reused: !changed.length }));
