/* 조사 근거가 있는 방향별 버스 구간만 사용한다. 대기 시간은 저장하지 않는다. */
(() => {
  'use strict';

  let legs = [];
  const finite = Number.isFinite;
  const near = (a, b) => Math.abs(a.lat - b.lat) < .000001 && Math.abs(a.lon - b.lon) < .000001;
  const coordinate = p => p && finite(p.lat) && finite(p.lon) &&
    p.lat >= 33 && p.lat <= 39 && p.lon >= 124 && p.lon <= 132;
  const endpoint = p => coordinate(p) && typeof p.id === 'string' && p.id.length > 0;
  const stop = p => coordinate(p) && typeof p.id === 'string' && p.id.length > 0 &&
    typeof p.name === 'string' && p.name.length > 0;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const evidence = e => e && typeof e.label === 'string' && e.label.length > 0 &&
    typeof e.url === 'string' && e.url.startsWith('https://') &&
    validDate(e.checkedOn);
  const publishedLink = link => evidence(link) &&
    (link.sourceNote === undefined || typeof link.sourceNote === 'string');
  const clone = value => JSON.parse(JSON.stringify(value));

  function validBusPoints(points, from, to) {
    if (!Array.isArray(points) || points.length < 2 ||
        !points.every(p => Array.isArray(p) && p.length === 2 && p.every(finite))) return false;
    return near({lat: points[0][1], lon: points[0][0]}, from) &&
      near({lat: points.at(-1)[1], lon: points.at(-1)[0]}, to);
  }

  function validWalkSegment(segment, from, to) {
    return segment && finite(segment.meters) && segment.meters >= 0 &&
      finite(segment.minutes) && segment.minutes >= 0 &&
      (segment.points === undefined || validBusPoints(segment.points, from, to));
  }

  function validLeg(leg) {
    return leg && typeof leg.id === 'string' && leg.id.length > 0 &&
      endpoint(leg.from) && endpoint(leg.to) && leg.from.id !== leg.to.id &&
      typeof leg.routeNumber === 'string' && leg.routeNumber.length > 0 &&
      stop(leg.boardingStop) && stop(leg.alightingStop) &&
      leg.boardingStop.id !== leg.alightingStop.id &&
      finite(leg.averageBusRideMinutes) && leg.averageBusRideMinutes > 0 &&
      Array.isArray(leg.evidence) && leg.evidence.length > 0 && leg.evidence.every(evidence) &&
      (leg.timetableBased === undefined || typeof leg.timetableBased === 'boolean') &&
      (!leg.timetableBased || leg.timetable || leg.serviceNotice) &&
      (leg.timetable === undefined || publishedLink(leg.timetable)) &&
      (leg.serviceNotice === undefined || publishedLink(leg.serviceNotice)) &&
      validWalkSegment(leg.accessWalk, leg.from, leg.boardingStop) &&
      validWalkSegment(leg.egressWalk, leg.alightingStop, leg.to) &&
      (leg.busPoints === undefined || validBusPoints(leg.busPoints, leg.boardingStop, leg.alightingStop));
  }

  function setCatalog(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.legs))
      throw new Error('저장 버스 구간 형식이 올바르지 않습니다.');
    const ids = new Set();
    const choices = new Set();
    for (const leg of data.legs) {
      if (!validLeg(leg)) throw new Error('저장 버스 구간의 노선·정류장·탑승시간 또는 근거가 올바르지 않습니다.');
      const choice = `${leg.from.id}>${leg.to.id}:${leg.routeNumber}:${leg.boardingStop.id}>${leg.alightingStop.id}`;
      if (ids.has(leg.id) || choices.has(choice)) throw new Error('저장 버스 구간 ID 또는 경로가 중복됩니다.');
      ids.add(leg.id);
      choices.add(choice);
    }
    legs = clone(data.legs);
  }

  function options(from, to) {
    if (!endpoint(from) || !endpoint(to)) return [];
    return legs.filter(leg => leg.from.id === from.id && leg.to.id === to.id &&
      near(leg.from, from) && near(leg.to, to))
      .sort((a, b) => a.averageBusRideMinutes - b.averageBusRideMinutes || a.id.localeCompare(b.id))
      .map(clone);
  }

  function select(from, to, id = '') {
    const choices = options(from, to);
    return choices.find(leg => leg.id === id) || choices[0] || null;
  }

  const api = {setCatalog, options, select};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.HangeoreumSavedBusLegs = api;
})();
