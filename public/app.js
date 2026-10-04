/* 한걸음 목포 — 브라우저 안에서 동작하는 여행 계획 도구 */
(() => {
  'use strict';
  const MOKPO = [34.7913, 126.3854];
  const REGIONS = [{id:'mokpo',name:'목포',center:MOKPO,ready:true,image:'./mokpo-card.webp',teaser:'유달산과 바다가 만나는 항구 도시',description:'유달산과 항구가 어우러진 목포. 근대역사거리와 해상케이블카가 기다려요.'}];
  const STATION = { id: 'station', name: '목포역', lat: 34.7914, lon: 126.3859 };
  const CATEGORIES = [
    ['all', '전체', '🗺️'], ['food', '음식점', '🍽️'],
    ['cafe', '카페', '☕'], ['outdoors', '자연·산책', '🌿'],
    ['culture', '문화·전시', '🏛️'], ['experience', '체험·탑승', '🎟️'],
    ['market', '시장·간식', '🛍️'], ['books', '책방·소품', '📚']
  ];
  const CATEGORY_COLORS = { food: '#cc6d39', cafe: '#8262b4', outdoors: '#0c8f71', culture: '#4679b8', experience: '#c58b28', market: '#c45868', books: '#8a6a52' };
  const routeEngine = window.HangeoreumRouteEngine;
  const STORAGE_DRAFT = 'hangeoreum-draft-v1';
  const STORAGE_SAVED = 'hangeoreum-saved-v1';
  const STORAGE_GEOCODES = 'hangeoreum-mokpo-address-pins-v1';
  const KAKAO_KEY = String(window.HANGEORUM_KAKAO_JS_KEY || '').trim();
  let kakaoReady;
  function loadKakao() {
    if (!KAKAO_KEY) return Promise.resolve(false);
    if (!kakaoReady) kakaoReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=' + encodeURIComponent(KAKAO_KEY);
      script.onload = () => kakao.maps.load(() => resolve(true));
      script.onerror = () => reject(new Error('카카오맵 SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
    return kakaoReady;
  }
  const kakaoLevel = (zoom) => Math.max(1, Math.min(14, 18 - zoom));
  const kakaoZoom = (level) => 18 - level;
  const kakaoPoint = (lat, lon) => new kakao.maps.LatLng(lat, lon);
  const $ = (selector) => document.querySelector(selector);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ICON_PATHS = {
    home:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
    map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
    plan:'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM8 13h2M14 13h2M8 17h2',
    saved:'M6 3h12v18l-6-4-6 4Z',
    search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    arrow:'M5 12h14M13 6l6 6-6 6', back:'m15 5-7 7 7 7',
    location:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    target:'M12 2v4M12 18v4M2 12h4M18 12h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    outdoors:'m3 18 6-11 4 7 3-5 5 9ZM15 4h.01M7 18v3M17 18v3',
    sea:'M3 16q3-4 6 0t6 0 6 0M3 20q3-4 6 0t6 0 6 0M7 4v9l10-2ZM7 4l10 7',
    culture:'m3 8 9-5 9 5ZM5 10v8M10 10v8M14 10v8M19 10v8M3 21h18M3 18h18',
    cafe:'M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 9h2a3 3 0 1 1 0 6h-2M7 3v2M11 2v3M3 22h16',
    food:'M5 3v6c0 3 4 3 4 0V3M7 3v18M17 3c-3 3-3 8 0 8h2M19 3v18',
    books:'M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2ZM12 6v15',
    market:'M4 8h16l1 13H3ZM8 8V6a4 4 0 0 1 8 0v2',
    experience:'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4ZM15 7v2M15 12v2M15 17v2',
    first:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5-3-2 5-4 1 2-5Z',
    clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
    external:'M14 3h7v7M21 3l-11 11M10 5H4v15h15v-6'
  };
  function uiIcon(name, extraClass='') { return '<svg class="ui-icon '+extraClass+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(ICON_PATHS[name]||ICON_PATHS.location)+'"/></svg>'; }
  const TURTLE_BASE = './assets/mascot/turtle-base-ui.png';
  const TURTLE_POSES = Object.fromEntries(['map','walk','bus','discover','think','memo','rest'].map((pose) => [pose, './assets/mascot/turtle-' + pose + '.png']));
  function turtlePose(pose, label, extraClass = '') {
    return '<img class="turtle-pose turtle-pose--' + pose + (extraClass ? ' ' + extraClass : '') + '" src="' + (TURTLE_POSES[pose] || TURTLE_BASE) + '" alt="' + esc(label) + '" loading="lazy">';
  }
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
  const pinPoint = (p) => coord(p) ? [p.lat, p.lon] :
    p && Number.isFinite(p.mapLat) && Number.isFinite(p.mapLon) ? [p.mapLat, p.mapLon] : null;
  const hasPin = (p) => !!pinPoint(p);
  const km = (a, b) => coord(a) && coord(b) ? routeEngine.distanceKm(a,b) : null;
  const routeCache = new Map();
  const mealChoicesCache = new WeakMap();
  function registeredRouteId(point) {
    const known = point?.id === STATION.id ? STATION : getPlace(point?.id);
    return known && known.lat === point.lat && known.lon === point.lon ? known.id : '';
  }
  async function getRoute(mode, origin, target) {
    if (!coord(origin) || !coord(target)) throw new Error('장소 좌표가 없습니다.');
    const startId=registeredRouteId(origin), endId=registeredRouteId(target);
    const params = new URLSearchParams({mode,start_x:origin.lon,start_y:origin.lat,end_x:target.lon,end_y:target.lat,start_id:startId,end_id:endId});
    const cacheKey = params.toString();
    const persistent=mode==='walk' && !!(startId && endId);
    for (const [key, entry] of routeCache) if (entry.expiresAt <= Date.now()) routeCache.delete(key);
    if (!routeCache.has(cacheKey)) {
      // 임의 주소는 짧은 메모리 재사용만 허용하고 새 코스 생성 때 비운다.
      if (routeCache.size >= 256) routeCache.delete(routeCache.keys().next().value);
      const entry={persistent,expiresAt:persistent ? Infinity : Date.now()+60000};
      entry.promise=fetch('/api/route?' + cacheKey, {cache:'no-store'}).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '경로를 조회하지 못했습니다.');
      if (data.status !== 'OK' || !data.routes?.length) throw new Error('이 구간의 경로가 없습니다.');
      return data.routes;
      }).catch((error) => { if (routeCache.get(cacheKey) === entry) routeCache.delete(cacheKey); throw error; });
      routeCache.set(cacheKey,entry);
    }
    return routeCache.get(cacheKey).promise;
  }
  let toastTimer;
  function toast(message) { const el = $('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3600); }
  const state = {
    places: [], view: 'home', region: 'mokpo', categories: new Set(), selected: null, mapDisplay:'map', homeMood:'all',
    mapCenter: MOKPO, mapZoom: 13, map: null, mapProvider: null, mapLine: null, resultMap:null,
    draft: load(STORAGE_DRAFT, null) || { id: null, title: '나의 목포 하루', date: today(), start: '09:00', end: '24:00', origin: null, theme:'balanced', mealTimes:[], entries: {}, pending:[] },
    saved: load(STORAGE_SAVED, []),
    route: { date: today(), start: '10:00', end: '24:00', origin: 'station', destination:'station', mode:'custom', theme:'first', must: '', mustOptional:false, focus:'through', results: [], baseResults:[], selected: -1 },
    pinMode: false, pinSelection: null, searchResults: []
  };
  const geocodeCache = load(STORAGE_GEOCODES, {});
  function persistDraft() { save(STORAGE_DRAFT, state.draft); }
  function statusConnection() { const el = $('#connection'); if (!el) return; el.textContent = navigator.onLine ? '온라인' : '오프라인 · 저장한 글만'; el.classList.toggle('offline', !navigator.onLine); }
  function nav(view) { if (state.view === 'region' && view !== 'region') { if(state.mapProvider === 'leaflet') state.map?.remove(); state.map=null; } if (state.view === 'routes' && view !== 'routes') { state.resultMap?.remove(); state.resultMap=null; } state.view = view; render(); window.scrollTo(0, 0); }
  function render() {
    statusConnection();
    document.body.classList.toggle('destination-home', state.view === 'home');
    document.body.dataset.view = state.view;
    document.querySelectorAll('[data-nav]').forEach((b) => { const active = b.dataset.nav === state.view || (b.dataset.nav === 'home' && state.view === 'destination') || (b.dataset.nav === 'region' && ['routes','place','routeMap'].includes(state.view)); b.classList.toggle('active', active); b.setAttribute('aria-current', active ? 'page' : 'false'); });
    if (state.view === 'home') renderHome();
    else if (state.view === 'destination') renderDestination();
    else if (state.view === 'place') renderPlacePage();
    else if (state.view === 'region') renderRegionMap();
    else if (state.view === 'plan') renderPlan();
    else if (state.view === 'routes') renderRoutes();
    else if (state.view === 'saved') renderSaved();
    else if (state.view === 'routeMap') renderRouteMap();
  }
  function categoryName(cat) { return CATEGORIES.find((x) => x[0] === cat)?.[1] || '장소'; }
  function categoryIcon(cat) { return CATEGORIES.find((x) => x[0] === cat)?.[2] || '📍'; }
  function placeTimeText(p) {
    if (!p?.hours) return '일정 자동 검증용 시간표 미확정 · 아래 조사 내용을 확인하세요';
    let text = p.hours.open + '–' + p.hours.close;
    if (p.hours.breaks?.length) text += ' · 브레이크 ' + p.hours.breaks.map((b) => b.join('–')).join(', ');
    if (p.hours.lastEntry) text += ' · 공식 입장 ' + p.hours.lastEntry + '까지';
    if (p.hours.lastOrder) text += ' · 주문 ' + p.hours.lastOrder + '까지';
    if (!p.hours.lastEntry && !p.hours.lastOrder) text += ' · 앱 권장 입장 ' + hhmm(toMin(p.hours.close) - 60) + ' 이전(제한 아님)';
    return text;
  }
  function scheduleHtml(p) {
    const week = p.mapWeekText ? '<p><strong>카카오맵 10/3~10/9 표시</strong><br>' + esc(p.mapWeekText) + '</p>' : '';
    const diningWeek = p.diningWeekText ? '<p><strong>다이닝코드 10/3~10/9 표시</strong><br>' + esc(p.diningWeekText) + '</p>' : '';
    const rows = [
      ['운영시간·요일', p.scheduleText || '확인 필요'],
      ['브레이크·마지막 주문/입장', p.deadlineText || '확인 필요'],
      ['휴무·변동', p.closureText || '확인 필요']
    ];
    return (week ? '<div class="schedule-week">' + week + (p.mapWeekSource ? '<a class="small" href="' + esc(p.mapWeekSource) + '" target="_blank" rel="noopener noreferrer">카카오맵 장소 시간표</a>' : '') + '</div>' : '') +
      (diningWeek ? '<div class="schedule-week">' + diningWeek + (p.diningWeekSource ? '<a class="small" href="' + esc(p.diningWeekSource) + '" target="_blank" rel="noopener noreferrer">다이닝코드 장소 시간표</a>' : '') + '</div>' : '') +
      '<div class="schedule-facts">' + rows.map(([label, value]) => '<p><strong>' + esc(label) + '</strong><br>' + esc(value) + '</p>').join('') + '</div>' +
      (p.scheduleSource ? '<a class="small" href="' + esc(p.scheduleSource) + '" target="_blank" rel="noopener noreferrer">운영정보 출처</a>' : '');
  }
  function placeVisual(p, compact = false) {
    const media = window.HANGEORUM_PLACE_MEDIA?.[p.id];
    const safe = media?.src && /^(\.\/assets\/|https:\/\/)/.test(media.src);
    return '<div class="place-visual visual-' + esc(p.category) + ' ' + (compact ? 'is-thumb' : 'is-cover') + '" data-kind="' + (safe ? (media.kind === 'photo' ? 'photo' : 'illustration') : 'decoration') + '">' +
      '<span class="place-visual-symbol" aria-hidden="true">' + uiIcon(p.category) + '</span>' +
      (safe ? '<img src="' + esc(media.src) + '" alt="' + esc(media.alt || p.name) + '" loading="lazy">' : '') +
      (!compact ? '<span class="media-caption">' + (safe ? (media.kind === 'photo' ? '사진' : '일러스트') + (media.credit ? ' · ' + esc(media.credit) : '') : esc(categoryName(p.category)) + ' · 유형 이미지') + '</span>' : '') + '</div>';
  }
  const HOME_MOODS=[['all','전체'],['sea','바다'],['history','역사·골목'],['shops','책방·소품'],['cafe','여유']];
  const THEME_ICONS={first:'first',history:'culture',sea:'sea',shops:'books',food:'food',cafe:'cafe'};
  function renderHome() {
    const available=REGIONS.filter(x=>x.ready);
    $('#main').innerHTML=`<section class="page destination-page">
      <div class="diary-hero"><div class="hero-copy"><div class="eyebrow">나의 작은 여행 다이어리</div><h1>오늘,<br>어디로 떠날까요?</h1><p>뚜벅이 여행에 딱 맞는<br>나만의 하루를 찾아보세요.</p></div>${turtlePose('map','지도를 보며 여행을 준비하는 거북이','hero-turtle')}<span class="hero-note" aria-hidden="true">한걸음, 가볍게 떠나요</span></div>
      <form class="destination-search" id="destination-search">${uiIcon('search')}<input id="destination-query" aria-label="여행지 또는 장소 검색" placeholder="여행지, 장소를 검색해 보세요" autocomplete="off"><button type="submit" aria-label="검색">${uiIcon('arrow')}</button></form>
      <div class="home-moods" aria-label="여행 취향">${HOME_MOODS.map(([id,label])=>`<button type="button" data-home-mood="${id}" class="${state.homeMood===id?'active':''}" aria-pressed="${state.homeMood===id}">${label}</button>`).join('')}</div>
      <div class="diary-section-head"><div><span class="eyebrow">한걸음의 여행지</span><h2>마음이 머무는 곳</h2></div><span class="small">지금은 목포부터</span></div>
      <div class="home-discover-layout"><div class="destination-grid ${available.length===1?'is-single':''}">${available.map(x=>`<button type="button" class="destination-tile" data-region="${esc(x.id)}" aria-label="${esc(x.name)} 여행지 소개 보기"><div class="destination-picture"><img src="${esc(x.image)}" alt="${esc(x.name)} 풍경 일러스트" loading="eager"><span class="picture-label">전라남도</span><span class="picture-stamp" aria-hidden="true">${uiIcon(state.homeMood==='all'?'sea':THEME_ICONS[state.homeMood])}</span></div><span class="destination-copy"><strong>${esc(x.name)}</strong><small>${esc(x.teaser)}</small><span class="destination-meta">${uiIcon('map')} 6가지 테마로 만나는 목포 <span aria-hidden="true">${uiIcon('arrow')}</span></span></span></button>`).join('')}</div>
      <aside class="home-journal"><span class="journal-label">오늘의 여행 메모</span><h2>조금 느리게,<br>더 가까이.</h2><p>끌리는 골목에 잠시 머물고,<br>바다가 보이면 쉬어 가도 좋아요.</p>${turtlePose('walk','천천히 걷는 거북이')}<span class="journal-dash" aria-hidden="true"></span><button class="text-button" id="home-plan">나의 하루 적어보기 ${uiIcon('arrow')}</button></aside></div>
      <p class="home-footnote">한 도시씩, 차곡차곡. 걷기 좋은 여행지를 함께 채워갈게요.</p></section>`;
    document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{const region=REGIONS.find(x=>x.id===b.dataset.region);if(region)showRegionIntro(region);});
    document.querySelectorAll('[data-home-mood]').forEach(b=>b.onclick=()=>{state.homeMood=b.dataset.homeMood;renderHome();});
    $('#home-plan').onclick=()=>nav('plan');
    $('#destination-search').onsubmit=e=>{e.preventDefault();const q=$('#destination-query').value.trim();if(!q)return;const region=available.find(x=>x.name.includes(q)||x.teaser.includes(q));if(region){showRegionIntro(region);return;}const p=state.places.find(x=>x.name.includes(q));if(p){state.selected=p.id;state.placeTab='intro';state.placeBack='home';nav('place');}else toast('아직 등록된 여행지나 장소가 없어요. 지금은 목포를 둘러볼 수 있어요.');};
  }
  function showRegionIntro(region) { state.region=region.id; state.destinationTab='routes'; nav('destination'); }
  function destinationPlaceCard(p) { return '<button class="discovery-card" data-open-place="' + esc(p.id) + '">' + placeVisual(p) + '<strong>' + esc(p.name) + '</strong><small>' + esc(categoryName(p.category)) + '</small></button>'; }
  function renderDestination() {
    const region=REGIONS.find(x=>x.id===state.region)||REGIONS[0];
    const tab=state.destinationTab||'routes';
    const themes=routeEngine.THEMES.filter(x=>x.id!=='balanced').sort((a,b)=>(b.id===state.homeMood?1:0)-(a.id===state.homeMood?1:0));
    const featured=['p1','p8','p10','p12'].map(getPlace).filter(Boolean);
    $('#main').innerHTML=`<section class="destination-overview">
      <div class="city-cover"><img src="${esc(region.image)}" alt="목포 풍경 일러스트"><button class="round-control city-back" id="city-back" aria-label="여행지 선택으로">‹</button><span class="cover-label">목포 풍경 일러스트</span></div>
      <div class="city-body"><div class="city-intro"><div><span class="eyebrow">천천히 만나는 항구 도시</span><h1>${esc(region.name)}</h1><p>${esc(region.teaser)}<br>골목을 지나, 바다 곁으로.</p><span class="pill">⌖ 전라남도 목포시</span></div>${turtlePose('discover','새 여행지를 발견한 거북이')}</div>
      <div class="city-tabs" role="tablist" aria-label="목포 여행 정보"><button role="tab" aria-selected="${tab==='routes'}" data-city-tab="routes">추천 루트</button><button role="tab" aria-selected="${tab==='places'}" data-city-tab="places">여행지</button><button role="tab" aria-selected="${tab==='info'}" data-city-tab="info">여행 정보</button></div>
      <div class="city-content">${tab==='routes'?`<div class="diary-section-head"><h2>어떤 하루를 걸어볼까요?</h2></div><div class="theme-discovery-list">${themes.map(t=>`<button class="theme-discovery" data-discover-theme="${t.id}"><span class="theme-art theme-${t.id}" aria-hidden="true">${uiIcon(THEME_ICONS[t.id])}</span><span><strong>${esc(t.name)}</strong><small>${esc(routeEngine.THEME_PRESETS[t.id].description)}</small><em>날짜에 맞춰 하루 코스 만들기</em></span><b aria-hidden="true">›</b></button>`).join('')}</div><div class="diary-section-head"><h2>목포에서 만나는 풍경</h2><button class="text-button" data-city-tab="places">모두 보기 ›</button></div><div class="discovery-grid">${featured.map(destinationPlaceCard).join('')}</div>`:tab==='places'?`<div class="diary-section-head"><h2>한곳씩, 마음에 담기</h2><span class="small">${state.places.length}곳</span></div><div class="discovery-grid">${state.places.map(destinationPlaceCard).join('')}</div>`:`<div class="travel-note">${turtlePose('walk','산책하는 거북이')}<div><h2>내 속도로 걷는 목포</h2><p>${esc(region.description)}</p><p>지도에서 장소를 살펴보거나, 날짜와 테마를 골라 하루 코스를 만들어 보세요.</p></div></div><div class="info-pair"><div><strong>걸어서, 필요할 땐 버스로</strong><p>걷기 좋은 동선을 먼저 찾고, 도보 연결이 어려우면 확인 가능한 버스 경로를 살펴봐요.</p></div><div><strong>출발 전 한 번 더 확인</strong><p>장소의 운영시간과 실제 출입구, 버스 배차는 여행 당일 확인해 주세요.</p></div></div>`}</div>
      <div class="city-cta"><button class="btn btn-primary" id="choose-region">⌖ 목포 지도 둘러보기</button><button class="btn btn-outline" id="city-plan">나의 하루 계획</button></div></div></section>`;
    $('#city-back').onclick=()=>nav('home');
    $('#choose-region').onclick=()=>{state.mapCenter=region.center;state.mapZoom=13;state.selected=null;state.categories.clear();state.mapDisplay='map';nav('region');};
    $('#city-plan').onclick=()=>nav('plan');
    document.querySelectorAll('[data-city-tab]').forEach(b=>b.onclick=()=>{state.destinationTab=b.dataset.cityTab;renderDestination();});
    document.querySelectorAll('[data-discover-theme]').forEach(b=>b.onclick=()=>{state.route.mode='theme';state.route.theme=b.dataset.discoverTheme;state.route.results=[];state.route.selected=-1;nav('routes');});
    document.querySelectorAll('[data-open-place]').forEach(b=>b.onclick=()=>{state.placeBack='destination';state.placeTab='intro';state.selected=b.dataset.openPlace;nav('place');});
  }
  function renderPlacePage() {
    const p=getPlace(state.selected);if(!p){nav('region');return;}
    const related=state.places.filter(x=>x.id!==p.id&&x.category===p.category).slice(0,4);
    const tab=state.placeTab||'intro';
    $('#main').innerHTML=`<section class="place-page"><div class="place-cover">${placeVisual(p)}<button class="round-control" id="place-back" aria-label="이전 화면">‹</button></div><div class="place-page-body"><span class="eyebrow">${esc(categoryName(p.category))}</span><h1>${esc(p.name)}</h1><p class="place-address">⌖ ${esc(p.locationText||'위치 확인 필요')}</p>${p.rating!=null?`<p class="place-rating">카카오맵 ${esc(p.rating.toFixed(1))} / 5 · 평가 ${esc(p.ratingCount)}건 · 2026-10-01 조사</p>`:''}<div class="place-quick-actions"><button id="place-see-map">${uiIcon('location')}지도 위치</button><button id="place-plan">${uiIcon('plan')}계획표 열기</button>${p.source?`<a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">${uiIcon('external')}장소 정보</a>`:''}</div>
      <div class="city-tabs" role="tablist" aria-label="장소 상세 정보"><button role="tab" aria-selected="${tab==='intro'}" data-place-tab="intro">방문 안내</button><button role="tab" aria-selected="${tab==='hours'}" data-place-tab="hours">운영시간</button><button role="tab" aria-selected="${tab==='related'}" data-place-tab="related">함께 둘러보기</button></div>
      <div class="place-tab-content">${tab==='intro'?`<div class="travel-note">${turtlePose('rest','잠시 쉬는 거북이')}<div><h2>여기서 잠깐!</h2><p>${esc(p.hours?placeTimeText(p):'방문 가능한 시간은 아직 확인 중이에요. 운영시간 탭에서 조사 내용을 확인해 주세요.')}</p>${p.hours?.note?`<p>${esc(p.hours.note)}</p>`:''}</div></div>${p.mapPinBasis?`<p class="small">지도 표시점: ${esc(p.mapPinBasis)}. 실제 출입구와 보행 시작점은 따로 확인해 주세요.</p>`:''}<h2>같은 취향의 장소</h2><div class="discovery-grid">${related.map(destinationPlaceCard).join('')}</div>`:tab==='hours'?`<h2>방문 전 확인해 주세요</h2>${scheduleHtml(p)}<p class="small">기본 조사 2026-10-01${p.mapWeekChecked?' · 주간표 확인 '+esc(p.mapWeekChecked):''}. 당일 변경은 장소 안내에서 확인해 주세요.</p>`:`<h2>같은 취향의 장소</h2><p class="small">같은 유형으로 묶은 장소예요. 이동 거리는 지도에서 확인해 주세요.</p><div class="discovery-grid">${related.map(destinationPlaceCard).join('')}</div>`}</div>
      <button class="btn btn-primary place-main-cta" id="place-map-cta">⌖ 지도로 보기</button></div></section>`;
    $('#place-back').onclick=()=>{state.placeTab='intro';nav(state.placeBack||'region');};
    const seeMap=()=>{state.mapDisplay='map';const point=pinPoint(p);if(point){state.mapCenter=point;state.mapZoom=15;}state.categories.clear();state.selected=null;nav('region');};
    $('#place-see-map').onclick=seeMap;$('#place-map-cta').onclick=seeMap;
    $('#place-plan').onclick=()=>{nav('plan');toast('시간 칸을 눌러 '+p.name+'을 넣어주세요.');};
    document.querySelectorAll('[data-place-tab]').forEach(b=>b.onclick=()=>{state.placeTab=b.dataset.placeTab;renderPlacePage();});
    document.querySelectorAll('[data-open-place]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.openPlace;state.placeTab='intro';renderPlacePage();window.scrollTo(0,0);});
  }
  function renderRegionMap() {
    const region = REGIONS.find((x) => x.id === state.region) || REGIONS[0];
    const list = (region.ready ? state.places : []).filter((p) => !state.categories.size || state.categories.has(p.category));
    const chosen = CATEGORIES.filter(([id]) => state.categories.has(id)).map(([, label]) => label);
    const resultLabel = chosen.length === 0 ? '전체' : chosen.length <= 2 ? chosen.join('·') : '선택한 분류 ' + chosen.length + '개';
    if (state.mapProvider === 'leaflet') state.map?.remove();
    state.map = null; state.mapProvider = null;
    $('#main').innerHTML=`<section class="explore-page ${state.mapDisplay==='list'?'list-mode':''}">
      <div class="explore-topbar"><button class="round-control" id="region-back" aria-label="목포 소개로">${uiIcon('back')}</button><h1>${esc(region.name)} 한 바퀴</h1><div class="view-switch" aria-label="탐색 방식"><button data-map-display="map" class="${state.mapDisplay==='map'?'active':''}" aria-pressed="${state.mapDisplay==='map'}">지도</button><button data-map-display="list" class="${state.mapDisplay==='list'?'active':''}" aria-pressed="${state.mapDisplay==='list'}">목록</button></div></div>
      <div class="explore-workspace"><div class="explore-search"><form id="map-search-form" class="explore-search-form">${uiIcon('search')}<input id="map-search" aria-label="장소 또는 주소 검색" autocomplete="off" placeholder="목포의 장소, 주소 검색"><button type="submit" aria-label="검색">${uiIcon('arrow')}</button></form><div class="filter-strip" aria-label="장소 유형 여러 개 선택 가능">${CATEGORIES.map(([id,label,emoji])=>{const active=id==='all'?!state.categories.size:state.categories.has(id);return `<button class="filter-chip ${active?'active':''}" data-category="${id}" aria-pressed="${active}"><span aria-hidden="true">${emoji}</span> ${label}</button>`;}).join('')}</div></div>
      <div class="explore-map"><div id="map"></div><button class="round-control recenter-control" id="recenter" aria-label="목포 중심으로 돌아가기" title="목포 중심으로 돌아가기">${uiIcon('target')}</button><span class="map-location-label">${uiIcon('location')} 목포</span></div>
      <aside class="explore-sheet"><span class="sheet-handle" aria-hidden="true"></span><div class="explore-sheet-title"><div><span class="eyebrow">발걸음이 닿는 곳</span><h2>${esc(resultLabel==='전체'?'목포의 장소':resultLabel)} <small>${list.length}</small></h2></div><span class="small" id="pin-count">지도 핀 ${list.filter(hasPin).length}곳</span></div><div class="place-list">${list.map(p=>`<button class="place-row" data-place="${p.id}">${placeVisual(p,true)}<span class="place-row-copy"><small class="place-row-category">${esc(categoryName(p.category))}</small><strong>${esc(p.name)}</strong><small>${esc(p.locationText||'위치 확인 필요')}</small></span><span class="row-chevron" aria-hidden="true">›</span></button>`).join('')}</div><p class="map-evidence">지도 핀은 대표 위치예요. 실제 출입구는 방문 전 확인해 주세요.</p><div class="explore-actions"><button class="btn btn-outline" id="go-plan">${uiIcon('plan')} 직접 계획</button><button class="btn btn-primary" id="go-routes">${uiIcon('map')} 추천 루트</button></div></aside></div></section>`;
    initHomeMap(list);
    $('#region-back').onclick=()=>nav('destination');
    $('#go-plan').onclick=()=>nav('plan');$('#go-routes').onclick=()=>nav('routes');
    $('#recenter').onclick=()=>{if(state.mapProvider==='kakao'){state.map?.setCenter(kakaoPoint(...region.center));state.map?.setLevel(kakaoLevel(13));}else state.map?.setView(region.center,13);state.mapCenter=region.center;state.mapZoom=13;};
    $('#map-search-form').onsubmit=searchMap;
    document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{const offset=$('.filter-strip').scrollLeft;const id=b.dataset.category;if(id==='all')state.categories.clear();else if(state.categories.has(id))state.categories.delete(id);else state.categories.add(id);state.selected=null;renderRegionMap();$('.filter-strip').scrollLeft=offset;});
    document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>selectPlace(b.dataset.place));
    document.querySelectorAll('[data-map-display]').forEach(b=>b.onclick=()=>{state.mapDisplay=b.dataset.mapDisplay;$('.explore-page').classList.toggle('list-mode',state.mapDisplay==='list');document.querySelectorAll('[data-map-display]').forEach(x=>{const active=x.dataset.mapDisplay===state.mapDisplay;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active);});if(state.mapProvider==='kakao')state.map?.relayout();else state.map?.invalidateSize();});
  }
  async function initHomeMap(list) {
    const container = $('#map');
    const pinned = list.filter(hasPin);
    if (!navigator.onLine) { container.innerHTML = '<div class="empty-state" style="margin:20px">지도는 인터넷에 연결하면 볼 수 있습니다.</div>'; return; }
    if (KAKAO_KEY) {
      try {
        await loadKakao();
        if (container !== $('#map')) return;
        const map = new kakao.maps.Map(container, { center: kakaoPoint(...state.mapCenter), level: kakaoLevel(state.mapZoom) });
        state.map = map; state.mapProvider = 'kakao';
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        const colors = CATEGORY_COLORS;
        pinned.forEach((p) => {
          const point = pinPoint(p);
          const dot = document.createElement('div');
          dot.className = 'kakao-place-pin'; dot.style.backgroundColor = colors[p.category] || '#123348';
          dot.title = p.name; dot.setAttribute('aria-label', p.name);
          const marker = new kakao.maps.CustomOverlay({ position: kakaoPoint(...point), content: dot, yAnchor: .5 });
          marker.setMap(map); dot.onclick = () => selectPlace(p.id);
        });
        geocodeAddressPlaces(list, map, colors, container);
        if (state.categories.size && pinned.length) {
          const bounds = new kakao.maps.LatLngBounds();
          pinned.forEach((p) => bounds.extend(kakaoPoint(...pinPoint(p))));
          map.setBounds(bounds);
        }
        kakao.maps.event.addListener(map, 'idle', () => { if (container !== $('#map')) return; state.mapCenter = [map.getCenter().getLat(), map.getCenter().getLng()]; state.mapZoom = kakaoZoom(map.getLevel()); });
        setTimeout(() => map.relayout(), 50);
        return;
      } catch { toast('카카오맵 연결에 실패해 기존 지도를 표시합니다. 키와 등록 도메인을 확인해 주세요.'); }
    }
    if (!window.L || container !== $('#map')) return;
    const map = L.map('map', { zoomControl: false }).setView(state.mapCenter, state.mapZoom);
    state.map = map; state.mapProvider = 'leaflet';
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    const colors = CATEGORY_COLORS;
    pinned.forEach((p) => {
      const marker = L.circleMarker(pinPoint(p), { radius: 7, weight: 2, color: '#fff', fillColor: colors[p.category] || '#123348', fillOpacity: .95 }).addTo(map);
      marker.bindTooltip(esc(p.name)); marker.on('click', () => selectPlace(p.id));
    });
    if (state.categories.size && pinned.length) map.fitBounds(pinned.map(pinPoint), { padding: [25, 25], maxZoom: 14 });
    map.on('moveend', () => { state.mapCenter = [map.getCenter().lat, map.getCenter().lng]; state.mapZoom = map.getZoom(); });
    setTimeout(() => map.invalidateSize(), 50);
  }
  async function geocodeAddressPlaces(list, map, colors, container) {
    const geocoder = new kakao.maps.services.Geocoder();
    for (const p of list.filter((item) => !hasPin(item) && item.addressQuery)) {
      if (container !== $('#map')) return;
      let hit = geocodeCache[p.addressQuery];
      if (!hit) {
        hit = await new Promise((resolve) => geocoder.addressSearch(p.addressQuery, (results, status) =>
          resolve(status === kakao.maps.services.Status.OK ? results[0] : null)));
        if (!hit) continue;
        const expected = p.addressQuery.replace(/^목포시\s*/, '').replace(/\s/g, '');
        const returned = String(hit.road_address?.address_name || hit.address_name || '').replace(/\s/g, '');
        if (!returned.includes(expected)) continue;
        geocodeCache[p.addressQuery] = {x: hit.x, y: hit.y};
        save(STORAGE_GEOCODES, geocodeCache);
      }
      const lat = Number(hit.y), lon = Number(hit.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 34.7 || lat > 34.9 || lon < 126.3 || lon > 126.6) continue;
      p.lat = lat; p.lon = lon; p.pinBasis = 'address';
      const dot = document.createElement('div');
      dot.className = 'kakao-place-pin'; dot.style.backgroundColor = colors[p.category] || '#123348';
      dot.title = p.name + ' · 건물 주소 위치'; dot.setAttribute('aria-label', dot.title);
      new kakao.maps.CustomOverlay({ position: kakaoPoint(lat, lon), content: dot, yAnchor: .5, map });
      dot.onclick = () => selectPlace(p.id);
      if ($('#pin-count')) $('#pin-count').textContent = '지도 핀 ' + list.filter(hasPin).length + '곳';
    }
  }
  function selectPlace(id) {
    if(!getPlace(id))return;
    state.selected=id;state.placeBack='region';state.placeTab='intro';nav('place');
  }
  async function searchMap(event) {
    event.preventDefault(); const q = $('#map-search').value.trim(); if (!q) return;
    const match = state.region === 'mokpo' ? state.places.find((p) => p.name.includes(q) && coord(p)) : null;
    if (match) { if (state.categories.size && !state.categories.has(match.category)) { state.categories.add(match.category); renderRegionMap(); } selectPlace(match.id); return; }
    if (!navigator.onLine) { toast('위치 검색은 인터넷이 필요합니다.'); return; }
    try {
      if (KAKAO_KEY && await loadKakao()) {
        const places = new kakao.maps.services.Places();
        const geocoder = new kakao.maps.services.Geocoder();
        const find = (method) => new Promise((resolve) => method(q, (results, status) => resolve(status === kakao.maps.services.Status.OK ? results[0] : null)));
        const hit = await find(places.keywordSearch.bind(places)) || await find(geocoder.addressSearch.bind(geocoder));
        if (!hit) { toast('검색 결과를 찾지 못했습니다.'); return; }
        const lat = Number(hit.y), lon = Number(hit.x);
        state.map?.setLevel(kakaoLevel(15)); state.map?.panTo(kakaoPoint(lat, lon));
        toast('검색한 위치로 지도를 옮겼습니다.'); return;
      }
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
    const daily=p ? routeEngine.datedHours(p,dateAt(date,minute)) : null;
    if (daily?.closed) return {kind:'bad',title:'해당 날짜 휴무',detail:'날짜별 시간표에 휴무로 표시되었습니다.'};
    const h = daily?.open ? {...p.hours,...daily,breaks:daily.breaks?.length ? daily.breaks : p.hours?.breaks} : p?.hours;
    if (!p || !h) return { kind: 'unknown', title: '운영시간 확인 필요', detail: '장소 운영정보가 없어 가능 여부를 확정할 수 없습니다.' };
    const actualDate = dateAt(date, minute);
    const m = minute % 1440;
    if (h.closedDates?.includes(actualDate)) return { kind: 'bad', title: '해당 날짜 휴관', detail: h.note || '방문일 휴관 공지를 확인하세요.' };
    if (!daily?.open && h.closedWeekdays?.includes(weekday(actualDate))) return { kind: 'bad', title: '정기 휴무 가능', detail: h.note || '방문일 휴무를 확인하세요.' };
    if (m < toMin(h.open)) return { kind: 'bad', title: '운영 시작 전', detail: h.open + '부터 운영합니다.' };
    const close=toMin(h.close) <= toMin(h.open) ? toMin(h.close)+1440 : toMin(h.close);
    if (m >= close) return { kind: 'bad', title: '운영 종료 후', detail: h.close + '에 운영이 끝납니다.' };
    const deadline = h.lastEntry || h.lastOrder;
    if (deadline && m > toMin(deadline)) return { kind: 'bad', title: '공식 마감 경과', detail: (h.lastEntry ? '입장' : '주문') + ' 마감 ' + deadline + '을 지났습니다.' };
    if (h.breaks?.some(([a,b]) => m >= toMin(a) && m < toMin(b))) return { kind: 'bad', title: '브레이크타임 중', detail: '운영 재개 시각을 확인해 시간을 옮겨 주세요.' };
    const duration = Number(entry.duration) || 60;
    if (h.breaks?.some(([a]) => m < toMin(a) && m + duration > toMin(a))) return { kind: 'warn', title: '체류 중 브레이크타임', detail: '예상 체류가 브레이크타임과 겹칩니다. 이용 가능 시간을 확인하세요.' };
    if (m + duration > close) return { kind: 'warn', title: '예상 체류가 폐관을 넘어요', detail: '체류시간을 줄이거나 더 일찍 방문해 주세요.' };
    const soft = !deadline && m > close - 60 ? ' · 폐관 1시간 전 입장은 앱의 권장일 뿐 제한이 아닙니다.' : '';
    return { kind: 'ok', title: daily?.open ? '날짜별 시간표상 방문 가능' : '운영시간상 방문 가능', detail: (h.note || '방문일 변동을 확인하세요.') + soft };
  }
  function pillFor(result) { return '<span class="pill ' + (result.kind === 'bad' ? 'bad' : result.kind === 'ok' ? '' : 'warn') + '">' + esc(result.title) + '</span>'; }
  function planSlots() {
    const start = toMin(state.draft.start);
    const end = routeEngine.minutes(state.draft.end || '24:00');
    const set = new Set();
    for (let m = start; m < end; m += 60) set.add(m);
    Object.keys(state.draft.entries || {}).map(Number).filter((m) => m >= start && m < end).forEach((m) => set.add(m));
    return [...set].sort((a,b) => a-b);
  }
  function renderPlan() {
    const d = state.draft;
    if (!d.entries) d.entries = {};
    if (!Array.isArray(d.pending)) d.pending=[];
    const slots = planSlots();
    const filled = slots.filter((m) => d.entries[m]);
    $('#main').innerHTML = '<section class="page planner-page"><button class="back" id="plan-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">나의 하루 계획</div><h1>시간계획표</h1><p>시간은 예상입니다. 실제로 떠날 때 다음 장소의 길을 열어보세요.</p></div><div class="top-actions"><button class="btn btn-outline" id="new-plan">새 계획</button><button class="btn btn-primary" id="save-plan">계획 저장</button></div></div>' +
      '<div class="planner-grid"><div><div class="card"><label class="field-label" for="plan-title">계획 이름</label><input class="text-field" id="plan-title" value="' + esc(d.title) + '" maxlength="80"><div class="form-grid" style="margin-top:14px"><div class="field-group"><label class="field-label" for="plan-date">날짜</label><input class="text-field" type="date" id="plan-date" value="' + esc(d.date) + '"></div><div class="field-group"><label class="field-label" for="plan-start">시작 시각</label><input class="text-field" type="time" id="plan-start" value="' + esc(d.start) + '"></div><div class="field-group"><label class="field-label" for="plan-end">끝낼 시각</label><input class="text-field" type="time" id="plan-end" value="' + esc(d.end === '24:00' ? '23:59' : d.end || '23:59') + '" ' + (d.end === '24:00' ? 'disabled' : '') + '><label class="check-line"><input type="checkbox" id="plan-midnight" ' + (d.end === '24:00' ? 'checked' : '') + '> 자정까지</label></div></div></div>' +
      '<div class="slot-list">' + slots.map((m) => slotHtml(m, d.entries[m])).join('') + '</div></div>' +
      '<aside class="card plan-aside"><div class="eyebrow">계획 안내</div><h3>내 일정은 내 속도로</h3><p>장소에서 일찍 나오거나 오래 머물러도 괜찮아요. 다음 장소로 출발할 때 버튼을 누르면 그 시각 기준으로 다시 확인합니다.</p><div class="notice">운영시간·브레이크·공식 입장/주문 마감을 확인합니다. <strong>폐관 1시간 전 입장</strong>은 권장 안내이며 자동 삭제 기준이 아닙니다.</div><p class="small" style="margin:14px 0 0">장소 정보 기준 2026-10-01. 임시휴무와 실제 출입구는 방문 전에 다시 확인하세요.</p></aside></div></section>';
    $('.plan-aside')?.insertAdjacentHTML('afterbegin', turtlePose('memo', '계획을 적는 거북이', 'turtle-aside'));
    if (d.pending.length) $('.slot-list').insertAdjacentHTML('beforebegin','<section class="plan-pending"><h2>보류 중인 장소 <small>' + d.pending.length + '곳</small></h2><p class="small">빈 시각을 정하면 계획표에 넣을 수 있습니다.</p>' + d.pending.map((item,i) => '<div class="plan-pending-item"><div><strong>' + esc(entryLabel(item.entry)) + '</strong><small>추천 ' + esc(hhmm(item.minute)) + (item.date !== d.date ? ' · 추천 날짜 ' + esc(item.date) : '') + '</small></div><label>넣을 시각 <input type="time" class="text-field" data-pending-time="' + i + '" value="' + esc(hhmm(item.minute)) + '"></label><button type="button" class="btn btn-outline btn-sm" data-apply-pending="' + i + '">넣기</button><button type="button" class="btn btn-outline btn-sm" data-remove-pending="' + i + '" aria-label="' + esc(entryLabel(item.entry)) + ' 보류에서 빼기">빼기</button></div>').join('') + '</section>');
    $('#plan-back').onclick = () => nav('region');
    $('#save-plan').onclick = savePlan;
    $('#new-plan').onclick = () => openModal('<h2>새 계획을 시작할까요?</h2><p>현재 계획은 저장하지 않았다면 복구할 수 없습니다.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="confirm-new">새 계획</button></div>', () => { $('#confirm-new').onclick = () => { state.draft = { id: null, title: '나의 목포 하루', date: today(), start: '09:00', end:'24:00', origin: null, theme:'balanced', mealTimes:[], entries: {}, pending:[] }; persistDraft(); closeModal(); renderPlan(); }; });
    $('#plan-title').onchange = (e) => { d.title = e.target.value.trim() || '나의 목포 하루'; persistDraft(); };
    $('#plan-date').onchange = (e) => { d.date = e.target.value || today(); persistDraft(); renderPlan(); };
    $('#plan-start').onchange = (e) => changePlanStart(e.target.value);
    const updatePlanEnd = () => { const value=$('#plan-midnight').checked ? '24:00' : $('#plan-end').value; const end=routeEngine.minutes(value); if (end <= toMin(d.start) || Object.keys(d.entries).some((m) => Number(m) >= end)) { toast('끝낼 시각은 시작과 모든 방문 뒤로 정해 주세요.'); renderPlan(); return; } d.end=value; persistDraft(); renderPlan(); };
    $('#plan-end').onchange = updatePlanEnd;
    $('#plan-midnight').onchange = updatePlanEnd;
    document.querySelectorAll('[data-edit-slot]').forEach((b) => b.onclick = () => openSlotEditor(Number(b.dataset.editSlot)));
    document.querySelectorAll('[data-remove-slot]').forEach((b) => b.onclick = () => removeEntry(Number(b.dataset.removeSlot)));
    document.querySelectorAll('[data-go-next]').forEach((b) => b.onclick = () => showJourney(Number(b.dataset.goNext)));
    document.querySelectorAll('[data-apply-pending]').forEach((b) => b.onclick=() => applyPending(Number(b.dataset.applyPending)));
    document.querySelectorAll('[data-remove-pending]').forEach((b) => b.onclick=() => { d.pending.splice(Number(b.dataset.removePending),1); persistDraft(); renderPlan(); });
    if (!filled.length) $('.slot-list')?.insertAdjacentHTML('afterbegin', '<div class="notice">시간 칸을 눌러 장소를 하나씩 넣어 보세요.</div>');
  }
  function slotHtml(minute, entry) {
    const time = '<div class="slot-time">' + esc(hhmm(minute)) + '<small>' + esc(hhmm(Math.min(minute + 60, routeEngine.minutes(state.draft.end || '24:00')))) + '까지</small></div>';
    if (!entry) return '<div class="slot-card">' + time + '<div class="slot-content slot-empty"><span>아직 계획이 없어요.</span><button class="btn btn-outline btn-sm" data-edit-slot="' + minute + '">+ 이 시간에 추가</button></div></div>';
    const result = evaluate(entry, minute, state.draft.date);
    const place = entryPlace(entry);
    return '<div class="slot-card">' + time + '<div class="slot-content"><div class="toolbar" style="justify-content:space-between"><h3>' + esc(entryLabel(entry)) + '</h3>' + pillFor(result) + '</div><p>' + esc(result.detail) + '</p>' + (place ? '<p class="small">' + esc(placeTimeText(place)) + '</p>' : '<p class="small">직접 입력한 장소 · 영업 정보 미확인</p>') + (entry.memo ? '<p>메모 · ' + esc(entry.memo) + '</p>' : '') + '<div class="slot-actions"><button class="btn btn-mint btn-sm" data-go-next="' + minute + '">이제 이 장소로 이동</button><button class="btn btn-outline btn-sm" data-edit-slot="' + minute + '">수정</button><button class="btn btn-outline btn-sm" data-remove-slot="' + minute + '">삭제</button></div></div></div>';
  }
  function recommendations(minute) {
    const d = state.draft;
    const used = new Set(Object.values(d.entries).map((e) => e.placeId));
    const earlier = Object.entries(d.entries).map(([t,e]) => [Number(t),e]).filter(([t,e]) => t < minute && coord(entryCoord(e))).sort((a,b) => b[0]-a[0])[0];
    const anchor = earlier ? entryCoord(earlier[1]) : (d.origin === 'current' ? d.currentOrigin || STATION : d.origin === 'custom' ? d.customOrigin || STATION : getPlace(d.origin) || STATION);
    const meal = (d.mealTimes || []).some((value) => value && routeEngine.minutes(value) === minute);
    return state.places.filter((p) => coord(p) && !used.has(p.id) && (!meal || ['food','cafe'].includes(p.category)))
      .map((p) => ({ p, result: evaluate({placeId:p.id,duration:routeEngine.stay(p,meal)},minute,d.date), distance: km(anchor,p) || 99 }))
      .filter((v) => v.distance <= 1.1 && v.result.kind !== 'bad' && !(v.result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(v.result.title)))
      .sort((a,b) => (b.result.kind === 'ok' ? 1 : 0) - (a.result.kind === 'ok' ? 1 : 0) || (routeEngine.themeScore(b.p,d.theme || 'balanced',0)-routeEngine.themeScore(a.p,d.theme || 'balanced',0)) || a.distance-b.distance).slice(0,3);
  }
  function openSlotEditor(minute) {
    const entry = state.draft.entries[minute]; const recs = recommendations(minute);
    const body = '<h2>' + esc(hhmm(minute)) + ' 계획</h2><p>추천 장소를 누르면 바로 이 시간 칸에 들어갑니다.</p><div class="section-label">이 시간에 추천하는 장소</div>' +
      (recs.length ? '<div class="suggest-grid">' + recs.map(({p,result,distance}) => '<button class="suggest-btn" data-recommend="' + p.id + '"><strong>' + esc(p.name) + '</strong><small>직선 약 ' + distance.toFixed(2) + 'km · ' + esc(result.title) + '</small></button>').join('') + '</div>' : '<div class="notice warn">이 시각·거리·식사 조건에 맞는 후보를 확인하지 못했습니다. 직접 입력할 수 있어요.</div>') +
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
    openModal('<h2>지도에서 위치 찍기</h2><p>지도 위를 눌러 장소 위치를 선택하세요. 실제 건물 출입구인지 확인해 주세요.</p><div class="pin-map-wrap"><div id="pin-map"></div></div><p id="picked-coord" class="small">' + (pin ? pin.lat.toFixed(5) + ', ' + pin.lon.toFixed(5) : '아직 위치를 찍지 않았습니다.') + '</p><div class="modal-actions"><button class="btn btn-outline" id="pin-back">돌아가기</button><button class="btn btn-primary" id="pin-done" ' + (pin ? '' : 'disabled') + '>위치 사용</button></div>', async () => {
      const back = () => { openSlotEditor(minute); $('#custom-name').value = name; $('#custom-location').value = locationText; $('#entry-duration').value = duration; $('#entry-memo').value = memo; };
      $('#pin-back').onclick = back; $('#pin-done').onclick = back;
      if (KAKAO_KEY) {
        try {
          await loadKakao();
          if (!$('#pin-map')) return;
          const map = new kakao.maps.Map($('#pin-map'), {center: kakaoPoint(...(pin ? [pin.lat, pin.lon] : MOKPO)), level: kakaoLevel(14)});
          let marker = pin ? new kakao.maps.Marker({position:kakaoPoint(pin.lat,pin.lon),map}) : null;
          kakao.maps.event.addListener(map,'click',(e) => {
            const lat = e.latLng.getLat(), lon = e.latLng.getLng();
            state.pinSelection = {lat,lon}; marker?.setMap(null);
            marker = new kakao.maps.Marker({position:e.latLng,map});
            $('#picked-coord').textContent = lat.toFixed(5) + ', ' + lon.toFixed(5); $('#pin-done').disabled = false;
          });
          setTimeout(() => map.relayout(),60);
          return;
        } catch { toast('카카오맵 연결에 실패해 기존 지도를 표시합니다.'); }
      }
      const map = L.map('pin-map').setView(pin ? [pin.lat,pin.lon] : MOKPO, 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map);
      let marker = pin ? L.circleMarker([pin.lat,pin.lon],{radius:9,color:'#087a61'}).addTo(map) : null;
      map.on('click', (e) => { state.pinSelection = {lat:e.latlng.lat,lon:e.latlng.lng}; marker?.remove(); marker = L.circleMarker(e.latlng,{radius:9,color:'#087a61',fillColor:'#71e0bc',fillOpacity:1}).addTo(map); $('#picked-coord').textContent = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5); $('#pin-done').disabled = false; });
      setTimeout(() => map.invalidateSize(),60);
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
    if (state.route.origin === 'custom' && state.route.customOrigin) return {...state.route.customOrigin,id:'custom'};
    return getPlace(state.route.origin) || STATION;
  }
  function routeDestination() {
    if (state.route.destination === 'current' && state.route.current) return state.route.current;
    if (state.route.destination === 'custom' && state.route.customDestination) return {...state.route.customDestination,id:'custom'};
    return getPlace(state.route.destination) || STATION;
  }
  function setupRoutePlaceSearch(kind) {
    const r = state.route, isOrigin = kind === 'origin';
    const select = $('#route-' + kind);
    const field = select.closest('.field-group');
    const places = [STATION, ...state.places.filter((p) => coord(p) && !['p41','p51'].includes(p.id))];
    field.querySelector('.field-label').outerHTML = '<div class="route-field-header"><label class="field-label" for="route-' + kind + '-query">' + (isOrigin ? '시작 위치' : '도착 위치') + '</label><button type="button" class="route-current-btn" id="route-' + kind + '-current" aria-label="현재 위치를 ' + (isOrigin ? '시작' : '도착') + ' 위치로 사용">📍 현재 위치</button></div>';
    field.querySelector('#use-location')?.remove();
    select.outerHTML = '<div class="route-place-search"><div class="route-search-line"><input class="text-field" id="route-' + kind + '-query" autocomplete="off" placeholder="장소명 또는 주소 입력" aria-controls="route-' + kind + '-matches"><button type="button" class="route-search-icon" id="route-' + kind + '-online" aria-label="온라인에서 ' + (isOrigin ? '시작' : '도착') + ' 위치 검색" title="온라인 주소·장소 검색">🔍</button></div><div class="route-place-selected" id="route-' + kind + '-selected" role="status"></div><div class="route-place-matches" id="route-' + kind + '-matches"></div></div>';
    const input = $('#route-' + kind + '-query'), matches = $('#route-' + kind + '-matches');
    const selected = $('#route-' + kind + '-selected');
    const value = () => isOrigin ? r.origin : r.destination;
    const set = (id, place) => {
      if (isOrigin) { r.origin = id; if (id === 'custom') r.customOrigin = place; }
      else { r.destination = id; if (id === 'custom') r.customDestination = place; }
      selected.innerHTML = '<span>선택한 위치</span><strong>' + esc(place?.name || (id === 'current' ? '현재 위치' : (places.find((p) => p.id === id)?.name || '목포역'))) + '</strong>';
      input.value = ''; matches.innerHTML = '';
      r.results = []; $('#route-results').innerHTML = '';
    };
    const current = value() === 'custom' ? (isOrigin ? r.customOrigin : r.customDestination) : value() === 'current' ? r.current : places.find((p) => p.id === value());
    selected.innerHTML = '<span>선택한 위치</span><strong>' + esc(current?.name || '목포역') + '</strong>';
    function show(items) {
      matches.innerHTML = items.length ? items.map((p,i) => '<button type="button" class="route-place-match" data-match="' + i + '"><strong>' + esc(p.name) + '</strong>' + (p.address ? '<small>' + esc(p.address) + '</small>' : '') + '</button>').join('') : '<p class="small">검색 결과가 없습니다.</p>';
      matches.querySelectorAll('[data-match]').forEach((button) => button.onclick = () => {
        const p = items[Number(button.dataset.match)]; set(p.id || 'custom', p.id ? p : {...p,id:'custom'});
      });
    }
    input.oninput = () => {
      const q = input.value.trim().toLocaleLowerCase();
      matches.innerHTML = '';
      if (q) show(places.filter((p) => p.name.toLocaleLowerCase().includes(q)).slice(0, 12));
    };
    input.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); $('#route-' + kind + '-online').click(); } };
    $('#route-' + kind + '-online').onclick = async () => {
      const q = input.value.trim();
      if (q.length < 2) return toast('주소나 장소명을 두 글자 이상 입력해 주세요.');
      if (!navigator.onLine) return toast('온라인 주소 검색에는 인터넷 연결이 필요합니다.');
      const button = $('#route-' + kind + '-online'); button.disabled = true; button.textContent = '검색 중…';
      try {
        const response = await fetch('/api/place-search?q=' + encodeURIComponent(q), {cache:'no-store'});
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('주소 검색 서버 연결이 필요합니다.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '검색에 실패했습니다.');
        show(data.results || []);
      } catch (error) { toast(error.message || '온라인 주소 검색에 실패했습니다.'); }
      finally { button.disabled = false; button.textContent = '🔍'; }
    };
    const locationButton = $('#route-' + kind + '-current');
    locationButton.onclick = () => {
      if (!navigator.geolocation) return toast('이 기기에서는 현재 위치를 사용할 수 없습니다.');
      navigator.geolocation.getCurrentPosition((pos) => {
        r.current = {id:'current',name:'현재 위치',lat:pos.coords.latitude,lon:pos.coords.longitude};
        set('current', r.current); toast('현재 위치를 ' + (isOrigin ? '출발' : '도착') + ' 지점으로 설정했습니다.');
      }, () => toast('위치 권한을 확인해 주세요.'), {enableHighAccuracy:false,timeout:10000});
    };
  }
  function setupRequiredPlaceSearch() {
    const r=state.route, select=$('#route-must'), field=select.closest('.field-group');
    const places=state.places.filter((p) => coord(p) && !routeEngine.EXCLUDED_IDS.has(p.id));
    field.querySelector('.field-label').htmlFor='route-must-query';
    select.outerHTML='<div class="route-place-search"><input class="text-field" id="route-must-query" autocomplete="off" placeholder="가고 싶은 장소 이름 입력" aria-controls="route-must-matches"><div class="route-place-selected" id="route-must-selected" role="status"></div><div class="route-place-matches" id="route-must-matches"></div></div><label class="check-line route-must-optional"><input type="checkbox" id="route-must-optional" ' + (r.mustOptional ? 'checked' : '') + '> 루트에 꼭 넣을 필요 없음</label>';
    const input=$('#route-must-query'), selected=$('#route-must-selected'), matches=$('#route-must-matches');
    function updateSelected() {
      const place=places.find((p) => p.id === r.must);
      selected.innerHTML=place ? '<span>선택한 장소</span><strong>' + esc(place.name) + '</strong><button type="button" class="route-place-clear" id="route-must-clear" aria-label="선택한 장소 지우기">×</button>' : '<span>선택한 장소</span><strong>없음</strong>';
      $('#route-must-optional').disabled=!place;
      $('#route-must-optional').closest('.check-line').classList.toggle('is-disabled',!place);
      if (place) $('#route-must-clear').onclick=() => { r.must=''; r.mustOptional=false; $('#route-must-optional').checked=false; updateSelected(); r.results=[]; $('#route-results').innerHTML=''; };
    }
    updateSelected();
    input.oninput=() => {
      const q=input.value.trim().toLocaleLowerCase();
      const items=q ? places.filter((p) => p.name.toLocaleLowerCase().includes(q)).slice(0,12) : [];
      matches.innerHTML=q ? (items.length ? items.map((p,i) => '<button type="button" class="route-place-match" data-must-match="' + i + '"><strong>' + esc(p.name) + '</strong>' + (p.address ? '<small>' + esc(p.address) + '</small>' : '') + '</button>').join('') : '<p class="small">검색 결과가 없습니다.</p>') : '';
      matches.querySelectorAll('[data-must-match]').forEach((button) => button.onclick=() => {
        r.must=items[Number(button.dataset.mustMatch)].id; input.value=''; matches.innerHTML=''; updateSelected(); r.results=[]; $('#route-results').innerHTML='';
      });
    };
    input.onkeydown=(event) => { if (event.key === 'Enter') { event.preventDefault(); matches.querySelector('[data-must-match]')?.click(); } };
    $('#route-must-optional').onchange=(event) => { r.mustOptional=event.target.checked; r.results=[]; $('#route-results').innerHTML=''; };
  }
  async function makeRoutes() {
    for (const [key, entry] of routeCache) if (!entry.persistent) routeCache.delete(key);
    const r=state.route;
    const preset=r.mode === 'theme' ? routeEngine.THEME_PRESETS[r.theme] : null;
    const origin=preset ? (getPlace(preset.originId) || STATION) : routeOrigin();
    const destination=preset ? (getPlace(preset.destinationId) || STATION) : routeDestination();
    const validateRoute=(p,minute,duration,date) => evaluate({placeId:p.id,duration},minute,date);
    let apiAvailable=true;
    const providers={
      routeProvider:async (a,b) => { if (!apiAvailable) throw Error('도보 API 연결 불가'); try { const route=(await getRoute('walk',a,b))[0]; return {meters:route.meters,minutes:route.minutes,points:route.points || []}; } catch (error) { if (/조회하지 못|연결하지 못|503|502|429|안전 한도|Unexpected token/.test(error.message)) apiAvailable=false; throw error; } },
      busProvider:async (a,b) => getRoute('transit',a,b)
    };
    if (preset) {
      const routes=await routeEngine.generateThemeDay({places:state.places,origin,destination,date:r.date,theme:r.theme,validate:validateRoute,...providers});
      return routes.map((route) => ({...route,originId:origin.id,destinationId:destination.id,originPoint:origin,destinationPoint:destination}));
    }
    const input={places:state.places,origin,destination,
      start:r.start,end:r.end,date:r.date,theme:'balanced',mealTimes:[],routeFocus:r.focus,
      requiredPlaceId:r.must && !r.mustOptional ? r.must : '',preferredPlaceId:r.must && r.mustOptional ? r.must : '',
      validate:validateRoute,...providers};
    const routes=await routeEngine.generateAdaptive(input);
    return routes.map((route) => ({...route,
      originId:origin.id,destinationId:destination.id,originPoint:origin,destinationPoint:destination}));
  }
  function captureRouteInputs() {
    const r=state.route;
    r.date=$('#route-date').value || today();
    if (r.mode === 'theme') return;
    r.start=$('#route-start').value;
    r.end=$('#route-midnight').checked ? '24:00' : $('#route-end').value;
    r.mustOptional=$('#route-must-optional').checked;
  }
  function renderRoutes() {
    const r = state.route;
    const endpointPlaces = state.places.filter((p) => coord(p) && !['p41','p51'].includes(p.id));
    const options = [STATION,...endpointPlaces].map((p) => '<option value="' + esc(p.id) + '" ' + (r.origin === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const destinationOptions = [STATION,...endpointPlaces].map((p) => '<option value="' + esc(p.id) + '" ' + (r.destination === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const must = '<option value="">선택 안 함</option>' + state.places.filter((p) => coord(p) && !routeEngine.EXCLUDED_IDS.has(p.id)).map((p) => '<option value="' + esc(p.id) + '" ' + (r.must === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const themeOptions=routeEngine.THEMES.map((t) => '<option value="' + t.id + '" ' + (r.theme === t.id ? 'selected' : '') + '>' + t.name + '</option>').join('');
    $('#main').innerHTML = '<section class="page routes-page"><button class="back" id="routes-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">하루 동선 후보</div><h1>추천 루트</h1><p>출발지에서 도착지까지 가까운 곳을 이어 주세요. 식사는 원하는 시각에 맞춥니다.</p></div></div><div class="card"><div class="form-grid"><div class="field-group"><label class="field-label" for="route-date">날짜</label><input class="text-field" type="date" id="route-date" value="' + esc(r.date) + '"></div><div class="field-group"><label class="field-label" for="route-start">시작 시각</label><input class="text-field" type="time" id="route-start" value="' + esc(r.start) + '"></div><div class="field-group"><label class="field-label" for="route-end">끝낼 시각</label><input class="text-field" type="time" id="route-end" value="' + esc(r.end === '24:00' ? '23:59' : r.end) + '" ' + (r.end === '24:00' ? 'disabled' : '') + '><label class="check-line"><input type="checkbox" id="route-midnight" ' + (r.end === '24:00' ? 'checked' : '') + '> 자정까지</label></div></div><div class="form-grid two" style="margin-top:14px"><div class="field-group"><label class="field-label" for="route-origin">시작 위치</label><select class="select-field" id="route-origin">' + options + (r.current ? '<option value="current" ' + (r.origin === 'current' ? 'selected' : '') + '>현재 위치</option>' : '') + '</select><button class="btn btn-outline btn-sm" id="use-location" style="margin-top:8px">현재 위치 사용</button></div><div class="field-group"><label class="field-label" for="route-destination">도착 위치</label><select class="select-field" id="route-destination">' + destinationOptions + (r.current ? '<option value="current" ' + (r.destination === 'current' ? 'selected' : '') + '>현재 위치</option>' : '') + '</select></div></div><div class="form-grid two" style="margin-top:14px"><div class="field-group"><label class="field-label" for="route-theme">여행 테마</label><select class="select-field" id="route-theme">' + themeOptions + '</select></div><div class="field-group"><label class="field-label" for="route-must">꼭 가고 싶은 장소</label><select class="select-field" id="route-must">' + must + '</select></div></div><div class="form-grid meal-grid" style="margin-top:14px">' + '' + '</div><p class="small" style="margin:10px 0 0">식사 시각은 비워둘 수 있습니다. 입력한 시각에는 음식점 또는 카페만 넣습니다.</p><div class="modal-actions"><button class="btn btn-primary" id="make-routes">코스 찾기</button></div></div><div class="notice warn" style="margin-top:18px">걷기를 우선합니다. 도보로 연결하기 어려울 때만 버스를 확인합니다. 걷는 구간은 1.6km·30분, 하루 도보 합계는 8km 이내입니다. 확인되지 않은 영업시간과 추정 이동 구간은 따로 표시합니다. 케이블카를 도보 이동으로 계산하지 않습니다.</div><div id="route-results" class="route-results"></div></section>';
    setupRoutePlaceSearch('origin');
    setupRoutePlaceSearch('destination');
    setupRequiredPlaceSearch();
    $('#route-origin-query').closest('.form-grid').classList.add('route-endpoint-grid');
    $('#route-must-query').closest('.form-grid').style.gridTemplateColumns='minmax(0,1fr)';
    $('#route-end').closest('.field-group').querySelector('.field-label').textContent='끝낼 시각 (도착)';
    const mealGrid=$('.meal-grid');
    mealGrid.nextElementSibling.id='route-meal-guide';
    mealGrid.nextElementSibling.textContent='코스를 먼저 찾은 뒤, 그 길에서 들를 수 있는 식당과 식사 시각을 선택할 수 있습니다.';
    mealGrid.remove();
    $('#main .page-head p').textContent = r.mode === 'theme' ? '날짜와 테마만 고르면 운영정보에 맞춰 하루 시간표를 만듭니다.' : '출발·도착 위치와 가고 싶은 장소를 정하세요. 끝낼 시각까지 도착하고, 식당과 방문 시각은 결과에서 직접 고릅니다.';
    const modeTabs='<div class="route-mode-tabs"><button type="button" class="filter-chip ' + (r.mode !== 'theme' ? 'active' : '') + '" data-route-mode="custom">출발·도착 맞춤</button><button type="button" class="filter-chip ' + (r.mode === 'theme' ? 'active' : '') + '" data-route-mode="theme">테마별 추천 코스</button></div>';
    const themeCards=r.mode === 'theme' ? '<div class="card route-theme-panel"><p class="small">테마 코스는 걷기 좋은 권역의 하루 동선을 자동으로 짭니다. 방문 시간과 식사 시간도 선택한 날짜의 운영정보를 고려해 배치합니다.</p><div class="route-theme-grid">' + routeEngine.THEMES.filter((t) => t.id !== 'balanced').map((t) => '<button type="button" class="route-theme-choice ' + (r.theme === t.id ? 'active' : '') + '" data-theme-choice="' + t.id + '"><strong>' + esc(t.name) + '</strong><small>' + esc(routeEngine.THEME_PRESETS[t.id].description) + '</small></button>').join('') + '</div><p class="small">선택한 코스: ' + esc(routeEngine.THEME_PRESETS[r.theme]?.description || '') + '</p></div>' : '';
    $('#main .page-head').insertAdjacentHTML('afterend', modeTabs+themeCards);
    $('#route-theme').closest('.field-group').style.display='none';
    if (r.mode === 'theme') {
      $('#route-start').closest('.field-group').style.display='none';
      $('#route-end').closest('.field-group').style.display='none';
      $('#route-date').closest('.form-grid').style.gridTemplateColumns='minmax(0,1fr)';
      $('#route-origin-query').closest('.form-grid').style.display='none';
      $('#route-must-query').closest('.form-grid').style.display='none';
      $('#route-meal-guide').style.display='none';
      $('#make-routes').textContent='하루 시간표 만들기';
    }
    document.querySelectorAll('[data-route-mode]').forEach((button) => button.onclick=() => { captureRouteInputs(); r.mode=button.dataset.routeMode; r.results=[]; r.selected=-1; renderRoutes(); });
    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.onclick=() => { captureRouteInputs(); r.theme=button.dataset.themeChoice; r.results=[]; r.selected=-1; renderRoutes(); });
    $('#routes-back').onclick = () => nav('region');
    $('#route-midnight').onchange = (e) => { $('#route-end').disabled=e.target.checked; };
    $('#make-routes').onclick = async () => {
      if (r.mode !== 'theme' && ($('#route-origin-query').value.trim() || $('#route-destination-query').value.trim() || $('#route-must-query').value.trim())) { toast('검색 결과에서 위치와 가고 싶은 장소를 선택해 주세요.'); return; }
      captureRouteInputs();
      if (!r.date) { toast('날짜를 선택해 주세요.'); return; }
      if (r.mode !== 'theme') {
        const start=toMin(r.start), end=routeEngine.minutes(r.end);
        if (!r.start || !r.end || end <= start) { toast('끝낼 시각은 시작 시각보다 뒤여야 합니다.'); return; }
      }
      const button=$('#make-routes'); button.disabled=true; button.textContent='시간표 작성 중…';
      $('#route-results').hidden=false;
      $('#route-results').innerHTML='<div class="turtle-loading">' + turtlePose('map','지도를 살펴보는 거북이') + '<span>장소와 도보 경로를 확인하고 있어요.</span></div>';
      r.searched=true;
      try { r.results=await makeRoutes(); r.baseResults=[...r.results]; r.selected=r.results.length ? 0 : -1; showRouteResults(); }
      catch { r.results=[]; r.selected=-1; showRouteResults(); toast('경로 계산에 실패했습니다. 다시 시도해 주세요.'); }
      finally { button.disabled=false; button.textContent=r.mode === 'theme' ? '하루 시간표 만들기' : '코스 찾기'; }
    };
    if (r.results.length) showRouteResults();
  }
  function routeLegText(row) {
    const leg=row.busLeg || row;
    if(leg.mode==='bus') return '버스 연결 '+leg.minutes+'분 (도보 '+leg.walkMinutes+'분·대기 여유 10분 포함) · '+leg.steps.filter(s=>s.type==='BUS').map(s=>s.guidance).join(' → ');
    return '앞 장소에서 도보 '+(row.walkEstimate ?? row.minutes)+'분 / '+((row.walkMeters ?? row.meters)/1000).toFixed(2)+'km '+(row.actual ? '(카카오 경로)' : '(보수적 추정)');
  }
  function showRouteResults() {
    const r = state.route, root = $('#route-results');
    state.resultMap?.remove(); state.resultMap=null;
    const chosen=r.results[r.selected];
    const emptyReason=r.mode === 'theme' ? '선택한 날짜에는 운영정보와 이동 조건을 함께 만족하는 코스를 만들지 못했습니다. 다른 날짜나 테마를 선택해 주세요. 운영시간이 확인되지 않은 장소는 방문 전 확인이 필요합니다.' : r.must && !r.mustOptional ? '선택한 장소를 반드시 포함하면서 끝낼 시각까지 도착하는 코스를 찾지 못했습니다. 시간이나 위치를 바꾸거나, 해당 장소의 ‘루트에 꼭 넣을 필요 없음’을 체크해 다시 찾아보세요.' : '출발·도착 위치가 멀거나 도착 시각을 맞추기 어려울 수 있습니다. 도보와 확인 가능한 버스 연결로 코스를 완성하지 못했습니다. 끝낼 시각이나 도착 위치를 조정해 보세요.';
    const stops=chosen ? chosen.rows.map((x,i) => {
      const previous=chosen.rows[i-1];
      const freeMinutes=x.minute-(previous ? previous.minute+previous.duration : chosen.start)-x.walkEstimate;
      const gap=freeMinutes > 25 ? '<div class="route-gap">' + esc(hhmm(previous ? previous.minute+previous.duration : chosen.start)) + ' 이후 약 ' + freeMinutes + '분 빈 시간 · 자유롭게 보내거나 이동 여유로 사용하세요.</div>' : '';
      return gap + '<div class="route-stop"><div class="route-stop-time">' + esc(hhmm(x.minute)) + '<small>~ ' + esc(hhmm(x.minute+x.duration)) + '</small><button type="button" class="route-add-one" data-add-route-stop="' + i + '" aria-label="' + esc(getPlace(x.placeId)?.name) + '만 시간계획표에 넣기">+ 넣기</button></div><div><strong>' + (x.kind === 'meal' ? '식사 · ' : x.kind === 'cafe' ? '카페 휴식 · ' : '') + esc(getPlace(x.placeId)?.name) + '</strong><p>' + esc(x.duration) + '분 체류 · ' + esc(routeLegText(x)) + '</p><small>' + esc(x.result.title) + (x.result.kind === 'unknown' ? ' · 영업 확인 필요' : '') + '</small></div></div>';
    }).join('') : '';
    const endRow=chosen ? '<div class="route-stop"><div class="route-stop-time">' + esc(hhmm(chosen.endArrival)) + '</div><div><strong>도착 · ' + esc(chosen.destinationName) + '</strong><p>' + esc(routeLegText(chosen.endWalk)) + '</p></div></div>' : '';
    const free=chosen && !chosen.autoSchedule && chosen.endArrival < chosen.end-15 ? '<div class="notice" style="margin-top:12px">' + esc(hhmm(chosen.endArrival)) + ' 도착 후 ' + esc(hhmm(chosen.end)) + '까지 자유시간입니다. 확인되지 않은 야간 영업 장소를 임의로 넣지 않았습니다.</div>' : '';
    root.innerHTML = chosen ? '<div class="section-label">추천 코스 ' + r.results.length + '개</div><div class="route-tabs">' + r.results.map((x,i) => '<button class="filter-chip ' + (i === r.selected ? 'active' : '') + '" data-route-tab="' + i + '">' + esc(x.title) + '</button>').join('') + '</div><div class="card"><p><strong>' + esc(chosen.originName) + ' ' + esc(hhmm(chosen.start)) + ' 출발 → ' + esc(chosen.destinationName) + ' ' + esc(hhmm(chosen.end)) + '까지</strong></p><p class="small">방문 ' + chosen.rows.length + '곳 · 도보 합계 약 ' + (chosen.walkMeters/1000).toFixed(2) + 'km · ' + esc(routeEngine.THEMES.find((t) => t.id === chosen.theme)?.name || '') + '</p>' + stops + endRow + free + '<p class="small" style="margin-top:14px">영업시간 미확인 장소는 방문 전 확인하세요. 주소 좌표는 건물 대표점일 수 있으며, 이동시간에 신호와 대기는 별도로 여유를 두세요.</p><button class="btn btn-primary" id="import-route">시간계획표에 넣기</button></div>' : '<div class="card empty-state"><h3>조건에 맞는 코스를 찾지 못했습니다.</h3><p>' + esc(emptyReason) + '</p><button class="btn btn-outline" id="go-own-plan">내 계획 만들기</button></div>';
    if (chosen) {
      root.querySelector('.route-tabs').insertAdjacentHTML('afterend','<div class="route-result-map-wrap"><div id="route-result-map" role="img" aria-label="추천 코스 이동 순서 지도"></div><p class="small">숫자는 방문 순서, 화살표는 이동 방향입니다. 초록 선은 도보, 파란 선은 버스 연결입니다. 점선은 경로 미확인 구간의 방향입니다.</p></div>');
      initResultMap(chosen);
      if(chosen.transport==='walk-bus') root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<p class="notice">도보만으로 연결하기 어려워 버스를 포함했습니다. 버스 구간은 정류장까지 걷는 시간과 대기 여유 10분을 포함합니다. 실제 배차·막차는 출발 전에 확인하세요.</p>');
      if(chosen.autoSchedule && !chosen.plannedMeals.length) root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<p class="notice">동선과 운영시간에 맞는 식사를 자동으로 넣지 못했습니다. 식사는 시간계획표에서 추가해 주세요.</p>');
      if (chosen.reverseDropped) root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<div class="notice warn" style="margin-bottom:14px">반대 방향에서는 운영시간·도보 조건에 맞추기 위해 방문지 ' + chosen.reverseDropped + '곳을 제외했습니다.</div>');
      root.querySelectorAll('[data-add-route-stop]').forEach((button) => button.onclick=() => addRouteStop(chosen.rows[Number(button.dataset.addRouteStop)]));
      if (coord(chosen.originPoint) && coord(chosen.destinationPoint) && routeEngine.distanceKm(chosen.originPoint,chosen.destinationPoint) < .015 && chosen.rows.length > 1) {
        root.querySelector('.route-result-map-wrap').insertAdjacentHTML('beforebegin','<button type="button" class="route-reverse-btn" id="reverse-route">' + (chosen.reversed ? '↪ 원래 방향' : '↶ 반대 방향') + '</button>');
        $('#reverse-route').onclick=() => reverseSelectedRoute();
      }
    }
    if (r.mode !== 'theme' && r.searched) {
      const names={through:'출발→도착 길목 위주',start:'출발지 근처 위주',end:'도착지 근처 위주'};
      const actualFocus=chosen?.routeFocus || r.focus;
      if(chosen?.fallbackFocus) root.insertAdjacentHTML('afterbegin','<p class="notice">' + names[r.focus] + '로 연결하기 어려워 ' + names[actualFocus] + ' 코스를 찾았어요. 출발·도착과 필수 조건은 유지했습니다.</p>');
      root.insertAdjacentHTML('afterbegin','<div class="route-direction"><span>동선: <strong>' + names[actualFocus] + '</strong></span><button type="button" class="btn btn-outline btn-sm" id="change-route-focus">동선 바꾸기</button><div class="route-direction-options" id="route-direction-options" hidden>' +
        Object.entries(names).filter(([id]) => id !== actualFocus).map(([id,name]) => '<button type="button" class="filter-chip" data-change-focus="' + id + '">' + name + '</button>').join('') + '</div></div>');
      $('#change-route-focus').onclick=() => { $('#route-direction-options').hidden=!$('#route-direction-options').hidden; };
      root.querySelectorAll('[data-change-focus]').forEach((button) => button.onclick=async () => {
        const previousFocus=r.focus, meals=chosen?.chosenMeals || [];
        captureRouteInputs(); r.focus=button.dataset.changeFocus;
        button.disabled=true; button.textContent='동선을 찾는 중…';
        try {
          const results=(await makeRoutes()).flatMap(base=>{
            const updated=keepFixedRouteMeals(base,meals);
            return updated ? [{...updated,mealBase:meals.length ? base : undefined,skippedMeals:chosen?.skippedMeals || {}}] : [];
          });
          if(!results.length && chosen) {r.focus=previousFocus;showRouteResults();toast('선택한 장소·식사 시각·도착 조건을 지키는 다른 동선을 찾지 못해 현재 코스를 유지합니다.');return;}
          r.results=results;r.baseResults=results.map(route=>route.mealBase || route);r.selected=results.length ? 0 : -1;showRouteResults();
        } catch {r.focus=previousFocus;showRouteResults();toast('동선을 다시 찾지 못해 현재 코스를 유지합니다.');}
      });
    }
    if (chosen && r.mode !== 'theme') {
      const hasMust=r.must && (chosen.rows.some((row) => row.placeId === r.must) || chosen.originId === r.must || chosen.destinationId === r.must);
      if (r.must && r.mustOptional && !hasMust) $('#import-route').insertAdjacentHTML('beforebegin',
        '<div class="notice warn" style="margin-top:14px">선택한 장소는 이번 코스에 포함되지 않았습니다.</div>');
      renderRouteMealChoices(chosen);
    }
    if (r.results.length) root.querySelector('.section-label')?.insertAdjacentHTML('afterbegin', turtlePose('discover', '코스를 발견한 거북이', 'turtle-route-result'));
    else root.querySelector('.empty-state')?.insertAdjacentHTML('afterbegin', turtlePose('think', '다른 길을 생각하는 거북이', 'turtle-empty'));
    root.querySelectorAll('[data-route-tab]').forEach((b) => b.onclick = () => { r.selected = Number(b.dataset.routeTab); showRouteResults(); });
    if ($('#import-route')) $('#import-route').onclick = importRoute;
    if ($('#go-own-plan')) $('#go-own-plan').onclick = () => nav('plan');
    if (chosen) presentRouteResult(chosen);
  }
  function presentRouteResult(chosen) {
    const root=$('#route-results'), page=$('.routes-page'), r=state.route;
    const wasResult=page.classList.contains('has-route-result');
    page.classList.add('has-route-result');root.hidden=false;if(!wasResult)window.scrollTo(0,0);
    const itinerary=root.querySelector('.card');itinerary?.classList.add('route-itinerary');
    const elapsed=chosen.endArrival-chosen.start;
    root.insertAdjacentHTML('afterbegin',`<div class="route-overview-heading"><button class="round-control" id="edit-route-conditions" aria-label="추천 조건으로 돌아가기">${uiIcon('back')}</button><div><span class="eyebrow">나의 목포 하루</span><h1>${esc(chosen.title)}</h1></div></div><div class="result-view-switch view-switch" aria-label="추천 코스 보기"><button data-result-view="map">지도</button><button data-result-view="list">방문 순서</button></div>`);
    root.querySelector('.route-result-map-wrap')?.insertAdjacentHTML('afterend',`<div class="route-overview-stats"><div><small>도보 거리</small><strong>${(chosen.walkMeters/1000).toFixed(2)}<span> km</span></strong></div><div><small>예상 일정</small><strong>${Math.floor(elapsed/60)}<span>시간 ${elapsed%60?elapsed%60+'분':''}</span></strong></div><div><small>방문 장소</small><strong>${chosen.rows.length}<span>곳</span></strong></div></div>`);
    const sync=()=>{const list=r.presentation==='list';root.classList.toggle('result-list-view',list);root.querySelectorAll('[data-result-view]').forEach(b=>{const active=b.dataset.resultView===(list?'list':'map');b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});if(!list)requestAnimationFrame(()=>state.resultMap?.invalidateSize());};
    $('#edit-route-conditions').onclick=()=>{page.classList.remove('has-route-result');root.hidden=true;window.scrollTo(0,0);};
    root.querySelectorAll('[data-result-view]').forEach(b=>b.onclick=()=>{r.presentation=b.dataset.resultView;sync();});
    sync();
  }
  function initResultMap(route) {
    if (!window.L || !$('#route-result-map')) return;
    const stops=[route.originPoint,...route.rows.map((row) => getPlace(row.placeId)),route.destinationPoint];
    if (stops.some((place) => !coord(place))) return;
    const map=L.map('route-result-map',{scrollWheelZoom:false}); state.resultMap=map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const bounds=L.latLngBounds([]);
    const roundTrip=routeEngine.distanceKm(route.originPoint,route.destinationPoint) < .015;
    stops.forEach((place,index) => {
      const point=[place.lat,place.lon]; bounds.extend(point);
      if (roundTrip && (index === 0 || index === stops.length-1)) return;
      const label=index === 0 ? '출발' : index === stops.length-1 ? '도착' : String(index);
      L.marker(point,{icon:L.divIcon({className:'route-map-pin',html:'<span>' + label + '</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map).bindTooltip(place.name || label);
    });
    if (roundTrip) {
      const place=route.originPoint;
      L.marker([place.lat,place.lon],{icon:L.divIcon({className:'route-map-pin route-map-pin--home',html:'<span>출·도착</span>',iconSize:[54,30],iconAnchor:[27,15]})}).addTo(map).bindTooltip(place.name || '출발·도착');
    }
    for (let i=0;i<stops.length-1;i++) {
      const leg=i<route.rows.length ? route.rows[i] : route.endWalk;
      const points=leg.walkPoints || leg.points || [];
      const path=points.length > 1 ? points.map(([lon,lat]) => [lat,lon]) : [[stops[i].lat,stops[i].lon],[stops[i+1].lat,stops[i+1].lon]];
      const line=L.polyline(path,{color:leg.mode==='bus' ? '#386acb' : leg.actual && points.length>1 ? '#087a61' : '#6c8290',weight:4,opacity:.85,dashArray:leg.actual && points.length>1 ? null : '6,7'}).addTo(map);
      bounds.extend(line.getBounds());
      const pointIndex=Math.floor((path.length-1)/2), from=path[pointIndex], to=path[pointIndex+1];
      const middle=[(from[0]+to[0])/2,(from[1]+to[1])/2];
      const angle=Math.atan2(-(to[0]-from[0]),(to[1]-from[1])*Math.cos(from[0]*Math.PI/180))*180/Math.PI;
      L.marker(middle,{interactive:false,icon:L.divIcon({className:'route-map-arrow',html:'<span style="transform:rotate(' + angle + 'deg)">➜</span>',iconSize:[25,25],iconAnchor:[12,12]})}).addTo(map);
    }
    map.fitBounds(bounds,{padding:[35,35],maxZoom:15});
    setTimeout(() => { if (state.resultMap === map) map.invalidateSize(); },50);
  }
  async function reverseSelectedRoute() {
    const r=state.route, chosen=r.results[r.selected], original=r.baseResults[r.selected];
    if (!chosen || !original) return;
    if (chosen.reversed) {
      const restored=keepFixedRouteMeals(original,chosen.chosenMeals || []);
      if(!restored) return toast('선택한 식사 시각을 지키면서 원래 방향으로 돌아갈 수 없습니다.');
      r.results[r.selected]={...restored,mealBase:original,skippedMeals:chosen.skippedMeals};showRouteResults();return;
    }
    const button=$('#reverse-route'); button.disabled=true; button.textContent='방향 계산 중…';
    try {
      const reversed=await routeEngine.reverseRoundTrip({route:original,places:state.places,origin:original.originPoint,date:r.date,
        requiredPlaceId:r.must && !r.mustOptional ? r.must : '',
        validate:(place,minute,duration,date) => evaluate({placeId:place.id,duration},minute,date)});
      if (!reversed) return toast('반대 방향은 운영시간·도보 거리·도착 시각을 함께 맞추지 못했습니다.');
      const withMeals=keepFixedRouteMeals(reversed,chosen.chosenMeals || []);
      if(!withMeals) return toast('선택한 식사 시각을 지키는 반대 방향 코스를 찾지 못해 현재 코스를 유지합니다.');
      r.results[r.selected]={...withMeals,mealBase:reversed,skippedMeals:chosen.skippedMeals};showRouteResults();
    } catch { toast('반대 방향 계산에 실패했습니다. 다시 시도해 주세요.'); }
    finally { if (button.isConnected) { button.disabled=false; button.textContent='↶ 반대 방향'; } }
  }
  function keepFixedRouteMeals(route,meals) {
    return routeEngine.restoreFixedMeals(route,meals,{places:state.places,origin:route.originPoint,destination:route.destinationPoint,
      date:state.route.date,requiredPlaceId:state.route.must && !state.route.mustOptional ? state.route.must : '',
      validate:(p,minute,duration,date)=>evaluate({placeId:p.id,duration},minute,date)});
  }
  function renderRouteMealChoices(chosen) {
    const r=state.route, panel=rootMealPanel(), periods=[
      {id:'breakfast',label:'아침',from:6*60,to:11*60,target:9*60},
      {id:'lunch',label:'점심',from:11*60,to:16*60,target:12*60+30},
      {id:'dinner',label:'저녁',from:16*60,to:22*60,target:18*60+30}
    ];
    const ui=r.mealUi ||= {period:'',hour:null};
    const period=periods.find((item) => item.id === ui.period);
    const selected=(chosen.chosenMeals || []).find((meal) => meal.period === period?.id);
    let cached=mealChoicesCache.get(chosen);
    if (!cached) { cached=new Map(); mealChoicesCache.set(chosen,cached); }
    const validateRoute=(p,minute,duration,date) => evaluate({placeId:p.id,duration},minute,date);
    function choices(kind) {
      if (!cached.has(kind)) cached.set(kind,routeEngine.mealChoices({route:chosen,places:state.places,origin:chosen.originPoint,
        destination:chosen.destinationPoint,date:r.date,validate:validateRoute,requiredPlaceId:r.must && !r.mustOptional ? r.must : '',kind}));
      return cached.get(kind);
    }
    const all=period && !selected && !chosen.skippedMeals?.[period.id] ? [...choices('meal'),...choices('cafe')] : [];
    const valid=period ? routeEngine.recommendMealTimes(all,period) : [];
    const hours=[...new Set(valid.map((item) => Math.floor(item.slot.minute/60)))].sort((a,b) => a-b);
    if (period && !hours.includes(ui.hour)) ui.hour=hours[0] ?? null;
    const visible=valid.filter((item) => Math.floor(item.slot.minute/60) === ui.hour).sort((a,b) =>
      Number(!!a.slot.replaceName || !!a.slot.preview.droppedVisits)-Number(!!b.slot.replaceName || !!b.slot.preview.droppedVisits) || a.slot.minute-b.slot.minute);
    const periodButtons=periods.map((item) => {
      const picked=(chosen.chosenMeals || []).find((meal) => meal.period === item.id);
      const status=picked ? hhmm(picked.minute) + ' ' + (getPlace(picked.placeId)?.name || '') : chosen.skippedMeals?.[item.id] ? '건너뜀' : '선택 또는 패스';
      return '<button type="button" class="route-period ' + (ui.period === item.id ? 'active' : '') + '" data-meal-period="' + item.id + '" aria-pressed="' + (ui.period === item.id) + '"><strong>' + item.label + '</strong><small>' + esc(status) + '</small></button>';
    }).join('');
    const hourButtons=hours.map((hour) => '<button type="button" class="filter-chip ' + (ui.hour === hour ? 'active' : '') +
      '" data-meal-hour="' + hour + '" aria-pressed="' + (ui.hour === hour) + '">' + esc(hhmm(hour*60)) + '대</button>').join('');
    const list=visible.map(({choice,slot},i) => {
      return '<form class="route-meal-option" data-meal-index="' + i + '"><div class="route-meal-title"><strong>' + esc(choice.placeName) +
        '</strong><span class="route-meal-type">' + (choice.kind === 'cafe' ? '카페' : '음식점') + '</span></div>' +
        '<p class="route-meal-time-label">추천 시각 <strong>' + esc(hhmm(slot.minute)) + '</strong>' +
          (slot.replaceName || slot.preview.droppedVisits ? ' · 방문 변경' : ' · 기존 방문 유지') + '</p>' +
        (slot.result.kind === 'unknown' ? '<small>영업시간 확인 필요</small>' : '') +
        '<button class="btn btn-outline btn-sm" type="submit" aria-label="' + esc(hhmm(slot.minute)+' '+choice.placeName+' 선택') + '">선택</button></form>';
    }).join('');
    const detail=period ? '<div class="route-meal-detail"><div class="route-meal-detail-head"><strong>' + period.label + '은 언제 드시겠어요?</strong>' +
      (selected ? '' : '<button type="button" class="btn btn-quiet btn-sm" id="skip-route-meal">' + (chosen.skippedMeals?.[period.id] ? '패스 취소' : period.label + ' 패스') + '</button>') + '</div>' +
      (selected ? '<p class="small">선택됨: ' + esc(hhmm(selected.minute)) + ' ' + esc(getPlace(selected.placeId)?.name || '') + '</p>' :
        chosen.skippedMeals?.[period.id] ? '<p class="small">이 식사는 건너뛰었습니다. 패스를 취소하면 다시 고를 수 있습니다.</p>' :
        hours.length ? '<p class="small">장소마다 코스에 맞는 시각 하나를 추천합니다. 선택한 식사 시각은 유지됩니다.</p><div class="route-meal-hours">' +
          hourButtons + '</div><div class="route-meal-options">' + list + '</div>' :
          '<p class="small">이 식사 시간대에 동선·영업·도착 조건을 맞추는 장소가 없습니다.</p>') + '</div>' : '';
    panel.innerHTML='<h3>식사 시간 정하기</h3><p class="small">아침·점심·저녁을 누르면 가능한 시간과 장소가 나옵니다. 먹지 않을 식사는 패스할 수 있습니다.</p>' +
      '<div class="route-periods">' + periodButtons + '</div>' + detail +
      (chosen.chosenMeals?.length || Object.values(chosen.skippedMeals || {}).some(Boolean) ?
        '<button type="button" class="btn btn-outline btn-sm" id="reset-route-meals">식사 선택 초기화</button>' : '');
    panel.querySelectorAll('[data-meal-period]').forEach((button) => button.onclick=() => {
      ui.period=button.dataset.mealPeriod; ui.hour=null; renderRouteMealChoices(chosen);
    });
    panel.querySelectorAll('[data-meal-hour]').forEach((button) => button.onclick=() => {
      ui.hour=Number(button.dataset.mealHour); renderRouteMealChoices(chosen);
    });
    panel.querySelectorAll('form[data-meal-index]').forEach((form) => form.onsubmit=(event) => {
      event.preventDefault();
      const item=visible[Number(form.dataset.mealIndex)];
      const option=item?.slot;
      if (!option) return toast('가능한 시각을 선택해 주세요.');
      const minute=option.minute;
      const apply=() => {
        const updated=routeEngine.addMeal(chosen,option);
        updated.chosenMeals=updated.chosenMeals.map((meal,i) => i === updated.chosenMeals.length-1 ? {...meal,period:period.id} : meal);
        r.results[r.selected]={...updated,mealBase:chosen.mealBase || chosen};
        closeModal(); showRouteResults();
      };
      if (option.replaceName || option.preview.droppedVisits) {
        openModal('<h2>코스 변경을 확인해 주세요</h2><p>' + esc(hhmm(minute)) + ' · ' + esc(option.placeName) + '</p><p>' +
          (option.replaceName ? esc(option.replaceName) + ' 방문 대신 들릅니다. ' : '') +
          (option.preview.droppedVisits ? esc(option.preview.droppedPlaceNames?.join(', ') || ('방문 '+option.preview.droppedVisits+'곳')) + ' 방문을 생략합니다. 이미 선택한 식사 시각은 유지됩니다.' : '') +
          '</p><div class="modal-actions"><button type="button" class="btn btn-outline" data-close>취소</button><button type="button" class="btn btn-primary" id="confirm-route-meal">선택</button></div>',
          () => { $('#confirm-route-meal').onclick=apply; });
      } else apply();
    });
    if (panel.querySelector('#skip-route-meal')) panel.querySelector('#skip-route-meal').onclick=() => {
      const updated={...chosen,skippedMeals:{...chosen.skippedMeals,[period.id]:!chosen.skippedMeals?.[period.id]}};
      r.results[r.selected]=updated;
      renderRouteMealChoices(updated);
    };
    if (panel.querySelector('#reset-route-meals')) panel.querySelector('#reset-route-meals').onclick=() => {
      r.results[r.selected]=chosen.mealBase || r.baseResults[r.selected]; r.mealUi={period:'',hour:null}; showRouteResults();
    };
    function rootMealPanel() {
      let result=$('#route-meal-panel');
      if (!result) {
        const map=$('#route-result-map')?.closest('.route-result-map-wrap');
        map?.insertAdjacentHTML('afterend','<section class="route-meal-panel" id="route-meal-panel" aria-label="식사 시간 정하기"></section>');
        result=$('#route-meal-panel');
      }
      return result;
    }
  }
  function planConflict(minute, entry) {
    return Object.entries(state.draft.entries || {}).find(([at,existing]) => minute < Number(at)+(Number(existing.duration)||60) && minute+(Number(entry.duration)||60) > Number(at));
  }
  function holdRouteStop(minute,entry,date) {
    const pending=state.draft.pending ||= [];
    if (pending.some((item) => item.minute === minute && item.entry.placeId === entry.placeId && item.date === date)) return toast('이미 보류 목록에 있는 장소입니다.');
    pending.push({minute,entry,date}); persistDraft(); closeModal(); toast('계획표의 보류 목록에 담았습니다.');
  }
  function addRouteStop(row) {
    if (!row) return;
    const minute=row.minute, entry={placeId:row.placeId,duration:row.duration,memo:row.mode==='bus' ? routeLegText(row) : row.kind === 'meal' ? '추천 코스의 식사' : row.kind === 'cafe' ? '추천 코스의 카페 휴식' : ''};
    const d=state.draft, end=routeEngine.minutes(d.end || '24:00');
    const conflict=planConflict(minute,entry), outside=minute < toMin(d.start) || minute+entry.duration > end, otherDate=d.date !== state.route.date;
    if (conflict || outside || otherDate) {
      const reason=conflict ? esc(hhmm(Number(conflict[0]))) + '에 ' + esc(entryLabel(conflict[1])) + ' 일정이 있습니다.' : otherDate ? '현재 계획표와 추천 코스의 날짜가 다릅니다.' : '추천 시각이 현재 계획표의 시작·종료 범위 밖입니다.';
      openModal('<h2>보류 상태로 둘까요?</h2><p><strong>' + esc(entryLabel(entry)) + '</strong> · 추천 ' + esc(hhmm(minute)) + '</p><p>' + reason + ' 기존 계획은 유지하고, 보류 목록에서 빈 시각을 정할 수 있습니다.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="hold-route-stop">보류에 담기</button></div>', () => { $('#hold-route-stop').onclick=() => holdRouteStop(minute,entry,state.route.date); });
      return;
    }
    d.entries[minute]=entry; persistDraft(); toast(entryLabel(entry) + '을(를) ' + hhmm(minute) + ' 계획표에 넣었습니다.');
  }
  function applyPending(index) {
    const d=state.draft, item=d.pending?.[index]; if (!item) return;
    const value=document.querySelector('[data-pending-time="' + index + '"]')?.value;
    if (!value) return toast('넣을 시각을 선택해 주세요.');
    const minute=toMin(value), end=routeEngine.minutes(d.end || '24:00');
    if (minute < toMin(d.start) || minute+item.entry.duration > end) return toast('계획표의 시작·종료 시각 안으로 정해 주세요.');
    if (planConflict(minute,item.entry)) return toast('기존 일정과 시간이 겹칩니다. 빈 시각을 선택해 주세요.');
    if (evaluate(item.entry,minute,d.date).kind === 'bad') return toast('선택한 날짜·시각에는 방문이 어려운 장소입니다. 다른 시각을 골라 주세요.');
    d.entries[minute]=item.entry; d.pending.splice(index,1); persistDraft(); renderPlan(); toast('보류 장소를 계획표에 넣었습니다.');
  }
  function importRoute() {
    const chosen = state.route.results[state.route.selected]; if (!chosen) return;
    openModal('<h2>시간계획표에 넣으시겠습니까?</h2><p>' + esc(chosen.title) + '</p><p>현재 편집 중인 계획은 새 코스로 바뀝니다. 저장이 필요하면 먼저 계획 화면에서 저장해 주세요.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="confirm-import">넣기</button></div>', () => {
      $('#confirm-import').onclick = () => { const entries = {}; chosen.rows.forEach((x) => { entries[x.minute] = {placeId:x.placeId,duration:x.duration,memo:x.mode==='bus' ? routeLegText(x) : x.kind === 'meal' ? (chosen.autoSchedule ? '자동 배치한 식사' : '선택한 식사시간') : x.kind === 'cafe' ? '선택한 카페 휴식' : ''}; }); if(chosen.endWalk.mode==='bus') { const last=entries[chosen.rows.at(-1).minute]; last.memo=[last.memo,'방문 후 도착지로 '+routeLegText(chosen.endWalk)].filter(Boolean).join(' · '); } state.draft = {id:null,title:chosen.title,date:state.route.date,start:chosen.autoSchedule ? hhmm(chosen.start) : state.route.start,end:chosen.autoSchedule ? hhmm(chosen.end) : state.route.end,origin:chosen.originId,destination:chosen.destinationId,currentOrigin:chosen.originId === 'current' ? chosen.originPoint : null,customOrigin:chosen.originId === 'custom' ? chosen.originPoint : null,customDestination:chosen.destinationId === 'custom' ? chosen.destinationPoint : null,theme:chosen.theme,mealTimes:(chosen.autoSchedule ? chosen.plannedMeals.map(hhmm) : chosen.rows.filter((row) => row.kind === 'meal').map((row) => hhmm(row.minute))),entries,pending:[]}; persistDraft(); closeModal(); nav('plan'); };
    });
  }
  function showJourney(minute) {
    const entry = state.draft.entries[minute]; if (!entry) return;
    const earlier = Object.entries(state.draft.entries).map(([m,e]) => [Number(m),e]).filter(([m]) => m < minute).sort((a,b) => b[0]-a[0])[0];
    const origin = earlier ? entryCoord(earlier[1]) : (state.draft.origin === 'current' ? (state.draft.currentOrigin || STATION) : state.draft.origin === 'custom' ? (state.draft.customOrigin || STATION) : (getPlace(state.draft.origin) || STATION));
    const target = entryCoord(entry);
    const now = new Date(); const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const direct = km(origin,target); const walk = direct == null ? null : Math.max(10,Math.ceil(direct*1.4/4*60/5)*5);
    const arrival = nowMinutes + (walk || 0);
    state.journey = {minute, origin, target, walk, direct, arrival, result:evaluate(entry,arrival,today()), mode:'walk', route:null, loading:false, error:''};
    nav('routeMap');
    loadJourneyRoute(state.journey);
  }
  async function loadJourneyRoute(j) {
    if (!coord(j.origin) || !coord(j.target)) return;
    j.loading = true; j.error = ''; j.route = null;
    if (state.view === 'routeMap' && state.journey === j) renderRouteMap();
    try {
      const routes = await getRoute(j.mode,j.origin,j.target);
      j.route = routes[0];
      j.arrival = new Date().getHours() * 60 + new Date().getMinutes() + j.route.minutes;
      j.result = evaluate(state.draft.entries[j.minute],j.arrival,today());
    } catch (error) { j.error = error.message; }
    j.loading = false;
    if (state.view === 'routeMap' && state.journey === j) renderRouteMap();
  }
  async function initJourneyMap(j) {
    if (KAKAO_KEY) {
      try {
        await loadKakao();
        if (!$('#journey-map')) return;
        const map = new kakao.maps.Map($('#journey-map'), {
          center: kakaoPoint((j.origin.lat+j.target.lat)/2,(j.origin.lon+j.target.lon)/2),
          level: kakaoLevel(14)
        });
        new kakao.maps.Marker({position:kakaoPoint(j.origin.lat,j.origin.lon),map});
        new kakao.maps.Marker({position:kakaoPoint(j.target.lat,j.target.lon),map});
        const routePoints = j.route?.points?.length > 1 ? j.route.points.map(([lon,lat]) => kakaoPoint(lat,lon)) : [kakaoPoint(j.origin.lat,j.origin.lon),kakaoPoint(j.target.lat,j.target.lon)];
        new kakao.maps.Polyline({map,path:routePoints,strokeWeight:4,strokeColor:j.route ? '#0c8f71' : '#718b94',strokeOpacity:.9,strokeStyle:j.route ? 'solid' : 'dash'});
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(kakaoPoint(j.origin.lat,j.origin.lon)); bounds.extend(kakaoPoint(j.target.lat,j.target.lon));
        map.setBounds(bounds);
        setTimeout(() => map.relayout(),50);
        return;
      } catch { toast('카카오맵 연결에 실패해 기존 지도를 표시합니다.'); }
    }
    const map = L.map('journey-map').setView([(j.origin.lat+j.target.lat)/2,(j.origin.lon+j.target.lon)/2],14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    L.circleMarker([j.origin.lat,j.origin.lon],{radius:8,color:'#155170'}).addTo(map).bindTooltip('출발');
    L.circleMarker([j.target.lat,j.target.lon],{radius:8,color:'#0c8f71'}).addTo(map).bindTooltip('도착');
    L.polyline(j.route?.points?.length > 1 ? j.route.points.map(([lon,lat]) => [lat,lon]) : [[j.origin.lat,j.origin.lon],[j.target.lat,j.target.lon]],{color:j.route ? '#0c8f71' : '#718b94',dashArray:j.route ? undefined : '5,9'}).addTo(map);
    map.fitBounds([[j.origin.lat,j.origin.lon],[j.target.lat,j.target.lon]],{padding:[40,40],maxZoom:15});
    setTimeout(() => map.invalidateSize(),50);
  }
  function renderRouteMap() {
    const j = state.journey; if (!j) { nav('plan'); return; }
    const dest = entryLabel(state.draft.entries[j.minute]);
    const canMap = navigator.onLine && window.L && coord(j.origin) && coord(j.target);
    const routeInfo = j.loading ? '<p>카카오 경로 조회 중…</p>' : j.route ? '<p><strong>' + (j.mode === 'walk' ? '도보' : '대중교통') + ' 약 ' + j.route.minutes + '분 · ' + (j.route.meters / 1000).toFixed(1) + 'km (카카오 경로)</strong>' + (j.mode === 'walk' ? ' · 예상 도착 ' + esc(hhmm(j.arrival)) : ' · 실제 버스 출발·도착 시각은 별도 확인') + '</p>' : '<p>실제 경로를 표시할 수 없습니다. 직선거리 기준 도보 약 ' + (j.walk ?? '?') + '분 추정입니다.</p><p class="small">' + esc(j.error) + '</p>';
    const steps = j.mode === 'transit' && j.route?.steps?.length ? '<div class="route-steps">' + j.route.steps.map((step) => '<div class="route-step"><strong>' + esc(step.vehicle || (step.type === 'WALKING' ? '도보' : step.type)) + '</strong><span>' + esc(step.guidance) + ' · 약 ' + esc(step.minutes) + '분</span></div>').join('') + '</div>' : '';
    $('#main').innerHTML = '<section class="page"><button class="back" id="journey-back">← 시간계획표</button><div class="page-head"><div><div class="eyebrow">지금 이동하기</div><h1>' + esc(dest) + '</h1><p>현재 시각을 기준으로 운영시간을 다시 확인했습니다.</p></div></div><div class="card"><div class="toolbar"><strong>' + esc(j.origin?.name || '이전 장소') + ' → ' + esc(dest) + '</strong>' + pillFor(j.result) + '</div><p>' + esc(j.result.detail) + '</p><div class="route-tabs"><button class="filter-chip ' + (j.mode === 'walk' ? 'active' : '') + '" data-journey-mode="walk">도보</button><button class="filter-chip ' + (j.mode === 'transit' ? 'active' : '') + '" data-journey-mode="transit">대중교통</button></div>' + routeInfo + steps + '<p class="small">대중교통 경로는 지정한 날짜·출발 시각의 실제 운행을 보증하지 않습니다. 버스 시각과 출입구는 출발 전 확인하세요.</p></div><div class="map-frame journey-map" style="margin-top:16px"><div id="journey-map">' + (canMap ? '' : '<div class="empty-state">지도는 온라인이고 두 장소의 위치가 있을 때 볼 수 있습니다.</div>') + '</div></div><div class="top-actions" style="margin-top:16px">' + (coord(j.origin) && coord(j.target) ? '<a id="open-walk" class="btn btn-primary" target="_blank" rel="noopener noreferrer">카카오맵에서 길찾기</a>' : '') + '<button class="btn btn-outline" id="journey-refresh">지금 다시 확인</button></div></section>';
    $('#main .card')?.insertAdjacentHTML('afterbegin', turtlePose(j.mode === 'walk' ? 'walk' : 'bus', j.mode === 'walk' ? '걷는 거북이' : '버스를 기다리는 거북이', 'turtle-journey'));
    $('#journey-back').onclick = () => nav('plan'); $('#journey-refresh').onclick = () => showJourney(j.minute);
    document.querySelectorAll('[data-journey-mode]').forEach((button) => button.onclick = () => { if (j.mode === button.dataset.journeyMode) return; j.mode = button.dataset.journeyMode; loadJourneyRoute(j); });
    if ($('#open-walk')) $('#open-walk').href = j.route?.url?.startsWith('https://map.kakao.com/') ? j.route.url : 'https://map.kakao.com/link/to/' + encodeURIComponent(dest) + ',' + j.target.lat + ',' + j.target.lon;
    if (canMap) initJourneyMap(j);
  }
  function renderSaved() {
    $('#main').innerHTML = '<section class="page"><button class="back" id="saved-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">이 기기에 보관</div><h1>저장한 계획</h1><p>인터넷이 없어도 장소와 메모를 글로 볼 수 있습니다.</p></div><div class="top-actions"><button class="btn btn-outline" id="export-plans">파일로 내보내기</button><button class="btn btn-outline" id="import-plans">파일 가져오기</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></div><div class="saved-list">' + (state.saved.length ? state.saved.map((p) => '<div class="card saved-card"><div><div class="eyebrow">' + esc(p.date || '') + '</div><h3>' + esc(p.title || '이름 없는 계획') + '</h3><p>' + Object.keys(p.entries || {}).length + '개 장소 · ' + esc(p.start || '') + ' 시작</p></div><div class="top-actions"><button class="btn btn-primary btn-sm" data-open-saved="' + esc(p.id) + '">열기</button><button class="btn btn-outline btn-sm" data-text-saved="' + esc(p.id) + '">글로 보기</button><button class="btn btn-danger btn-sm" data-delete-saved="' + esc(p.id) + '">삭제</button></div></div>').join('') : '<div class="card empty-state">저장한 계획이 없습니다. 계획표에서 저장해 주세요.</div>') + '</div><div class="notice" style="margin-top:16px">계획은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라질 수 있으니 파일로 내보내 두세요.</div></section>';
    if (!state.saved.length) $('.saved-list .empty-state')?.insertAdjacentHTML('afterbegin', turtlePose('rest', '잠시 쉬는 거북이', 'turtle-empty'));
    $('#saved-back').onclick = () => nav('home');
    document.querySelectorAll('[data-open-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.openSaved); if (p) { state.draft = JSON.parse(JSON.stringify(p)); persistDraft(); nav('plan'); } });
    document.querySelectorAll('[data-text-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.textSaved); if (!p) return; const lines = Object.entries(p.entries || {}).sort((a,b) => Number(a[0])-Number(b[0])).map(([m,e]) => '<div class="place-row"><strong>' + esc(hhmm(Number(m))) + ' · ' + esc(entryLabel(e)) + '</strong><small>' + esc(e.locationText || entryPlace(e)?.locationText || '') + (e.memo ? ' · ' + esc(e.memo) : '') + '</small></div>').join(''); openModal('<h2>' + esc(p.title) + '</h2><p>' + esc(p.date) + ' · ' + esc(p.start) + ' 시작</p><div class="saved-text">' + (lines || '<p>등록한 장소가 없습니다.</p>') + '</div><div class="modal-actions"><button class="btn btn-primary" data-close>닫기</button></div>'); });
    document.querySelectorAll('[data-delete-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.deleteSaved); openModal('<h2>저장한 계획을 삭제할까요?</h2><p>' + esc(p?.title || '') + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-danger" id="confirm-delete-saved">삭제</button></div>', () => { $('#confirm-delete-saved').onclick = () => { state.saved = state.saved.filter((x) => x.id !== b.dataset.deleteSaved); save(STORAGE_SAVED,state.saved); closeModal(); renderSaved(); }; }); });
    $('#export-plans').onclick = () => { const blob = new Blob([JSON.stringify({app:'hangeoreum-mokpo',version:1,plans:state.saved},null,2)],{type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mokpo-plans.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000); };
    $('#import-plans').onclick = () => $('#import-file').click();
    $('#import-file').onchange = async (e) => { try { const data = JSON.parse(await e.target.files[0].text()); if (data.app !== 'hangeoreum-mokpo' || !Array.isArray(data.plans)) throw Error(); const incoming = data.plans.filter((p) => p && typeof p.id === 'string' && p.entries && typeof p.entries === 'object'); if (!incoming.length) throw Error(); const ids = new Set(state.saved.map((p) => p.id)); state.saved = [...state.saved,...incoming.filter((p) => !ids.has(p.id))]; save(STORAGE_SAVED,state.saved); renderSaved(); toast('계획 파일을 가져왔습니다.'); } catch { toast('이 앱에서 내보낸 계획 파일인지 확인해 주세요.'); } };
  }
  document.addEventListener('error',event=>{const img=event.target;if(img.tagName!=='IMG'||!img.closest('.place-visual'))return;const visual=img.closest('.place-visual');img.remove();visual.dataset.kind='decoration';const caption=visual.querySelector('.media-caption');if(caption)caption.textContent='유형 이미지';},true);
  document.addEventListener('keydown',event=>{const current=event.target.closest?.('[role="tab"]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const group=current.closest('[role="tablist"]');const tabs=[...group.querySelectorAll('[role="tab"]')];const i=tabs.indexOf(current);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;event.preventDefault();const label=group.getAttribute('aria-label');tabs[next].click();document.querySelector('[role="tablist"][aria-label="'+CSS.escape(label)+'"] [aria-selected="true"]')?.focus();});
  document.querySelectorAll('[data-nav]').forEach(b=>{b.querySelector('span').innerHTML=uiIcon(b.dataset.nav==='region'?'map':b.dataset.nav);b.onclick=()=>nav(b.dataset.nav);});
  window.addEventListener('online', () => { statusConnection(); render(); });
  window.addEventListener('offline', () => { statusConnection(); render(); });
  fetch('./places.json?v=10', {cache:'no-store'}).then((r) => { if (!r.ok) throw Error(); return r.json(); }).then((data) => { state.places = data.places || []; render(); }).catch(() => { state.places = []; render(); toast('장소 자료를 불러오지 못했습니다. 저장한 계획은 볼 수 있습니다.'); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
