const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const places = JSON.parse(fs.readFileSync('public/gangneung-places.json', 'utf8')).places;
const audit = JSON.parse(fs.readFileSync('한걸음/docs/지역/강릉/혼자여행-음식카페-조사.json', 'utf8'));
const bookings = JSON.parse(fs.readFileSync('한걸음/docs/지역/강릉/예약-조사.json', 'utf8'));
const sandbox = {module:{exports:{}}, console};
vm.runInNewContext(fs.readFileSync('public/solo-travel.js', 'utf8'), sandbox);
const solo = sandbox.module.exports;
const byId = new Map(places.map((p) => [p.id, p]));
const individual = places.filter((p) => p.category === 'food' || p.category === 'cafe' && p.id !== 'g15' || p.category === 'market' && !['g1','g2','g16','g50'].includes(p.id));
assert.equal(individual.length, 190);
assert.ok(individual.every((p) => p.soloChecked === audit.checked));
for (const p of places.filter((p) => p.reservation)) {
  assert.ok(['required','recommended','unknown'].includes(p.reservation.status));
  assert.ok(['whole_place','activity_only','specific_item','conditional_visit','lodging_only','unspecified'].includes(p.reservation.scope));
  assert.ok(p.reservation.scopeLabel && p.reservation.source && p.reservation.checked === bookings.checked);
}
for (const item of audit.evidence.filter((e) => ['solo_meal_review','solo_takeout_meal'].includes(e.kind))) {
  const p = byId.get(item.id);
  assert.equal(p.soloReviewSource, item.source);
  assert.equal(p.soloVisit, 'solo_visit_review');
  assert.equal(solo.canEat(p), true, `${p.name} should qualify by one direct meal report`);
}
for (const item of audit.evidence.filter((e) => e.kind === 'solo_seat')) {
  const p = byId.get(item.id);
  assert.equal(p.soloSeatSource, item.source);
  assert.ok(p.soloSeat !== 'unknown');
}
assert.equal(solo.canEat(byId.get('g85')), false, 'one-person price alone is not enough');
assert.equal(solo.canEat(byId.get('g63')), false, 'two-person minimum does not qualify');
assert.equal(byId.get('g245').reservation.scope, 'activity_only');
assert.equal(byId.get('g330').reservation.scope, 'specific_item');
assert.equal(byId.get('g137').reservation.status, 'required');
assert.equal(byId.get('g137').reservation.scope, 'specific_item');
assert.equal(byId.get('g33').reservation.scope, 'conditional_visit');
assert.equal(byId.get('g136').reservation.status, 'required');
assert.equal(byId.get('g170').reservation, undefined, 'on-site-only yacht registration is not an advance reservation warning');
const app = fs.readFileSync('public/app.js', 'utf8');
for (const snippet of [
  'beforeAddReservation([entry.placeId ? getPlace(entry.placeId) : null]',
  'beforeAddReservation([getPlace(entry.placeId)]',
  'beforeAddReservation([getPlace(item.entry.placeId)]',
  'beforeAddReservation(chosen.rows.map((row) => getPlace(row.placeId))'
]) assert.ok(app.includes(snippet), `timetable flow missing warning: ${snippet}`);
assert.ok(app.includes('시간표에 넣는 것은 예약 완료가 아닙니다'));
assert.ok(app.includes('candidateFilter:r.solo && r.mode !== \'theme\' ? soloTravel.canEat'), 'Gangneung custom route meal filter missing');
assert.ok(app.includes('(!d.solo || soloTravel.canVisit(p))'), 'planner solo recommendation filter missing');
console.log(`PASS: ${individual.length} solo-audited venues, ${places.filter((p)=>p.reservation).length} reservation notices, direct solo reports and four timetable entry paths.`);
