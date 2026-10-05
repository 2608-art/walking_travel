const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {module: {exports: {}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/saved-bus-legs.js'), 'utf8'), context);
const bus = context.module.exports;
const from = {id: 'p1', lat: 34.79, lon: 126.38};
const to = {id: 'p2', lat: 34.80, lon: 126.42};
const boardingStop = {id: 'stop-1', name: '출발 정류장', lat: 34.791, lon: 126.381};
const alightingStop = {id: 'stop-2', name: '도착 정류장', lat: 34.799, lon: 126.419};
const leg = {
  id: 'bus-1', from, to, routeNumber: '1', boardingStop, alightingStop,
  averageBusRideMinutes: 12,
  timetableBased: true,
  accessWalk: {meters: 140, minutes: 3, points: [[from.lon, from.lat], [boardingStop.lon, boardingStop.lat]]},
  egressWalk: {meters: 120, minutes: 2, points: [[alightingStop.lon, alightingStop.lat], [to.lon, to.lat]]},
  evidence: [{label: '검증용 자료', url: 'https://example.org/bus', checkedOn: '2026-10-06'}],
  timetable: {label: '공식 시간표', url: 'https://example.org/timetable', checkedOn: '2026-10-06', sourceNote: '기점 출발시각만 포함'},
  serviceNotice: {label: '공식 운행 공지', url: 'https://example.org/notice', checkedOn: '2026-10-06'},
  busPoints: [[boardingStop.lon, boardingStop.lat], [alightingStop.lon, alightingStop.lat]],
};

bus.setCatalog({version: 1, legs: [leg, {...leg, id: 'bus-2', routeNumber: '2', averageBusRideMinutes: 15}]});
assert.equal(bus.options(from, to).length, 2);
assert.equal(bus.select(from, to).id, 'bus-1');
assert.equal(bus.select(from, to, 'bus-2').averageBusRideMinutes, 15);
assert.equal(bus.select(from, to).timetable.sourceNote, '기점 출발시각만 포함');
assert.equal(bus.select(from, to).serviceNotice.label, '공식 운행 공지');
assert.equal(bus.select(to, from), null);
assert.equal(bus.select({...from, lat: from.lat + .00001}, to), null);
assert.equal(bus.select(from, to).minutes, undefined); // 대기·접근 도보를 더한 총 시간으로 오인하지 않는다.
assert.equal(bus.select(from, to).accessWalk.minutes + bus.select(from, to).averageBusRideMinutes + bus.select(from, to).egressWalk.minutes, 17);
const selected = bus.select(from, to);
selected.boardingStop.name = '변경';
assert.equal(bus.select(from, to).boardingStop.name, '출발 정류장');
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, averageBusRideMinutes: 0}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, evidence: []}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, accessWalk: undefined}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, egressWalk: {...leg.egressWalk, points: [[126.3, 34.7], [to.lon, to.lat]]}}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, timetable: undefined, serviceNotice: undefined}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, timetable: {...leg.timetable, url: 'http://example.org/timetable'}}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, serviceNotice: {...leg.serviceNotice, checkedOn: '2026-02-31'}}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, evidence: [{...leg.evidence[0], checkedOn: '2026-02-31'}]}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [{...leg, busPoints: [[126.3, 34.7], [alightingStop.lon, alightingStop.lat]]}]}), /올바르지/);
assert.throws(() => bus.setCatalog({version: 1, legs: [leg, leg]}), /중복/);

const production = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/bus-legs.json'), 'utf8'));
assert.equal(production.version, 1);
assert.equal(production.legs.length, 0);
bus.setCatalog(production);
assert.equal(bus.options(from, to).length, 0);
console.log('PASS: directional bus options, coordinate and evidence validation, no fabricated production legs.');
