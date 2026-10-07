import fs from 'node:fs';

const catalogPath = new URL('../public/walk-paths.json', import.meta.url);
const placeData = JSON.parse(fs.readFileSync(new URL('../public/gyeongju-places.json', import.meta.url), 'utf8'));
const ids = ['j3', 'j142', 'j4', 'j1', 'j5', 'j6', 'j72', 'j2'];
const stops = ids.map((id) => {
  const place = placeData.places.find((item) => item.id === id);
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) throw new Error(`Missing Gyeongju stop: ${id}`);
  return { id, lat: place.lat, lon: place.lon, name: place.name };
});
const points = stops.map(({ lat, lon }) => `${lon},${lat}`).join(';');
const apiUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${points}?overview=full&geometries=geojson&steps=true`;
const response = await fetch(apiUrl, { headers: { 'User-Agent': 'HangeoreumGyeongjuRouteResearch/1.0' } });
if (!response.ok) throw new Error(`FOSSGIS route request failed: HTTP ${response.status}`);
const result = await response.json();
if (result.code !== 'Ok' || result.routes?.[0]?.legs?.length !== stops.length - 1) throw new Error('FOSSGIS did not return every planned walking leg.');

const checkedOn = new Date().toISOString().slice(0, 10);
const routeLink = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${stops.map(({ lat, lon }) => `${lat},${lon}`).join(';')}`;
const source = {
  label: `OpenStreetMap 도보 길선 · FOSSGIS OSRM · ${checkedOn} 조회`,
  url: routeLink,
  provider: 'OpenStreetMap',
  attributionUrl: 'https://www.openstreetmap.org/copyright',
  fixMapUrl: 'https://www.openstreetmap.org/edit'
};
const allAdditions = result.routes[0].legs.map((leg, index) => {
  const coordinates = [];
  for (const step of leg.steps || []) {
    for (const coordinate of step.geometry?.coordinates || []) {
      if (!coordinates.length || coordinates.at(-1)[0] !== coordinate[0] || coordinates.at(-1)[1] !== coordinate[1]) coordinates.push(coordinate);
    }
  }
  const from = stops[index], to = stops[index + 1];
  if (coordinates.length < 2) throw new Error(`Missing route geometry: ${from.id} -> ${to.id}`);
  return {
    from: { id: from.id, lat: from.lat, lon: from.lon },
    to: { id: to.id, lat: to.lat, lon: to.lon },
    source,
    verification: {
      checkedOn,
      provider: 'FOSSGIS OSRM foot',
      dataSource: 'OpenStreetMap',
      meters: Math.round(leg.distance),
      minutes: Math.max(1, Math.round(leg.duration / 60)),
      note: '지도 보행 그래프에서 계산한 길선이다. 출입구·현장 통제·횡단 대기와 공사 여부는 별도 확인이 필요하다.'
    },
    variants: [{
      id: `osm-foot-${checkedOn}-${from.id}-${to.id}`,
      label: 'OpenStreetMap 보행 경로',
      meters: Math.round(leg.distance),
      minutes: Math.max(1, Math.round(leg.duration / 60)),
      points: coordinates
    }]
  };
});
const endpointNear = (point, stop) => Math.abs(point[0] - stop.lon) < 0.0005 && Math.abs(point[1] - stop.lat) < 0.0005;
const additions = allAdditions.filter((path) => {
  const variant = path.variants[0];
  const accepted = endpointNear(variant.points[0], path.from) && endpointNear(variant.points.at(-1), path.to);
  if (!accepted) console.warn(`Skipped route with an unmapped access gap: ${path.from.id} -> ${path.to.id}`);
  return accepted;
});

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const sequenceKeys = new Set(allAdditions.map((path) => `${path.from.id}>${path.to.id}`));
catalog.paths = catalog.paths.filter((path) => !(path.source?.provider === 'OpenStreetMap' && sequenceKeys.has(`${path.from.id}>${path.to.id}`)));
const keys = new Set(catalog.paths.map((path) => `${path.from.id}>${path.to.id}`));
for (const path of additions) {
  const key = `${path.from.id}>${path.to.id}`;
  if (keys.has(key)) throw new Error(`A saved route already exists for ${key}; refusing to replace it.`);
  keys.add(key);
}
catalog.paths.push(...additions);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  checkedOn,
  totalMeters: result.routes[0].distance,
  totalMinutes: result.routes[0].duration / 60,
  savedLegCount: additions.length,
  skippedLegs: allAdditions.filter((path) => !additions.includes(path)).map((path) => `${path.from.id}>${path.to.id}`),
  legs: additions.map((path) => ({ from: path.from.id, to: path.to.id, meters: path.variants[0].meters, minutes: path.variants[0].minutes, points: path.variants[0].points.length }))
}, null, 2));
