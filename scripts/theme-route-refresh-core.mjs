import crypto from 'node:crypto';

export const KST_TODAY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const closureWords = /폐업|휴업|공사|장기\s*휴관|전면\s*통제|임시\s*폐쇄/;

export function materialInput(place) {
  return {
    lat: place.lat ?? place.mapLat ?? null, lon: place.lon ?? place.mapLon ?? null,
    closedWeekdays: place.hours?.closedWeekdays ?? null,
    closedDates: place.hours?.closedDates ?? null,
    open: place.hours?.open ?? null, close: place.hours?.close ?? null,
    lastEntry: place.hours?.lastEntry ?? place.hours?.lastOrder ?? null,
    breaks: place.hours?.breaks ?? null, weeklyHours: place.weeklyHours ?? null,
    availability: place.availability ?? null,
    closureAlert: closureWords.test(place.closureText || '') ? place.closureText : null
  };
}

export function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function changedMaterialIds(previous, current) {
  return Object.keys(current).filter((id) => fingerprint(previous?.[id] ?? null) !== fingerprint(current[id]));
}

export function dateAfter(date) {
  if (date === '9999-12-31') return date;
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export function dateBefore(date) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function firstWeekdayInRange(from, through, weekday) {
  const day = new Date(`${from}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + (weekday - day.getUTCDay() + 7) % 7);
  const result = day.toISOString().slice(0, 10);
  return result <= through ? result : null;
}

export function isUnavailable(place, date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (place.hours?.closedDates?.includes(date) || place.hours?.closedWeekdays?.includes(day)) return true;
  const events = Array.isArray(place.availability) ? place.availability : place.availability ? [place.availability] : [];
  return events.some((event) => ['closed', 'permanently_closed', 'construction', 'suspended'].includes(event.status) &&
    (event.from || '0000-01-01') <= date && date <= (event.through || '9999-12-31'));
}

export function validateAvailability(place) {
  const events = Array.isArray(place.availability) ? place.availability : place.availability ? [place.availability] : [];
  for (const event of events) {
    if (!['closed', 'permanently_closed', 'construction', 'suspended'].includes(event.status) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(event.from || '') ||
        (event.through != null && (!/^\d{4}-\d{2}-\d{2}$/.test(event.through) || event.through < event.from)) ||
        !/^https?:\/\//.test(event.source || '') || !/^\d{4}-\d{2}-\d{2}$/.test(event.checkedAt || ''))
      throw new Error(`${place.id}: availability requires a supported status, dated range, source URL and checkedAt`);
  }
}

export function titleNamedPlaceIds(title, places) {
  const boundary = '[\\s·,./()→—–-]';
  return places.filter((place) => {
    if (!place?.name) return false;
    const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|${boundary})${escaped}(?=$|${boundary})`).test(title);
  }).map((place) => place.id);
}

export function changedWindows(placeIds, placeMap, previousInputs, today) {
  const boundaries = new Set();
  let ongoingReview = false;
  for (const id of placeIds) {
    const place = placeMap.get(id), before = previousInputs?.[id], now = materialInput(place);
    if (!before || fingerprint(before) === fingerprint(now)) continue;
    const events = Array.isArray(place.availability) ? place.availability : place.availability ? [place.availability] : [];
    for (const event of events) {
      if (!['closed', 'permanently_closed', 'construction', 'suspended'].includes(event.status)) continue;
      const start = event.from || today, through = event.through || '9999-12-31';
      if (through < today) continue;
      boundaries.add(start < today ? today : start);
      if (through !== '9999-12-31') boundaries.add(dateAfter(through));
    }
    for (const date of place.hours?.closedDates || []) if (date >= today) {
      boundaries.add(date); boundaries.add(dateAfter(date));
    }
    if (fingerprint(before.closedWeekdays) !== fingerprint(now.closedWeekdays) ||
        fingerprint(before.lat) !== fingerprint(now.lat) || fingerprint(before.lon) !== fingerprint(now.lon) ||
        fingerprint([before.open,before.close,before.lastEntry,before.breaks,before.weeklyHours]) !==
          fingerprint([now.open,now.close,now.lastEntry,now.breaks,now.weeklyHours]) ||
        (before.closureAlert !== now.closureAlert && now.closureAlert)) ongoingReview = true;
  }
  if (ongoingReview) boundaries.add(today);
  const sorted = [...boundaries].filter((date) => date <= '9999-12-31').sort();
  const windows = [];
  for (let i = 0; i < sorted.length; i++) {
    const through = i + 1 < sorted.length ? dateBefore(sorted[i + 1]) : '9999-12-31';
    if (sorted[i] <= through) windows.push({ from: sorted[i], through });
  }
  return windows;
}

export function updateStatus({ count, issues, titleMissing }) {
  if (count < 5) return 'suppressed';
  if (count <= 7 || titleMissing || issues.length) return 'needs-review';
  return 'walking-geometry-checked';
}
