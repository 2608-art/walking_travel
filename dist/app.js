/* 한걸음 목포 — 브라우저 안에서 동작하는 여행 계획 도구 */
(() => {
  'use strict';
  const MOKPO = [34.7913, 126.3854];
  const REGIONS = [{id:'mokpo',name:'목포',center:MOKPO,ready:true,image:'./mokpo-card.webp',teaser:'유달산과 바다가 만나는 항구 도시',description:'유달산과 항구가 어우러진 목포. 근대역사거리와 해상케이블카가 기다려요.'}];
  const STATION = { id: 'station', name: '목포역', lat: 34.7914, lon: 126.3859 };
  const CATEGORIES = [
    ['all', '전체', '◉'], ['spot', '가볼 만한 곳', '✦'],
    ['food', '음식점', '♨'], ['cafe', '카페', '☕'], ['shop', '가게·시장', '▣']
  ];
  const STORAGE_DRAFT = 'hangeoreum-draft-v1';
  const STORAGE_SAVED = 'hangeoreum-saved-v1';
  const $ = (selector) => document.querySelector(selector);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('저장 공간이 부족하거나 차단되었습니다.'); return false; } };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const hhmm = (m) => (m >= 1440 ? '다음 날 ' : '') + String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = (value) => { const [h, m] = String(value || '09:00').split(':').map(Number); return h * 60 + m; };
  const dateAt = (base, minute) => { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Math.floor(minute / 1440)); return d.toISOString().slice(0, 10); };
  const weekday = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
  const findByName = (name) => state.places.find((p) => p.name === name);
  const getPlace = (id) => state.places.find((p) => p.id === id);
  const coord = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
  const km = (a, b) => { if (!coord(a) || !coord(b)) return null; const r = Math.PI / 180, dy = (b.lat - a.lat) * r, dx = (b.lon - a.lon) * r * Math.cos((a.lat+b.lat) / 2 * r); return 111.2 * Math.hypot(dx, dy); };
  let toastTimer;
  function toast(message) { const el = $('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3600); }
  const state = {
    places: [], view: 'home', region: 'mokpo', category: 'all', selected: null,
    mapCenter: MOKPO, mapZoom: 13, map: null, mapLine: null,
    draft: load(STORAGE_DRAFT, null) || { id: null, title: '나의 목포 하루', date: today(), start: '09:00', origin: null, entries: {} },
    saved: load(STORAGE_SAVED, []),
    route: { date: today(), start: '10:00', end: '18:00', origin: 'station', must: '', results: [], selected: -1 },
    pinMode: false, pinSelection: null, searchResults: []
  };
  function persistDraft() { save(STORAGE_DRAFT, state.draft); }
  function statusConnection() { const el = $('#connection'); if (!el) return; el.textContent = navigator.onLine ? '온라인' : '오프라인 · 저장한 글만'; el.classList.toggle('offline', !navigator.onLine); }
  function nav(view) { state.view = view; render(); window.scrollTo(0, 0); }
  function render() {
    statusConnection();
    document.body.classList.toggle('destination-home', state.view === 'home');
    document.querySelectorAll('[data-nav]').forEach((b) => { const active = b.dataset.nav === state.view || (b.dataset.nav === 'home' && state.view === 'region'); b.classList.toggle('active', active); b.setAttribute('aria-current', active ? 'page' : 'false'); });
    if (state.view === 'home') renderHome();
    else if (state.view === 'region') renderRegionMap();
    else if (state.view === 'plan') renderPlan();
    else if (state.view === 'routes') renderRoutes();
    else if (state.view === 'saved') renderSaved();
    else if (state.view === 'routeMap') renderRouteMap();
  }
  function categoryName(cat) { return CATEGORIES.find((x) => x[0] === cat)?.[1] || '장소'; }
  function placeTimeText(p) {
    if (!p?.hours) return '운영시간 확인 필요';
    let text = p.hours.open + '–' + p.hours.close;
    if (p.hours.breaks?.length) text += ' · 브레이크 ' + p.hours.breaks.map((b) => b.join('–')).join(', ');
    if (p.hours.lastEntry) text += ' · 공식 입장 ' + p.hours.lastEntry + '까지';
    if (p.hours.lastOrder) text += ' · 주문 ' + p.hours.lastOrder + '까지';
    if (!p.hours.lastEntry && !p.hours.lastOrder) text += ' · 앱 권장 입장 ' + hhmm(toMin(p.hours.close) - 60) + ' 이전(제한 아님)';
    return text;
  }
  function detailHtml(p) {
    return '<div class="detail-card card"><div class="detail-header"><div><span class="pill">' + esc(categoryName(p.category)) + '</span><h2 style="margin-top:9px">' + esc(p.name) + '</h2></div><button class="btn btn-sm btn-outline" id="close-detail" aria-label="장소 정보 닫기">닫기</button></div>' +
      '<p>' + esc(p.locationText || '위치 설명 없음') + '</p><div class="notice ' + (p.hours ? '' : 'warn') + '">' + esc(placeTimeText(p)) + (p.hours?.note ? '<br>' + esc(p.hours.note) : '') + '</div>' +
      '<div class="detail-actions"><button class="btn btn-primary btn-sm" id="add-place-plan">계획표에 넣기</button>' + (p.source ? '<a class="btn btn-outline btn-sm" href="' + esc(p.source) + '" target="_blank" rel="noopener noreferrer">위치·출처 보기</a>' : '') + '</div><p class="small" style="margin:12px 0 0">자료 확인일 2026-10-01 · 실제 출입문과 임시휴무는 방문 전 확인하세요.</p></div>';
  }
  function renderHome() {
    $('#main').innerHTML = '<section class="page destination-page"><div class="destination-head"><div class="eyebrow">한걸음 여행지</div><h1>어디로 떠나세요?</h1><p>여행지를 선택해 지도를 보고, 내 속도에 맞는 하루를 계획해 보세요.</p></div><div class="destination-grid">' + REGIONS.filter((x) => x.ready).map((x) => '<button type="button" class="destination-tile" data-region="' + esc(x.id) + '" aria-label="' + esc(x.name) + ' 여행지 소개 보기"><img src="' + esc(x.image) + '" alt="" loading="eager"><span class="destination-shade"></span><span class="destination-copy"><strong>' + esc(x.name) + '</strong><small>' + esc(x.teaser) + '</small></span><span class="destination-arrow" aria-hidden="true">↗</span></button>').join('') + '</div></section>';
    document.querySelectorAll('[data-region]').forEach((b) => b.onclick = () => { const region = REGIONS.find((x) => x.id === b.dataset.region); if (region) showRegionIntro(region); });
  }
  function showRegionIntro(region) {
    openModal('<div class="destination-dialog-image"><img src="' + esc(region.image) + '" alt="유달산, 해상케이블카와 항구를 그린 ' + esc(region.name) + ' 일러스트"></div><div class="eyebrow" style="margin-top:18px">여행지 소개</div><h2>' + esc(region.name) + '</h2><p>' + esc(region.description) + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>닫기</button><button class="btn btn-primary" id="choose-region">선택</button></div>', () => {
      $('#choose-region').onclick = () => { state.region = region.id; state.mapCenter = region.center; state.mapZoom = 13; state.selected = null; state.category = 'all'; closeModal(); nav('region'); };
    });
  }
  function renderRegionMap() {
    const region = REGIONS.find((x) => x.id === state.region) || REGIONS[0];
    const list = (region.ready ? state.places : []).filter((p) => state.category === 'all' || p.category === state.category);
    $('#main').innerHTML = '<section class="page"><button class="back" id="region-back">← 여행지 선택</button><div class="page-head"><div><div class="eyebrow">선택한 여행지</div><h1>' + esc(region.name) + ' 지도</h1><p>장소를 살펴보고 계획을 시작해 보세요.</p></div></div><div class="home-layout"><div class="left-panel">' +
      '<div class="card home-search"><label class="field-label" for="map-search">장소 또는 주소 검색</label><form id="map-search-form" class="search-row"><input id="map-search" class="text-field" autocomplete="off" placeholder="목포역, 평화광장, 주소"><button class="btn btn-primary" type="submit">검색</button></form><p class="small" style="margin:8px 0 0">앱 장소를 먼저 찾고, 없으면 지도 검색으로 이동합니다.</p></div>' +
      '<div class="action-grid home-actions"><button type="button" class="action-tile" id="go-plan" ' + (region.ready ? '' : 'disabled') + '><span class="action-symbol">▤</span><strong>계획</strong><small>한 칸씩 직접 짜기</small></button><button type="button" class="action-tile" id="go-routes" ' + (region.ready ? '' : 'disabled') + '><span class="action-symbol">↗</span><strong>추천 루트</strong><small>여러 동선 비교하기</small></button></div>' +
      '</div><div class="map-column"><div class="map-frame"><div id="map"></div><div class="map-tools"><button class="btn btn-sm btn-outline" type="button" id="recenter">' + esc(region.name) + '로 돌아가기</button></div><div class="map-caption">' + (region.ready ? '지도 핀은 대표 위치입니다. 출입구·보행 경로는 별도 확인이 필요할 수 있어요.' : '아직 검증된 장소 핀이 없습니다.') + '</div></div>' +
      '<div class="filter-strip" aria-label="장소 유형">' + CATEGORIES.map(([id, label, icon]) => '<button type="button" class="filter-chip ' + (state.category === id ? 'active' : '') + '" data-category="' + id + '" aria-pressed="' + (state.category === id) + '"><span aria-hidden="true">' + icon + '</span> ' + label + '</button>').join('') + '</div>' +
      '<div class="results-title"><span>' + esc(categoryName(state.category)) + ' · ' + list.length + '곳</span><span>지도 핀 ' + list.filter(coord).length + '곳</span></div><div class="place-list">' + list.map((p) => '<button type="button" class="place-row" data-place="' + p.id + '"><strong>' + esc(p.name) + '</strong><small>' + esc(p.locationText || '위치 확인 필요') + '</small></button>').join('') + '</div><div id="place-detail">' + (state.selected ? detailHtml(getPlace(state.selected)) : '') + '</div></div></div></section>';
    initHomeMap(list);
    $('#region-back').onclick = () => nav('home');
    $('#go-plan').onclick = () => nav('plan'); $('#go-routes').onclick = () => nav('routes');
    $('#recenter').onclick = () => { state.map?.setView(region.center, 13); state.mapCenter = region.center; state.mapZoom = 13; };
    $('#map-search-form').onsubmit = searchMap;
    document.querySelectorAll('[data-category]').forEach((b) => b.onclick = () => { state.category = b.dataset.category; state.selected = null; renderRegionMap(); });
    document.querySelectorAll('[data-place]').forEach((b) => b.onclick = () => selectPlace(b.dataset.place));
    bindDetail();
  }
  function initHomeMap(list) {
    if (!window.L || !navigator.onLine) { $('#map').innerHTML = '<div class="empty-state" style="margin:20px">지도는 인터넷에 연결하면 볼 수 있습니다.</div>'; return; }
    const map = L.map('map', { zoomControl: false }).setView(state.mapCenter, state.mapZoom);
    state.map = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    const colors = { spot: '#0c8f71', food: '#cc6d39', cafe: '#8262b4', shop: '#336fa0' };
    list.filter(coord).forEach((p) => {
      const marker = L.circleMarker([p.lat, p.lon], { radius: 7, weight: 2, color: '#fff', fillColor: colors[p.category] || '#123348', fillOpacity: .95 }).addTo(map);
      marker.bindTooltip(esc(p.name)); marker.on('click', () => selectPlace(p.id));
    });
    map.on('moveend', () => { state.mapCenter = [map.getCenter().lat, map.getCenter().lng]; state.mapZoom = map.getZoom(); });
    setTimeout(() => map.invalidateSize(), 50);
  }
  function selectPlace(id) {
    state.selected = id; const p = getPlace(id); if (!p) return;
    if (coord(p) && state.map) state.map.flyTo([p.lat, p.lon], Math.max(state.map.getZoom(), 15), { duration: .5 });
    $('#place-detail').innerHTML = detailHtml(p); bindDetail(); $('#place-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function bindDetail() {
    if ($('#close-detail')) $('#close-detail').onclick = () => { state.selected = null; $('#place-detail').innerHTML = ''; };
    if ($('#add-place-plan')) $('#add-place-plan').onclick = () => { nav('plan'); toast('시간 칸을 눌러 이 장소를 넣어주세요.'); };
  }
  async function searchMap(event) {
    event.preventDefault(); const q = $('#map-search').value.trim(); if (!q) return;
    const match = state.region === 'mokpo' ? state.places.find((p) => p.name.includes(q) && coord(p)) : null;
    if (match) { selectPlace(match.id); return; }
    if (!navigator.onLine) { toast('위치 검색은 인터넷이 필요합니다.'); return; }
    try {
      const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(q);
      const res = await fetch(u); const hits = await res.json();
      if (!hits.length) { toast('검색 결과를 찾지 못했습니다.'); return; }
      state.map?.flyTo([Number(hits[0].lat), Number(hits[0].lon)], 15); toast('검색한 위치로 지도를 옮겼습니다.');
    } catch { toast('위치 검색에 실패했습니다. 다시 시도해 주세요.'); }
  }
  function openModal(body, onOpen) {
    const root = $('#modal-root');
    root.innerHTML = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">' + body + '</div></div>';
    root.querySelector('.modal-backdrop').onclick = (e) => { if (e.target.classList.contains('modal-backdrop')) closeModal(); };
    root.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
    if (onOpen) onOpen(root);
    setTimeout(() => root.querySelector('button,input')?.focus(), 0);
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }
  function entryPlace(entry) { return entry?.placeId ? getPlace(entry.placeId) : null; }
  function entryLabel(entry) { return entryPlace(entry)?.name || entry?.name || '이름 없는 장소'; }
  function entryCoord(entry) { const p = entryPlace(entry); return p || entry; }
  function evaluate(entry, minute, date) {
    const p = entryPlace(entry);
    const h = p?.hours;
    if (!p || !h) return { kind: 'unknown', title: '운영시간 확인 필요', detail: '장소 운영정보가 없어 가능 여부를 확정할 수 없습니다.' };
    const actualDate = dateAt(date, minute);
    const m = minute % 1440;
    if (h.closedWeekdays?.includes(weekday(actualDate))) return { kind: 'bad', title: '정기 휴무 가능', detail: h.note || '방문일 휴무를 확인하세요.' };
    if (m < toMin(h.open)) return { kind: 'bad', title: '운영 시작 전', detail: h.open + '부터 운영합니다.' };
    if (m >= toMin(h.close)) return { kind: 'bad', title: '운영 종료 후', detail: h.close + '에 운영이 끝납니다.' };
    const deadline = h.lastEntry || h.lastOrder;
    if (deadline && m > toMin(deadline)) return { kind: 'bad', title: '공식 마감 경과', detail: (h.lastEntry ? '입장' : '주문') + ' 마감 ' + deadline + '을 지났습니다.' };
    if (h.breaks?.some(([a,b]) => m >= toMin(a) && m < toMin(b))) return { kind: 'bad', title: '브레이크타임 중', detail: '운영 재개 시각을 확인해 시간을 옮겨 주세요.' };
    const duration = Number(entry.duration) || 60;
    if (h.breaks?.some(([a]) => m < toMin(a) && m + duration > toMin(a))) return { kind: 'warn', title: '체류 중 브레이크타임', detail: '예상 체류가 브레이크타임과 겹칩니다. 이용 가능 시간을 확인하세요.' };
    if (m + duration > toMin(h.close)) return { kind: 'warn', title: '예상 체류가 폐관을 넘어요', detail: '체류시간을 줄이거나 더 일찍 방문해 주세요.' };
    const soft = !deadline && m > toMin(h.close) - 60 ? ' · 폐관 1시간 전 입장은 앱의 권장일 뿐 제한이 아닙니다.' : '';
    return { kind: 'ok', title: '운영시간상 방문 가능', detail: (h.note || '방문일 변동을 확인하세요.') + soft };
  }
  function pillFor(result) { return '<span class="pill ' + (result.kind === 'bad' ? 'bad' : result.kind === 'ok' ? '' : 'warn') + '">' + esc(result.title) + '</span>'; }
  function planSlots() {
    const start = toMin(state.draft.start);
    const set = new Set();
    for (let m = start; m < 1440; m += 60) set.add(m);
    Object.keys(state.draft.entries || {}).map(Number).filter((m) => m >= start).forEach((m) => set.add(m));
    return [...set].sort((a,b) => a-b);
  }
  function renderPlan() {
    const d = state.draft;
    if (!d.entries) d.entries = {};
    const slots = planSlots();
    const filled = slots.filter((m) => d.entries[m]);
    $('#main').innerHTML = '<section class="page"><button class="back" id="plan-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">나의 하루 계획</div><h1>시간계획표</h1><p>시간은 예상입니다. 실제로 떠날 때 다음 장소의 길을 열어보세요.</p></div><div class="top-actions"><button class="btn btn-outline" id="new-plan">새 계획</button><button class="btn btn-primary" id="save-plan">계획 저장</button></div></div>' +
      '<div class="planner-grid"><div><div class="card"><label class="field-label" for="plan-title">계획 이름</label><input class="text-field" id="plan-title" value="' + esc(d.title) + '" maxlength="80"><div class="form-grid" style="margin-top:14px"><div class="field-group"><label class="field-label" for="plan-date">날짜</label><input class="text-field" type="date" id="plan-date" value="' + esc(d.date) + '"></div><div class="field-group"><label class="field-label" for="plan-start">시작 시각</label><input class="text-field" type="time" id="plan-start" value="' + esc(d.start) + '"></div><div class="field-group"><label class="field-label">계획 범위</label><div class="notice">' + esc(d.start) + '부터 자정까지</div></div></div></div>' +
      '<div class="slot-list">' + slots.map((m) => slotHtml(m, d.entries[m])).join('') + '</div></div>' +
      '<aside class="card plan-aside"><div class="eyebrow">계획 안내</div><h3>내 일정은 내 속도로</h3><p>장소에서 일찍 나오거나 오래 머물러도 괜찮아요. 다음 장소로 출발할 때 버튼을 누르면 그 시각 기준으로 다시 확인합니다.</p><div class="notice">운영시간·브레이크·공식 입장/주문 마감을 확인합니다. <strong>폐관 1시간 전 입장</strong>은 권장 안내이며 자동 삭제 기준이 아닙니다.</div><p class="small" style="margin:14px 0 0">장소 정보 기준 2026-10-01. 임시휴무와 실제 출입구는 방문 전에 다시 확인하세요.</p></aside></div></section>';
    $('#plan-back').onclick = () => nav('region');
    $('#save-plan').onclick = savePlan;
    $('#new-plan').onclick = () => openModal('<h2>새 계획을 시작할까요?</h2><p>현재 계획은 저장하지 않았다면 복구할 수 없습니다.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="confirm-new">새 계획</button></div>', () => { $('#confirm-new').onclick = () => { state.draft = { id: null, title: '나의 목포 하루', date: today(), start: '09:00', origin: null, entries: {} }; persistDraft(); closeModal(); renderPlan(); }; });
    $('#plan-title').onchange = (e) => { d.title = e.target.value.trim() || '나의 목포 하루'; persistDraft(); };
    $('#plan-date').onchange = (e) => { d.date = e.target.value || today(); persistDraft(); renderPlan(); };
    $('#plan-start').onchange = (e) => changePlanStart(e.target.value);
    document.querySelectorAll('[data-edit-slot]').forEach((b) => b.onclick = () => openSlotEditor(Number(b.dataset.editSlot)));
    document.querySelectorAll('[data-remove-slot]').forEach((b) => b.onclick = () => removeEntry(Number(b.dataset.removeSlot)));
    document.querySelectorAll('[data-go-next]').forEach((b) => b.onclick = () => showJourney(Number(b.dataset.goNext)));
    if (!filled.length) $('.slot-list')?.insertAdjacentHTML('afterbegin', '<div class="notice">시간 칸을 눌러 장소를 하나씩 넣어 보세요.</div>');
  }
  function slotHtml(minute, entry) {
    const time = '<div class="slot-time">' + esc(hhmm(minute)) + '<small>' + esc(hhmm(Math.min(minute + 60, 1440))) + '까지</small></div>';
    if (!entry) return '<div class="slot-card">' + time + '<div class="slot-content slot-empty"><span>아직 계획이 없어요.</span><button class="btn btn-outline btn-sm" data-edit-slot="' + minute + '">+ 이 시간에 추가</button></div></div>';
    const result = evaluate(entry, minute, state.draft.date);
    const place = entryPlace(entry);
    return '<div class="slot-card">' + time + '<div class="slot-content"><div class="toolbar" style="justify-content:space-between"><h3>' + esc(entryLabel(entry)) + '</h3>' + pillFor(result) + '</div><p>' + esc(result.detail) + '</p>' + (place ? '<p class="small">' + esc(placeTimeText(place)) + '</p>' : '<p class="small">직접 입력한 장소 · 영업 정보 미확인</p>') + (entry.memo ? '<p>메모 · ' + esc(entry.memo) + '</p>' : '') + '<div class="slot-actions"><button class="btn btn-mint btn-sm" data-go-next="' + minute + '">이제 이 장소로 이동</button><button class="btn btn-outline btn-sm" data-edit-slot="' + minute + '">수정</button><button class="btn btn-outline btn-sm" data-remove-slot="' + minute + '">삭제</button></div></div></div>';
  }
  function recommendations(minute) {
    const d = state.draft;
    const used = new Set(Object.values(d.entries).map((e) => e.placeId));
    const earlier = Object.entries(d.entries).map(([t,e]) => [Number(t),e]).filter(([t,e]) => t < minute && coord(entryCoord(e))).sort((a,b) => b[0]-a[0])[0];
    const anchor = earlier ? entryCoord(earlier[1]) : STATION;
    return state.places.filter((p) => coord(p) && p.hours && !used.has(p.id))
      .map((p) => ({ p, result: evaluate({placeId:p.id,duration:60},minute,d.date), distance: km(anchor,p) || 99 }))
      .filter((v) => v.result.kind === 'ok' || v.result.kind === 'warn')
      .sort((a,b) => a.distance-b.distance).slice(0,3);
  }
  function openSlotEditor(minute) {
    const entry = state.draft.entries[minute]; const recs = recommendations(minute);
    const body = '<h2>' + esc(hhmm(minute)) + ' 계획</h2><p>추천 장소를 누르면 바로 이 시간 칸에 들어갑니다.</p><div class="section-label">이 시간에 추천하는 장소</div>' +
      (recs.length ? '<div class="suggest-grid">' + recs.map(({p,result}) => '<button class="suggest-btn" data-recommend="' + p.id + '"><strong>' + esc(p.name) + '</strong><small>' + esc(placeTimeText(p)) + '</small></button>').join('') + '</div>' : '<div class="notice warn">확인된 운영정보로 추천할 장소가 없습니다. 직접 입력할 수 있어요.</div>') +
      '<div class="divider"></div><div class="section-label">입력</div><label class="field-label" for="place-picker">앱에 있는 장소 찾기</label><input class="text-field" id="place-picker" autocomplete="off" placeholder="장소 이름 검색"><div id="picker-results" class="picker-list" style="display:none"></div>' +
      '<div class="section-label">또는 내가 아는 장소 직접 추가</div><div class="form-grid two"><div class="field-group"><label class="field-label" for="custom-name">이름</label><input class="text-field" id="custom-name" value="' + esc(entry?.name || '') + '" placeholder="장소 이름"></div><div class="field-group"><label class="field-label" for="custom-location">위치·주소</label><input class="text-field" id="custom-location" value="' + esc(entry?.locationText || '') + '" placeholder="주소 또는 위치 설명"></div></div><button class="btn btn-outline btn-sm" style="margin-top:8px" id="choose-pin">지도에서 위치 찍기</button><span id="pin-note" class="small" style="margin-left:8px">' + (coord(entry) ? '핀 지정됨' : '핀 미지정') + '</span>' +
      '<div class="form-grid two" style="margin-top:15px"><div class="field-group"><label class="field-label" for="entry-duration">예상 체류</label><select class="select-field" id="entry-duration">' + [30,60,90,120].map((v) => '<option value="' + v + '" ' + ((entry?.duration || 60) === v ? 'selected' : '') + '>' + v + '분</option>').join('') + '</select></div><div class="field-group"><label class="field-label" for="entry-memo">기타 메모</label><input class="text-field" id="entry-memo" value="' + esc(entry?.memo || '') + '" placeholder="적어 두고 싶은 내용"></div></div>' +
      '<div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="save-custom">이 칸에 넣기</button></div>';
    openModal(body, () => {
      document.querySelectorAll('[data-recommend]').forEach((b) => b.onclick = () => setEntry(minute, { placeId: b.dataset.recommend, duration: 60, memo: '' }));
      $('#place-picker').oninput = (e) => {
        const q = e.target.value.trim().toLowerCase(); const box = $('#picker-results');
        if (!q) { box.style.display = 'none'; return; }
        const matches = state.places.filter((p) => p.name.toLowerCase().includes(q)).slice(0,8);
        box.style.display = 'block'; box.innerHTML = matches.length ? matches.map((p) => '<button class="picker-option" data-picker="' + p.id + '"><strong>' + esc(p.name) + '</strong><small>' + esc(placeTimeText(p)) + '</small></button>').join('') : '<div class="small" style="padding:12px">자료에 없는 장소입니다. 아래에서 직접 추가하세요.</div>';
        box.querySelectorAll('[data-picker]').forEach((b) => b.onclick = () => setEntry(minute, { placeId:b.dataset.picker, duration:Number($('#entry-duration').value), memo:$('#entry-memo').value.trim() }));
      };
      $('#choose-pin').onclick = () => chooseCustomPin(minute);
      $('#save-custom').onclick = () => {
        const name = $('#custom-name').value.trim(); if (!name) { toast('장소 이름을 입력해 주세요.'); $('#custom-name').focus(); return; }
        const pin = state.pinSelection;
        setEntry(minute, { name, locationText: $('#custom-location').value.trim(), lat:pin?.lat ?? entry?.lat ?? null, lon:pin?.lon ?? entry?.lon ?? null, duration:Number($('#entry-duration').value), memo:$('#entry-memo').value.trim() });
      };
    });
  }
  function setEntry(minute, entry) { state.draft.entries[minute] = entry; state.pinSelection = null; persistDraft(); closeModal(); renderPlan(); toast('계획표에 넣었습니다.'); }
  function removeEntry(minute) { openModal('<h2>이 계획을 삭제할까요?</h2><p>' + esc(entryLabel(state.draft.entries[minute])) + ' · ' + esc(hhmm(minute)) + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-danger" id="confirm-remove">삭제</button></div>', () => { $('#confirm-remove').onclick = () => { delete state.draft.entries[minute]; persistDraft(); closeModal(); renderPlan(); }; }); }
  function chooseCustomPin(minute) {
    if (!navigator.onLine || !window.L) { toast('지도에서 위치를 찍으려면 인터넷이 필요합니다.'); return; }
    const name = $('#custom-name').value, locationText = $('#custom-location').value, duration = $('#entry-duration').value, memo = $('#entry-memo').value;
    const pin = state.pinSelection;
    openModal('<h2>지도에서 위치 찍기</h2><p>지도 위를 눌러 장소 위치를 선택하세요. 실제 건물 출입구인지 확인해 주세요.</p><div class="pin-map-wrap"><div id="pin-map"></div></div><p id="picked-coord" class="small">' + (pin ? pin.lat.toFixed(5) + ', ' + pin.lon.toFixed(5) : '아직 위치를 찍지 않았습니다.') + '</p><div class="modal-actions"><button class="btn btn-outline" id="pin-back">돌아가기</button><button class="btn btn-primary" id="pin-done" ' + (pin ? '' : 'disabled') + '>위치 사용</button></div>', () => {
      const map = L.map('pin-map').setView(pin ? [pin.lat,pin.lon] : MOKPO, 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map);
      let marker = pin ? L.circleMarker([pin.lat,pin.lon],{radius:9,color:'#087a61'}).addTo(map) : null;
      map.on('click', (e) => { state.pinSelection = {lat:e.latlng.lat,lon:e.latlng.lng}; marker?.remove(); marker = L.circleMarker(e.latlng,{radius:9,color:'#087a61',fillColor:'#71e0bc',fillOpacity:1}).addTo(map); $('#picked-coord').textContent = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5); $('#pin-done').disabled = false; });
      const back = () => { openSlotEditor(minute); $('#custom-name').value = name; $('#custom-location').value = locationText; $('#entry-duration').value = duration; $('#entry-memo').value = memo; };
      $('#pin-back').onclick = back; $('#pin-done').onclick = back; setTimeout(() => map.invalidateSize(),60);
    });
  }
  function changePlanStart(value) {
    if (!value) { renderPlan(); return; }
    const old = toMin(state.draft.start), next = toMin(value);
    if (next <= old) { state.draft.start = value; persistDraft(); renderPlan(); return; }
    const affected = Object.keys(state.draft.entries).map(Number).filter((m) => m < next).sort((a,b) => a-b);
    if (!affected.length) { state.draft.start = value; persistDraft(); renderPlan(); return; }
    const names = affected.map((m) => hhmm(m) + ' ' + entryLabel(state.draft.entries[m])).join(', ');
    openModal('<h2>앞쪽 시간대에 계획이 있어요</h2><p>' + esc(names) + '</p><p>시작 시각을 ' + esc(value) + '로 바꾸면 이 칸들이 사라집니다.</p><div class="modal-actions"><button class="btn btn-outline" id="start-cancel">변경 취소</button><button class="btn btn-outline" id="start-delete">삭제하기</button><button class="btn btn-primary" id="start-move">옮기기</button></div>', () => {
      $('#start-cancel').onclick = () => { closeModal(); renderPlan(); };
      $('#start-delete').onclick = () => { const entries = {...state.draft.entries}; affected.forEach((m) => delete entries[m]); previewStartChange(value,entries,affected.map((m) => [m,state.draft.entries[m]])); };
      $('#start-move').onclick = () => chooseMoveMode(value,old,affected);
    });
  }
  function chooseMoveMode(value, old, affected) {
    const delta = toMin(value) - old;
    openModal('<h2>계획을 어떻게 옮길까요?</h2><p>시간을 ' + Math.floor(delta/60) + '시간 ' + delta%60 + '분 늦춥니다.</p><div class="modal-actions"><button class="btn btn-outline" id="move-cancel">취소</button><button class="btn btn-outline" id="move-manual">사라지는 칸만 직접 옮기기</button><button class="btn btn-primary" id="move-all">전체 일정 밀기</button></div>', () => {
      $('#move-cancel').onclick = () => { closeModal(); renderPlan(); };
      $('#move-all').onclick = () => { const entries = {}; Object.entries(state.draft.entries).forEach(([m,e]) => { entries[Number(m)+delta] = e; }); previewStartChange(value,entries,[]); };
      $('#move-manual').onclick = () => manualMove(value,affected);
    });
  }
  function manualMove(value,affected) {
    const fields = affected.map((m,i) => '<div class="field-group"><label class="field-label" for="move-' + i + '">' + esc(entryLabel(state.draft.entries[m])) + ' · 기존 ' + esc(hhmm(m)) + '</label><input type="time" class="text-field" id="move-' + i + '" value="' + esc(value) + '"></div>').join('');
    openModal('<h2>새 시간대를 골라 주세요</h2><p>이미 다른 계획이 있는 시간은 선택할 수 없습니다.</p><div class="form-grid two">' + fields + '</div><div class="modal-actions"><button class="btn btn-outline" id="manual-cancel">취소</button><button class="btn btn-primary" id="manual-preview">변경 미리보기</button></div>', () => {
      $('#manual-cancel').onclick = () => { closeModal(); renderPlan(); };
      $('#manual-preview').onclick = () => {
        const entries = {...state.draft.entries}; affected.forEach((m) => delete entries[m]);
        for (let i=0;i<affected.length;i++) { const dest = toMin($('#move-'+i).value); if (dest < toMin(value) || entries[dest]) { toast('겹치거나 시작 전인 시간대가 있습니다.'); return; } entries[dest] = state.draft.entries[affected[i]]; }
        previewStartChange(value,entries,[]);
      };
    });
  }
  function previewStartChange(value,entries,removed) {
    const conflicts = Object.entries(entries).map(([m,e]) => ({minute:Number(m),entry:e,result:evaluate(e,Number(m),state.draft.date)})).filter((x) => x.result.kind === 'bad');
    const issues = removed.map(([m,e]) => '<li>' + esc(hhmm(m)) + ' ' + esc(entryLabel(e)) + ' — 앞쪽 시간 칸이 사라져 <strong>이 계획은 삭제됩니다.</strong></li>').concat(conflicts.map((x) => '<li>' + esc(hhmm(x.minute)) + ' ' + esc(entryLabel(x.entry)) + ' — ' + esc(x.result.title) + '. 적용하면 <strong>이 계획은 삭제됩니다.</strong></li>'));
    openModal('<h2>시간 변경 미리보기</h2><p>새 시작 시각: <strong>' + esc(value) + '</strong></p>' + (issues.length ? '<div class="notice warn"><strong>삭제되는 계획</strong><ul>' + issues.join('') + '</ul></div>' : '<div class="notice">삭제되는 계획이 없습니다.</div>') + '<p class="small">앱의 폐관 1시간 전 입장 권장만으로는 삭제하지 않습니다.</p><div class="modal-actions"><button class="btn btn-outline" id="preview-cancel">변경 취소</button><button class="btn btn-primary" id="preview-apply">' + (issues.length ? '삭제 확인하고 적용' : '변경 적용') + '</button></div>', () => {
      $('#preview-cancel').onclick = () => { closeModal(); renderPlan(); };
      $('#preview-apply').onclick = () => { conflicts.forEach((x) => delete entries[x.minute]); state.draft.start = value; state.draft.entries = entries; persistDraft(); closeModal(); renderPlan(); };
    });
  }
  function savePlan() {
    const d = JSON.parse(JSON.stringify(state.draft)); d.title = $('#plan-title')?.value.trim() || d.title || '나의 목포 하루';
    d.id = d.id || 'plan-' + Date.now(); d.savedAt = new Date().toISOString();
    state.draft = d; const i = state.saved.findIndex((p) => p.id === d.id);
    if (i >= 0) state.saved[i] = d; else state.saved.unshift(d);
    if (save(STORAGE_SAVED,state.saved)) { persistDraft(); toast('이 기기에 계획을 저장했습니다.'); }
  }
  function routeOrigin() {
    if (state.route.origin === 'current' && state.route.current) return state.route.current;
    return getPlace(state.route.origin) || STATION;
  }
  function makeRoutes() {
    const r = state.route, start = toMin(r.start), end = toMin(r.end);
    if (end <= start) return [];
    const origin = routeOrigin();
    const pool = state.places.filter((p) => coord(p) && p.hours && p.category !== 'food').sort((a,b) => (km(origin,a) || 99) - (km(origin,b) || 99));
    const required = getPlace(r.must);
    const seeds = required ? [required,required,required] : pool.slice(0,6);
    const routes = [];
    for (let i = 0; i < seeds.length; i++) {
      const first = seeds[i]; if (!coord(first)) continue;
      const chain = [first];
      const near = pool.filter((p) => p.id !== first.id).sort((a,b) => (km(first,a) || 99) - (km(first,b) || 99));
      if (near[required ? i : 0]) chain.push(near[required ? i : 0]);
      let minute = start, prior = origin, rows = [], hard = false;
      for (const p of chain) {
        const direct = km(prior,p) || 0;
        const walkEstimate = Math.max(10, Math.ceil(direct * 1.4 / 4 * 60 / 5) * 5);
        minute += walkEstimate;
        const visit = Math.ceil(minute / 5) * 5;
        const result = evaluate({placeId:p.id,duration:60},visit,r.date);
        if (result.kind === 'bad' || visit + 60 > end) { hard = true; break; }
        rows.push({minute:visit,placeId:p.id,walkEstimate,result,direct});
        minute = visit + 60; prior = p;
      }
      if (!hard && rows.length) routes.push({id:'route-'+i,title: chain.length > 1 ? first.name + '에서 ' + chain[1].name + '까지' : first.name + ' 둘러보기',rows});
    }
    return routes.filter((r,i,a) => a.findIndex((x) => x.rows.map((y) => y.placeId).join(',') === r.rows.map((y) => y.placeId).join(',')) === i).slice(0,5);
  }
  function renderRoutes() {
    const r = state.route;
    const options = [STATION,...state.places.filter(coord)].map((p) => '<option value="' + esc(p.id) + '" ' + (r.origin === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const must = '<option value="">선택 안 함</option>' + state.places.filter(coord).map((p) => '<option value="' + esc(p.id) + '" ' + (r.must === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    $('#main').innerHTML = '<section class="page"><button class="back" id="routes-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">하루 동선 후보</div><h1>추천 루트</h1><p>출발 시각과 종료 시각에 맞는 후보를 비교해 보세요.</p></div></div><div class="card"><div class="form-grid"><div class="field-group"><label class="field-label" for="route-date">날짜</label><input class="text-field" type="date" id="route-date" value="' + esc(r.date) + '"></div><div class="field-group"><label class="field-label" for="route-start">시작 시각</label><input class="text-field" type="time" id="route-start" value="' + esc(r.start) + '"></div><div class="field-group"><label class="field-label" for="route-end">종료 시각</label><input class="text-field" type="time" id="route-end" value="' + esc(r.end) + '"></div></div><div class="form-grid two" style="margin-top:14px"><div class="field-group"><label class="field-label" for="route-origin">출발 지점</label><select class="select-field" id="route-origin">' + options + (r.current ? '<option value="current" ' + (r.origin === 'current' ? 'selected' : '') + '>현재 위치</option>' : '') + '</select><button class="btn btn-outline btn-sm" id="use-location" style="margin-top:8px">현재 위치 사용</button></div><div class="field-group"><label class="field-label" for="route-must">꼭 가고 싶은 장소</label><select class="select-field" id="route-must">' + must + '</select></div></div><div class="modal-actions"><button class="btn btn-primary" id="make-routes">코스 찾기</button></div></div><div class="notice warn" style="margin-top:18px">이 버전의 코스는 직선 거리에서 추정한 도보 이동시간으로 만든 <strong>동선 후보</strong>입니다. 실제 보행 경로와 버스 시각은 검증되지 않아 확정 안내로 제공하지 않습니다.</div><div id="route-results" class="route-results"></div></section>';
    $('#routes-back').onclick = () => nav('region');
    $('#use-location').onclick = () => { if (!navigator.geolocation) return toast('이 기기에서는 현재 위치를 사용할 수 없습니다.'); navigator.geolocation.getCurrentPosition((pos) => { r.current = {id:'current',name:'현재 위치',lat:pos.coords.latitude,lon:pos.coords.longitude}; r.origin = 'current'; renderRoutes(); toast('현재 위치를 출발 지점으로 설정했습니다.'); }, () => toast('위치 권한을 확인해 주세요.'), {enableHighAccuracy:false,timeout:10000}); };
    $('#make-routes').onclick = () => { r.date = $('#route-date').value || today(); r.start = $('#route-start').value; r.end = $('#route-end').value; r.origin = $('#route-origin').value; r.must = $('#route-must').value; if (toMin(r.end) <= toMin(r.start)) { toast('종료 시각은 시작 시각보다 뒤여야 합니다.'); return; } r.results = makeRoutes(); r.selected = r.results.length ? 0 : -1; showRouteResults(); };
    if (r.results.length) showRouteResults();
  }
  function showRouteResults() {
    const r = state.route, root = $('#route-results');
    root.innerHTML = r.results.length ? '<div class="section-label">추천 코스 ' + r.results.length + '개</div><div class="route-tabs">' + r.results.map((x,i) => '<button class="filter-chip ' + (i === r.selected ? 'active' : '') + '" data-route-tab="' + i + '">' + esc(x.title) + '</button>').join('') + '</div><div class="card">' + r.results[r.selected].rows.map((x) => '<div class="place-row"><strong>' + esc(hhmm(x.minute)) + ' · ' + esc(getPlace(x.placeId)?.name) + '</strong><small>앞 장소에서 도보 약 ' + x.walkEstimate + '분 추정 · ' + esc(x.result.title) + '</small></div>').join('') + '<p class="small">도보 추정은 실제 보행 길이나 신호 대기를 반영하지 않습니다. 출입구와 임시 휴무를 확인하세요.</p><button class="btn btn-primary" id="import-route">시간계획표에 넣기</button></div>' : '<div class="card empty-state"><h3>이 시간대에 추천할 코스가 없습니다.</h3><p>운영시간상 맞는 장소가 부족합니다. 시간대를 바꾸거나 지도를 보고 직접 계획을 만들어 보세요.</p><button class="btn btn-outline" id="go-own-plan">내 계획 만들기</button></div>';
    root.querySelectorAll('[data-route-tab]').forEach((b) => b.onclick = () => { r.selected = Number(b.dataset.routeTab); showRouteResults(); });
    if ($('#import-route')) $('#import-route').onclick = importRoute;
    if ($('#go-own-plan')) $('#go-own-plan').onclick = () => nav('plan');
  }
  function importRoute() {
    const chosen = state.route.results[state.route.selected]; if (!chosen) return;
    openModal('<h2>시간계획표에 넣으시겠습니까?</h2><p>' + esc(chosen.title) + '</p><p>현재 편집 중인 계획은 새 코스로 바뀝니다. 저장이 필요하면 먼저 계획 화면에서 저장해 주세요.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="confirm-import">넣기</button></div>', () => {
      $('#confirm-import').onclick = () => { const entries = {}; chosen.rows.forEach((x) => { entries[x.minute] = {placeId:x.placeId,duration:60,memo:''}; }); state.draft = {id:null,title:chosen.title,date:state.route.date,start:state.route.start,origin:state.route.origin,currentOrigin:state.route.current || null,entries}; persistDraft(); closeModal(); nav('plan'); };
    });
  }
  function showJourney(minute) {
    const entry = state.draft.entries[minute]; if (!entry) return;
    const earlier = Object.entries(state.draft.entries).map(([m,e]) => [Number(m),e]).filter(([m]) => m < minute).sort((a,b) => b[0]-a[0])[0];
    const origin = earlier ? entryCoord(earlier[1]) : (state.draft.origin === 'current' ? (state.draft.currentOrigin || STATION) : (getPlace(state.draft.origin) || STATION));
    const target = entryCoord(entry);
    const now = new Date(); const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const direct = km(origin,target); const walk = direct == null ? null : Math.max(10,Math.ceil(direct*1.4/4*60/5)*5);
    const arrival = nowMinutes + (walk || 0);
    state.journey = {minute, origin, target, walk, direct, arrival, result:evaluate(entry,arrival,today())};
    nav('routeMap');
  }
  function renderRouteMap() {
    const j = state.journey; if (!j) { nav('plan'); return; }
    const dest = entryLabel(state.draft.entries[j.minute]);
    const canMap = navigator.onLine && window.L && coord(j.origin) && coord(j.target);
    $('#main').innerHTML = '<section class="page"><button class="back" id="journey-back">← 시간계획표</button><div class="page-head"><div><div class="eyebrow">지금 이동하기</div><h1>' + esc(dest) + '</h1><p>현재 시각에 출발하는 것으로 운영시간을 다시 확인했습니다.</p></div></div><div class="card"><div class="toolbar"><strong>' + esc(j.origin?.name || '이전 장소') + ' → ' + esc(dest) + '</strong>' + pillFor(j.result) + '</div><p>' + esc(j.result.detail) + '</p>' + (j.walk != null ? '<p>도보 이동 약 ' + j.walk + '분 추정 · 예상 도착 ' + esc(hhmm(j.arrival)) + '</p>' : '<p>위치 좌표가 없어 이동시간을 추정할 수 없습니다.</p>') + '<p class="small">도보 추정은 직선 거리를 환산한 값입니다. 실제 길과 출입구는 지도 길찾기에서 확인하세요.</p></div><div class="map-frame journey-map" style="margin-top:16px"><div id="journey-map">' + (canMap ? '' : '<div class="empty-state">지도는 온라인이고 두 장소의 위치가 있을 때 볼 수 있습니다.</div>') + '</div></div><div class="top-actions" style="margin-top:16px">' + (coord(j.origin) && coord(j.target) ? '<a id="open-walk" class="btn btn-primary" target="_blank" rel="noopener noreferrer">실제 도보 길찾기 열기</a>' : '') + '<button class="btn btn-outline" id="journey-refresh">지금 다시 확인</button></div></section>';
    $('#journey-back').onclick = () => nav('plan'); $('#journey-refresh').onclick = () => showJourney(j.minute);
    if ($('#open-walk')) $('#open-walk').href = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(j.origin.lat + ',' + j.origin.lon) + '&destination=' + encodeURIComponent(j.target.lat + ',' + j.target.lon) + '&travelmode=walking';
    if (canMap) { const map = L.map('journey-map').setView([(j.origin.lat+j.target.lat)/2,(j.origin.lon+j.target.lon)/2],14); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map); L.circleMarker([j.origin.lat,j.origin.lon],{radius:8,color:'#155170'}).addTo(map).bindTooltip('출발'); L.circleMarker([j.target.lat,j.target.lon],{radius:8,color:'#0c8f71'}).addTo(map).bindTooltip('도착'); L.polyline([[j.origin.lat,j.origin.lon],[j.target.lat,j.target.lon]],{color:'#718b94',dashArray:'5,9'}).addTo(map); map.fitBounds([[j.origin.lat,j.origin.lon],[j.target.lat,j.target.lon]],{padding:[40,40],maxZoom:15}); setTimeout(() => map.invalidateSize(),50); }
  }
  function renderSaved() {
    $('#main').innerHTML = '<section class="page"><button class="back" id="saved-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">이 기기에 보관</div><h1>저장한 계획</h1><p>인터넷이 없어도 장소와 메모를 글로 볼 수 있습니다.</p></div><div class="top-actions"><button class="btn btn-outline" id="export-plans">파일로 내보내기</button><button class="btn btn-outline" id="import-plans">파일 가져오기</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></div><div class="saved-list">' + (state.saved.length ? state.saved.map((p) => '<div class="card saved-card"><div><div class="eyebrow">' + esc(p.date || '') + '</div><h3>' + esc(p.title || '이름 없는 계획') + '</h3><p>' + Object.keys(p.entries || {}).length + '개 장소 · ' + esc(p.start || '') + ' 시작</p></div><div class="top-actions"><button class="btn btn-primary btn-sm" data-open-saved="' + esc(p.id) + '">열기</button><button class="btn btn-outline btn-sm" data-text-saved="' + esc(p.id) + '">글로 보기</button><button class="btn btn-danger btn-sm" data-delete-saved="' + esc(p.id) + '">삭제</button></div></div>').join('') : '<div class="card empty-state">저장한 계획이 없습니다. 계획표에서 저장해 주세요.</div>') + '</div><div class="notice" style="margin-top:16px">계획은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라질 수 있으니 파일로 내보내 두세요.</div></section>';
    $('#saved-back').onclick = () => nav('home');
    document.querySelectorAll('[data-open-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.openSaved); if (p) { state.draft = JSON.parse(JSON.stringify(p)); persistDraft(); nav('plan'); } });
    document.querySelectorAll('[data-text-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.textSaved); if (!p) return; const lines = Object.entries(p.entries || {}).sort((a,b) => Number(a[0])-Number(b[0])).map(([m,e]) => '<div class="place-row"><strong>' + esc(hhmm(Number(m))) + ' · ' + esc(entryLabel(e)) + '</strong><small>' + esc(e.locationText || entryPlace(e)?.locationText || '') + (e.memo ? ' · ' + esc(e.memo) : '') + '</small></div>').join(''); openModal('<h2>' + esc(p.title) + '</h2><p>' + esc(p.date) + ' · ' + esc(p.start) + ' 시작</p><div class="saved-text">' + (lines || '<p>등록한 장소가 없습니다.</p>') + '</div><div class="modal-actions"><button class="btn btn-primary" data-close>닫기</button></div>'); });
    document.querySelectorAll('[data-delete-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.deleteSaved); openModal('<h2>저장한 계획을 삭제할까요?</h2><p>' + esc(p?.title || '') + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-danger" id="confirm-delete-saved">삭제</button></div>', () => { $('#confirm-delete-saved').onclick = () => { state.saved = state.saved.filter((x) => x.id !== b.dataset.deleteSaved); save(STORAGE_SAVED,state.saved); closeModal(); renderSaved(); }; }); });
    $('#export-plans').onclick = () => { const blob = new Blob([JSON.stringify({app:'hangeoreum-mokpo',version:1,plans:state.saved},null,2)],{type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mokpo-plans.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000); };
    $('#import-plans').onclick = () => $('#import-file').click();
    $('#import-file').onchange = async (e) => { try { const data = JSON.parse(await e.target.files[0].text()); if (data.app !== 'hangeoreum-mokpo' || !Array.isArray(data.plans)) throw Error(); const incoming = data.plans.filter((p) => p && typeof p.id === 'string' && p.entries && typeof p.entries === 'object'); if (!incoming.length) throw Error(); const ids = new Set(state.saved.map((p) => p.id)); state.saved = [...state.saved,...incoming.filter((p) => !ids.has(p.id))]; save(STORAGE_SAVED,state.saved); renderSaved(); toast('계획 파일을 가져왔습니다.'); } catch { toast('이 앱에서 내보낸 계획 파일인지 확인해 주세요.'); } };
  }
  document.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => nav(b.dataset.nav));
  window.addEventListener('online', () => { statusConnection(); render(); });
  window.addEventListener('offline', () => { statusConnection(); render(); });
  fetch('./places.json').then((r) => { if (!r.ok) throw Error(); return r.json(); }).then((data) => { state.places = data.places || []; render(); }).catch(() => { state.places = []; render(); toast('장소 자료를 불러오지 못했습니다. 저장한 계획은 볼 수 있습니다.'); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
