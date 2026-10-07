import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const dataPath = resolve(root, 'public/gangneung-places.json');
const data = read('public/gangneung-places.json');
const solo = read('한걸음/docs/지역/강릉/혼자여행-음식카페-조사.json');
const reservations = read('한걸음/docs/지역/강릉/예약-조사.json');
const byId = new Map(data.places.map((place) => [place.id, place]));
const broadMarkets = new Set(['g1', 'g2', 'g16', 'g50']);
const seatKind = {'g26':'bar','g217':'window','g286':'bar','g298':'single'};

for (const place of data.places) {
  const individual = place.category === 'food' || place.category === 'cafe' && place.id !== 'g15' || place.category === 'market' && !broadMarkets.has(place.id);
  if (!individual) continue;
  place.soloChecked = solo.checked;
  place.soloVerdict ||= 'unknown';
  place.soloSeat ||= 'unknown';
  place.soloTakeout ||= 'unknown';
  if (place.category === 'market') place.soloResearchType = 'food_shop';
}

for (const item of solo.evidence) {
  const p = byId.get(item.id);
  if (!p) throw new Error(`Unknown solo place: ${item.id}`);
  if (['solo_meal_review','solo_cafe_visit','solo_takeout_meal'].includes(item.kind)) {
    p.soloVerdict = 'review_only';
    p.soloVisit = 'solo_visit_review';
    p.soloReviewSource = item.source;
    p.soloReviewPublished = item.published || '게시일 확인 못함';
    p.soloReviewVisited = item.visited || '방문일 확인 못함';
    p.soloNote = item.basis;
    if (item.kind === 'solo_takeout_meal') {
      p.soloTakeout = 'available';
      p.soloTakeoutSource = item.source;
      p.soloMeal = true;
    }
  } else if (item.kind === 'solo_seat') {
    p.soloSeat = seatKind[item.id];
    p.soloSeatSource = item.source;
    p.soloSeatChecked = item.published || '게시일 확인 못함';
    p.soloNote = p.soloVisit === 'solo_visit_review' ? [p.soloNote, item.basis].filter(Boolean).join(' ') : item.basis;
  } else if (item.kind === 'specific_one_person_menu') {
    p.soloVerdict = 'specific_menu';
    p.soloMenu = '순두부백반 1인 주문 가능';
    p.soloMenuSource = item.source;
    p.minimumOrder = item.condition;
    p.minimumOrderSource = item.source;
  } else if (item.kind === 'one_person_price_unverified') {
    p.soloVerdict = 'single_item_unverified';
    p.soloMenu = item.basis;
    p.soloMenuSource = item.source;
  } else if (['minimum_order','menu_conflict'].includes(item.kind)) {
    p.minimumOrder = item.condition;
    p.minimumOrderSource = item.source;
    if (item.kind === 'menu_conflict') p.soloNote = item.basis;
  } else if (item.kind === 'takeout_only') {
    p.soloVerdict = 'takeout_only';
    p.soloTakeout = 'only';
    p.soloTakeoutSource = item.source;
    p.soloNote = item.basis;
  } else if (item.kind === 'takeout_conflict') {
    p.soloTakeout = 'unknown';
    p.soloNote = item.basis;
    p.soloSource = item.source;
  }
  p.soloSource ||= item.source;
}

for (const item of reservations.evidence) {
  const p = byId.get(item.id);
  if (!p) throw new Error(`Unknown reservation place: ${item.id}`);
  if (item.status === 'not_applicable') { delete p.reservation; continue; }
  const {id, ...reservation} = item;
  p.reservation = {...reservation, checked:reservations.checked};
}

writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Applied ${solo.evidence.length} solo evidence and ${reservations.evidence.length} reservation evidence entries to ${data.places.length} places.`);
