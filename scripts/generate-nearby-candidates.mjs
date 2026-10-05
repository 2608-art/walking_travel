import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const places = JSON.parse(readFileSync(resolve(root, 'public/places.json'), 'utf8')).places
  .filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon));
// The app treats Mokpo Station as a registered start/end point outside places.json.
places.push({ id: 'station', name: '목포역', lat: 34.7914, lon: 126.3859 });

function straightMeters(a, b) {
  const rad = Math.PI / 180;
  const lat = (b.lat - a.lat) * rad;
  const lon = (b.lon - a.lon) * rad;
  const meanLat = (a.lat + b.lat) * rad / 2;
  return Math.round(6371000 * Math.hypot(lat, lon * Math.cos(meanLat)));
}

const candidates = places.flatMap(from => places
  .filter(to => to.id !== from.id)
  .map(to => ({
    fromId: from.id,
    fromName: from.name,
    toId: to.id,
    toName: to.name,
    straightMeters: straightMeters(from, to),
  }))
  .sort((a, b) => a.straightMeters - b.straightMeters || a.toId.localeCompare(b.toId))
  .slice(0, 5));

const output = {
  version: 1,
  selection: 'Each geocoded registered place, including Mokpo Station, to its five nearest other registered points by straight-line distance. Direction matters; these are research candidates, not verified routes.',
  placeCount: places.length,
  candidatesPerPlace: 5,
  candidates,
};
const researchDir = resolve(root, 'research');
mkdirSync(researchDir, { recursive: true });
writeFileSync(resolve(researchDir, 'nearby-candidates.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`${places.length} places, ${candidates.length} directed candidates`);
