import fs from 'node:fs';
import path from 'node:path';

const root = fs.realpathSync('.');
const cataloguePath = path.join(root, 'public', 'places.json');
const researchPath = path.join(root, '한걸음', 'travel-app', 'place-prices.json');
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));
const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const categories = new Set(['food', 'cafe', 'culture', 'experience']);
const names = new Set(catalogue.places.filter((place) => categories.has(place.category)).map((place) => place.name));
if (names.size !== Object.keys(research).length || Object.keys(research).some((name) => !names.has(name))) {
  throw Error('Price research must cover exactly the selected place categories.');
}
for (const place of catalogue.places) {
  if (!categories.has(place.category)) continue;
  const info = research[place.name];
  if (!info || !info.label || !info.price || !info.checked || !/^https:\/\//.test(info.source)) {
    throw Error(`Incomplete price information: ${place.name}`);
  }
  place.priceInfo = info;
}
catalogue.updated = [catalogue.updated, ...Object.values(research).map((info) => info.checked)].sort().at(-1);
fs.writeFileSync(cataloguePath, JSON.stringify(catalogue, null, 2));
console.log(`Updated prices for ${names.size} places in public/places.json.`);
