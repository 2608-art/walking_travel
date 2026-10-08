/* 한걸음 — 브라우저 안에서 동작하는 지역별 여행 계획 도구 */
(() => {
  'use strict';
  const REGIONS = Object.values(window.HangeoreumRegions || {});
  const searchParams = new URLSearchParams(location.search);
  const requestedRegion = searchParams.get('region');
  const requestedView = searchParams.get('view');
  const requestedTheme = searchParams.get('theme');
  const requestedTab = searchParams.get('tab');
  const activeRegion = REGIONS.find((region) => region.id === requestedRegion) || REGIONS[0];
  if (!activeRegion) throw Error('지역 설정을 불러오지 못했습니다.');
  const REGION_CENTER = activeRegion.center;
  const STATION = activeRegion.station;
  const CATEGORIES = [
    ['all', '전체', '🗺️'], ['food', '음식점', '🍽️'],
    ['cafe', '카페', '☕'], ['outdoors', '자연·산책', '🌿'],
    ['culture', '문화·전시', '🏛️'], ['experience', '체험·탑승', '🎟️'],
    ['market', '시장·간식', '🛍️'], ['books', '책방·소품', '📚']
  ];
  const CATEGORY_COLORS = { food: '#cc6d39', cafe: '#8262b4', outdoors: '#0c8f71', culture: '#4679b8', experience: '#c58b28', market: '#c45868', books: '#8a6a52' };
  const GYEONGJU_THEMES = [
    {id:'hwangridan',name:'황리단길·대릉원 골목',description:'황리단길에서 대릉원·첨성대 방향으로 걷는 골목 코스',icon:'market',art:'royal',count:47},
    {id:'wolseong',name:'첨성대·교촌·월정교',description:'동궁과 월지에서 서쪽으로 교촌·월정교까지 잇는 유적 산책',icon:'culture',art:'wolseong',count:36},
    {id:'donggung',name:'동궁과 월지·동쪽 유적',description:'국립경주박물관과 동궁·분황사·왕경숲을 잇는 동쪽 유적 코스',icon:'culture',art:'royal',count:12},
    {id:'bunhwang',name:'분황사·황룡사·왕경숲',description:'분황사와 왕경숲 주변의 짧은 북동쪽 산책',icon:'outdoors',art:'wolseong',count:7},
    {id:'market',name:'읍성·성동시장·중앙시장',description:'중앙시장에서 책방·읍성을 지나 성동시장으로 걷는 구도심 코스',icon:'market',art:'market',count:28},
    {id:'bulguksa',name:'불국사 마을',description:'불국사 경내와 박물관, 마을 문화공간을 걷는 코스',icon:'culture',art:'bulguksa',count:7}
  ];
  const routeEngine = window.HangeoreumRouteEngine;
  routeEngine.configureRegion(activeRegion.id);
  const soloTravel = window.HangeoreumSoloTravel;
  const savedWalkPaths = window.HangeoreumSavedWalkPaths;
  const savedBusLegs = window.HangeoreumSavedBusLegs;
  const regionStorage = activeRegion.id === 'mokpo' ? '' : '-' + activeRegion.id;
  const STORAGE_DRAFT = 'hangeoreum-draft-v1' + regionStorage;
  const STORAGE_SAVED = 'hangeoreum-saved-v1' + regionStorage;
  const STORAGE_THEME_ROUTE_DRAFTS = 'hangeoreum-theme-route-drafts-v1' + regionStorage;
  const STORAGE_GEOCODES = 'hangeoreum-' + activeRegion.id + '-address-pins-v1';
  const STORAGE_WALK_PATH_CHOICES = 'hangeoreum-walk-path-choices-v1' + regionStorage;
  const STORAGE_LODGING_PINS = 'hangeoreum-' + activeRegion.id + '-lodging-pins-v1';
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
  function storeThemeRouteDraft(review) {
    const route=state.route, saved=load(STORAGE_THEME_ROUTE_DRAFTS,[]);
    const draft={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),theme:route.theme,date:route.date,start:route.themeStart || '10:00',review:JSON.parse(JSON.stringify(review)),savedAt:new Date().toISOString()};
    const didSave=save(STORAGE_THEME_ROUTE_DRAFTS,[draft,...saved]);
    if(didSave) toast('검토용 테마 초안을 이 기기에 저장했습니다.');
    return didSave;
  }
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const hhmm = (m) => (m >= 1440 ? '다음 날 ' : '') + String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = (value) => { const [h, m] = String(value || '09:00').split(':').map(Number); return h * 60 + m; };
  const dateAt = (base, minute) => { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Math.floor(minute / 1440)); return d.toISOString().slice(0, 10); };
  const weekday = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
  const findByName = (name) => state.places.find((p) => p.name === name);
  const getPlace = (id) => state.places.find((p) => p.id === id) || state.lodgings.find((p) => p.id === id);
  const isLodgingPoint = (place) => typeof place?.id === 'string' && place.id.startsWith('lodging-');
  const routePlace = (id, route=state.route?.results?.[state.route.selected]) => route?.routingPlaces?.find((p) => p.id === id) || getPlace(id);
  const coord = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
  const pinPoint = (p) => coord(p) ? [p.lat, p.lon] :
    p && Number.isFinite(p.mapLat) && Number.isFinite(p.mapLon) ? [p.mapLat, p.mapLon] : null;
  const hasPin = (p) => !!pinPoint(p);
  const km = (a, b) => coord(a) && coord(b) ? routeEngine.distanceKm(a,b) : null;
  const routeCache = new Map();
  const walkPathChoices = new Map(Object.entries(load(STORAGE_WALK_PATH_CHOICES,{})));
  let themeCourseCatalogPromise;
  let themePlaceDraftPromise;
  function loadThemePlaceDrafts() {
    if (!themePlaceDraftPromise) themePlaceDraftPromise=fetch('./theme-place-drafts.json').then(async response=>{
      if(!response.ok) throw new Error('테마 장소 초안을 불러오지 못했습니다.');
      const draft=await response.json();
      if(draft.version!==1 || !Array.isArray(draft.themes)) throw new Error('테마 장소 초안 형식이 올바르지 않습니다.');
      return draft;
    });
    return themePlaceDraftPromise;
  }
  function loadThemeCourseCatalog() {
    if (!themeCourseCatalogPromise) themeCourseCatalogPromise=fetch('./theme-courses.json').then(async response=>{
      if(!response.ok) throw new Error('저장한 목포 코스를 불러오지 못했습니다.');
      const catalog=await response.json();
      if(catalog.version!==1 || !Array.isArray(catalog.courses)) throw new Error('저장한 코스 파일 형식이 올바르지 않습니다.');
      return catalog;
    }).catch(error=>{themeCourseCatalogPromise=null;throw error;});
    return themeCourseCatalogPromise;
  }
  let savedWalkPathsReady;
  let marketExteriorRouteReady;
  let gangneungReviewRoutesReady;
  let gangneungThemePlacePicksReady;
  let themeWeekdayRoutesReady;
  let themeRouteUpdatesReady;
  let holidayThemeRoutesReady;
  function loadHolidayThemeRoutes() {
    if (!holidayThemeRoutesReady) holidayThemeRoutesReady=fetch('./holiday-theme-routes-2026.json').then(async response=>{
      if(!response.ok) throw new Error('2026년 휴일 루트를 불러오지 못했습니다.');
      const data=await response.json();
      if(data.version!==1 || !Array.isArray(data.variants)) throw new Error('휴일 루트 형식이 올바르지 않습니다.');
      return data;
    }).catch(error=>{holidayThemeRoutesReady=null;throw error;});
    return holidayThemeRoutesReady;
  }
  function loadThemeWeekdayRoutes() {
    if (!themeWeekdayRoutesReady) themeWeekdayRoutesReady=fetch('./theme-weekday-routes.json').then(async response=>{
      if(!response.ok) throw new Error('요일별 저장 경로를 불러오지 못했습니다.');
      const data=await response.json();
      if(data.version!==1 || !Array.isArray(data.routes)) throw new Error('요일별 저장 경로 형식이 올바르지 않습니다.');
      return data.routes;
    }).catch(error=>{themeWeekdayRoutesReady=null;throw error;});
    return themeWeekdayRoutesReady;
  }
  function loadThemeRouteUpdates() {
    if (!themeRouteUpdatesReady) themeRouteUpdatesReady=fetch('./theme-route-updates.json').then(async response=>{
      if(!response.ok) throw new Error('변경된 테마 경로를 불러오지 못했습니다.');
      const data=await response.json();
      if(data.version!==1 || !Array.isArray(data.overrides)) throw new Error('변경된 테마 경로 형식이 올바르지 않습니다.');
      return data.overrides;
    }).catch(error=>{themeRouteUpdatesReady=null;throw error;});
    return themeRouteUpdatesReady;
  }
  async function loadGangneungReviewRoutes() {
    if (!gangneungReviewRoutesReady) gangneungReviewRoutesReady=fetch('./gangneung-theme-review-routes.json').then(async response=>{
      if(!response.ok) throw Error('강릉 테마 초안을 불러오지 못했습니다.');
      const data=await response.json();
      const expectedStops={food:11,sea:9,shops:10,history:9,cafe:10};
      if(data.version!==3 || data.status!=='review-only' || data.routes?.length!==5 || data.routes.some(route=>route.placeIds?.length!==expectedStops[route.themeId])) throw Error('강릉 테마 초안 자료가 올바르지 않습니다.');
      return data.routes;
    }).catch(error=>{gangneungReviewRoutesReady=null;throw error;});
    return gangneungReviewRoutesReady;
  }
  async function loadGangneungThemePlacePicks() {
    if (!gangneungThemePlacePicksReady) gangneungThemePlacePicksReady=fetch('./gangneung-theme-place-picks.json').then(async response=>{
      if(!response.ok) throw Error('강릉 테마 루트 초안을 불러오지 못했습니다.');
      const data=await response.json();
      if(data.version!==1 || data.status!=='draft-place-picks-only' || data.themes?.length!==5 ||
          data.themes.some(theme=>!Array.isArray(theme.placeIds) || new Set(theme.placeIds).size!==theme.placeIds.length ||
            (theme.id==='cafe' ? theme.placeIds.length!==30 : (theme.id==='shops'?theme.placeIds.length>30:theme.placeIds.length>=30) || theme.pinScope?.radiusKm!==2 || !theme.pinScope.centers?.length)))
        throw Error('강릉 테마 루트 초안 자료가 올바르지 않습니다.');
      const pinDistanceKm=(point,center)=>Math.hypot((point[0]-center[0])*111,(point[1]-center[1])*88);
      for(const theme of data.themes) for(const id of theme.placeIds) {
        const place=getPlace(id),point=place&&pinPoint(place);
        if(!place || !point || theme.pinScope && !theme.pinScope.centers.some(center=>pinDistanceKm(point,center)<=theme.pinScope.radiusKm))
          throw Error('지도 위치를 확인할 수 없는 장소가 초안에 있습니다.');
      }
      return data;
    }).catch(error=>{gangneungThemePlacePicksReady=null;throw error;});
    return gangneungThemePlacePicksReady;
  }
  async function loadMarketExteriorRoute() {
    if (!marketExteriorRouteReady) marketExteriorRouteReady=fetch('./gangneung-market-exterior-route.json').then(async response=>{
      if (!response.ok) throw Error('저장된 시장 코스를 불러오지 못했습니다.');
      const data=await response.json();
      if (data.version!==1 || data.id!=='gangneung-market-exterior-2026-10-07' ||
          data.stops?.map(p=>p.id).join(',')!=='g27,g8,g26,g1,g7' ||
          data.legs?.length!==4 || data.geometry?.coordinates?.length<15 ||
          data.geometry?.stopPointIndices?.length!==5) throw Error('저장된 시장 코스 자료가 올바르지 않습니다.');
      return data;
    }).catch(error=>{marketExteriorRouteReady=null;throw error;});
    return marketExteriorRouteReady;
  }
  function loadSavedWalkPaths() {
    if (!savedWalkPathsReady) savedWalkPathsReady=fetch('./walk-paths.json').then(async response=>{
      if (!response.ok) throw new Error('저장 도보 구간을 불러오지 못했습니다.');
      savedWalkPaths.setCatalog(await response.json());
    }).catch(()=>{});
    return savedWalkPathsReady;
  }
  function savedWalkOptions(a,b) { return savedWalkPaths?.options(a,b) || []; }
  let savedBusLegsReady;
  async function loadSavedBusLegs() {
    if (!savedBusLegs) return;
    if (!savedBusLegsReady) savedBusLegsReady=fetch('./bus-legs.json').then(async response=>{
      if (!response.ok) throw new Error('저장 버스 자료를 불러오지 못했습니다.');
      savedBusLegs.setCatalog(await response.json());
    }).catch(()=>{});
    return savedBusLegsReady;
  }
  function savedBusRoute(leg) {
    if (!leg?.accessWalk || !leg?.egressWalk) return null;
    const sections=[leg.accessWalk.points,leg.busPoints,leg.egressWalk.points];
    const points=sections.every(section=>Array.isArray(section) && section.length>1)
      ? sections.flatMap((section,index)=>index ? section.slice(1) : section) : [];
    const walkMeters=leg.accessWalk.meters+leg.egressWalk.meters;
    const walkMinutes=leg.accessWalk.minutes+leg.egressWalk.minutes;
    return {
      minutes:walkMinutes+leg.averageBusRideMinutes,
      meters:walkMeters,
      walkMeters,walkMinutes,busAccessUnknown:false,
      busRideMinutes:leg.averageBusRideMinutes,
      busRideSeconds:leg.averageBusRideMinutes*60,
      points,actual:true,estimated:true,savedBusId:leg.id,
      busStops:{boarding:leg.boardingStop,alighting:leg.alightingStop},
      busPoints:leg.busPoints || [],timetable:leg.timetable,serviceNotice:leg.serviceNotice,
      steps:[
        {type:'WALKING',guidance:leg.boardingStop.name+' 정류장까지 걷기',minutes:leg.accessWalk.minutes,meters:leg.accessWalk.meters},
        {type:'BUS',guidance:leg.boardingStop.name+' 승차 → '+leg.alightingStop.name+' 하차',minutes:leg.averageBusRideMinutes,vehicle:leg.routeNumber,stops:[leg.boardingStop.name,leg.alightingStop.name]},
        {type:'WALKING',guidance:(leg.to.name || '목적지')+'까지 걷기',minutes:leg.egressWalk.minutes,meters:leg.egressWalk.meters},
      ],
    };
  }
  function sameSavedBusRoute(route, leg) {
    if(route?.transfers>0 || (route?.steps || []).some(step=>!['WALK','WALKING','BUS'].includes(step.type))) return false;
    const buses=(route?.steps || []).filter(step=>step.type==='BUS');
    return buses.length===1 && buses[0].vehicle===leg.routeNumber &&
      buses[0].stops?.[0]===leg.boardingStop.name &&
      buses[0].stops?.at(-1)===leg.alightingStop.name;
  }
  function withSavedBusDetails(route, leg) {
    const stored=savedBusRoute(leg);
    if(!stored || !sameSavedBusRoute(route,leg)) return route;
    const observed=route.currentBusRideSeconds || route.busRideSeconds;
    const baseline=leg.averageBusRideMinutes*60;
    const difference=observed-baseline;
    const longer=Number.isFinite(observed) && difference>=300 && difference>=baseline*.2;
    const rideSeconds=longer ? observed : baseline;
    return {...route,...stored,minutes:stored.walkMinutes+Math.round(rideSeconds/60),
      busRideMinutes:Math.round(rideSeconds/60),busRideSeconds:rideSeconds,
      steps:stored.steps.map(step=>step.type==='BUS' ? {...step,minutes:Math.round(rideSeconds/60)} : step),
      busCacheStatus:longer?'longer':'reused',baselineBusRideSeconds:baseline,
      currentBusRideSeconds:observed,rideDifferenceSeconds:difference,
      baselineSampleCount:0,estimated:!longer};
  }
  const mealChoicesCache = new WeakMap();
  function registeredRouteId(point) {
    const known = point?.id === STATION.id ? STATION : state.places.find((p)=>p.id===point?.id);
    return known && known.lat === point.lat && known.lon === point.lon ? known.id : '';
  }
  async function getRoute(mode, origin, target) {
    if (!coord(origin) || !coord(target)) throw new Error('장소 좌표가 없습니다.');
    if (mode==='walk' && savedWalkPaths) {
      await loadSavedWalkPaths();
      const key=savedWalkPaths.choiceKey(origin,target);
      const saved=savedWalkPaths.select(origin,target,walkPathChoices.get(key));
      if (saved) return [saved,...savedWalkOptions(origin,target).filter(v=>v.id!==saved.savedPathId).map(v=>({meters:v.meters,minutes:v.minutes,points:v.points,savedPathId:v.id,savedPathLabel:v.label,source:v.source}))];
    }
    if (mode==='transit') await loadSavedBusLegs();
    const selectedBus=mode==='transit' ? savedBusLegs?.select(origin,target) : null;
    const savedBus=selectedBus ? savedBusRoute(selectedBus) : null;
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
      return mode==='transit' && selectedBus
        ? data.routes.map(route=>withSavedBusDetails(route,selectedBus)) : data.routes;
      }).catch((error) => {
        if (routeCache.get(cacheKey) === entry) routeCache.delete(cacheKey);
        if (mode==='transit' && savedBus) return [{...savedBus,currentUnavailable:true}];
        throw error;
      });
      routeCache.set(cacheKey,entry);
    }
    return routeCache.get(cacheKey).promise;
  }
  let toastTimer;
  function toast(message) { const el = $('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3600); }
  const storedPlans = load(STORAGE_SAVED, []);
  const state = {
    places: [], lodgings: [], gyeongjuRoutes:null, view: requestedView === 'routes' ? 'routes' : requestedView === 'destination' ? 'destination' : 'home', region: activeRegion.id, destinationTab: requestedTab === 'themes' && activeRegion.id === 'gyeongju' ? 'themeDraft' : 'routes', themeCandidateMap:null, categories: new Set(), selected: null, mapDisplay:'map', homeMood:'all',
    mapCenter: REGION_CENTER, mapZoom: 13, map: null, mapProvider: null, mapLine: null, resultMap:null, planMap:null, mapFocusedPlace:null, mapMarkers:new Map(),
    draft: load(STORAGE_DRAFT, null) || { id: null, title: '나의 ' + activeRegion.name + ' 하루', date: today(), start: '09:00', end: '24:00', origin: null, theme:'balanced', mealTimes:[], solo:false, entries: {}, pending:[] },
    saved: load(STORAGE_SAVED, []),
    route: { date: today(), start: '10:00', themeStart:'10:00', end: '24:00', origin: STATION.id, destination:STATION.id, mode:requestedView === 'routes' ? 'theme' : 'custom', theme:requestedTheme || 'first', solo:false, must: '', mustOptional:false, focus:'through', results: [], baseResults:[], selected: -1 },
    pinMode: false, pinSelection: null, searchResults: []
  };
  if (new URLSearchParams(window.location.search).get('show') === 'themes') {
    state.view = 'routes';
    state.route.mode = 'theme';
  }
  if (state.saved.length !== storedPlans.length) save(STORAGE_SAVED, state.saved);
  const geocodeCache = load(STORAGE_GEOCODES, {});
  const lodgingPins = load(STORAGE_LODGING_PINS, {});
  let mapQuickForm = null;
  let mapQuickOutsideHandler = null;
  let mapQuickResizeHandler = null;
  let mapQuickTransparency = 10;
  let mapQuickPosition = null;
  function persistDraft() { save(STORAGE_DRAFT, state.draft); }
  function statusConnection() { const el = $('#connection'); if (!el) return; el.textContent = navigator.onLine ? '온라인' : '오프라인 · 저장한 글만'; el.classList.toggle('offline', !navigator.onLine); }
  function nav(view) { closeMapQuickAdd(); if (state.view === 'region' && view !== 'region') { if(state.mapProvider === 'leaflet') state.map?.remove(); state.map=null; } if (state.view === 'routes' && view !== 'routes') { state.resultMap?.remove(); state.resultMap=null; } if (state.view === 'plan' && view !== 'plan') { state.planMap?.remove(); state.planMap=null; } if (view !== 'destination' && state.themeCandidateMap) { state.themeCandidateMap.remove(); state.themeCandidateMap=null; } state.view = view; render(); window.scrollTo(0, 0); }
  function render() {
    statusConnection();
    document.body.classList.toggle('destination-home', state.view === 'home');
    document.body.dataset.view = state.view;
    document.querySelectorAll('[data-nav]').forEach((b) => { const active = b.dataset.nav === state.view || (b.dataset.nav === 'home' && state.view === 'destination') || (b.dataset.nav === 'region' && ['routes','routeGuide','weekdayGuide','place','routeMap'].includes(state.view)); b.classList.toggle('active', active); b.setAttribute('aria-current', active ? 'page' : 'false'); });
    if (state.view === 'home') renderHome();
    else if (state.view === 'destination') renderDestination();
    else if (state.view === 'place') renderPlacePage();
    else if (state.view === 'region') renderRegionMap();
    else if (state.view === 'plan') renderPlan();
    else if (state.view === 'routes') renderRoutes();
    else if (state.view === 'themeExplanation') renderThemeCourseExplanation();
    else if (state.view === 'routeGuide') renderGyeongjuRouteGuide();
    else if (state.view === 'weekdayGuide') renderWeekdayRouteGuide();
    else if (state.view === 'saved') renderSaved();
    else if (state.view === 'routeMap') renderRouteMap();
  }
  function categoryName(cat) { return CATEGORIES.find((x) => x[0] === cat)?.[1] || '장소'; }
  function categoryIcon(cat) { return CATEGORIES.find((x) => x[0] === cat)?.[2] || '📍'; }
  function placeTimeText(p) {
    if (p?.unrestrictedAccess) return '야외 산책 구간 · 정해진 출입시간 없음' + (p.accessConstraint === 'publicFerry' ? ' · 실제 방문은 여객선 운항·귀항편에 제한됨' : ' (기상·안전 통제는 별도 확인)');
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
      ['브레이크·마지막 주문/입장', p.deadlineText || (p.hours?.lastOrder ? '마지막 주문 ' + p.hours.lastOrder : p.hours?.lastEntry ? '마지막 입장 ' + p.hours.lastEntry : '확인 필요')],
      ['휴무·변동', p.closureText || '확인 필요']
    ];
    return (week ? '<div class="schedule-week">' + week + (p.mapWeekSource ? '<a class="small" href="' + esc(p.mapWeekSource) + '" target="_blank" rel="noopener noreferrer">카카오맵 장소 시간표</a>' : '') + '</div>' : '') +
      (diningWeek ? '<div class="schedule-week">' + diningWeek + (p.diningWeekSource ? '<a class="small" href="' + esc(p.diningWeekSource) + '" target="_blank" rel="noopener noreferrer">다이닝코드 장소 시간표</a>' : '') + '</div>' : '') +
      '<div class="schedule-facts">' + rows.map(([label, value]) => '<p><strong>' + esc(label) + '</strong><br>' + esc(value) + '</p>').join('') + '</div>' +
      (p.scheduleSource ? '<a class="small" href="' + esc(p.scheduleSource) + '" target="_blank" rel="noopener noreferrer">운영정보 출처</a>' : '');
  }
  function priceHtml(p) {
    const info = p.priceInfo;
    if (!info) return '';
    const title = p.category === 'food' || p.category === 'cafe' ? '메뉴와 가격' : '입장·이용 요금';
    return `<section class="place-price" aria-label="${title}"><div class="place-price-heading"><h2>${title}</h2><span>조회 ${esc(info.checked)}</span></div><div class="place-price-row"><strong>${esc(info.label)}</strong><b>${esc(info.price)}</b></div>${info.note?`<p>${esc(info.note)}</p>`:''}<a href="${esc(info.source)}" target="_blank" rel="noopener noreferrer">방문 비용 출처 확인 ↗</a><p class="place-price-caveat">조회 시점 정보입니다. 현장 비용과 이용 조건은 방문 전에 확인해 주세요.</p></section>`;
  }
  function soloHtml(p) {
    if (p.category !== 'food' && p.category !== 'cafe') return '';
    if (p.soloResearch) return soloResearchHtml(p);
    const verdict = {
      not_possible: '조사 기준 혼자 식사 불가 · 2인 이상 메뉴가 있고 별도 1인 메뉴는 확인하지 못함',
      takeout_only: '매장 식사 불가 정황 · 최근 후기는 포장 전문점으로 설명',
      specific_menu: '확인된 1인 메뉴로 혼자 이용 가능 · 다른 메뉴는 아래 주문 조건 확인',
      single_item_unverified: '한 그릇·한 접시 단품 메뉴 확인 · 1인 주문 허용 여부는 미확인',
      review_only: '혼자 이용한 후기 정황은 있으나 1인 메뉴·현행 주문 조건은 미확인',
      unknown: '혼자 이용·주문 가능 여부를 공개 자료로 확인하지 못함'
    }[p.soloVerdict] || '혼자 이용·주문 가능 여부를 공개 자료로 확인하지 못함';
    const review = p.soloVisit === 'review_tag' ? (p.category === 'cafe' ? '혼카페 후기 태그 있음' : '혼밥 후기 태그 있음') : p.soloVisit === 'solo_visit_review' ? '혼자 방문한 후기 있음' : '';
    const seat = {bar:'바 좌석',single:'1인석',window:'창가를 향한 혼자 앉는 자리',partition:'칸막이 좌석',takeout_only:'매장 식사 좌석 없음(포장 전문 후기)'}[p.soloSeat];
    return '<div class="schedule-facts"><h2>혼자 이용하기</h2><p><strong>혼자 방문·주문</strong><br>' + esc(verdict) + (review ? '<br>' + esc(review) : '') + '</p>' +
      '<p><strong>확인된 1인·단품 메뉴</strong><br>' + esc(p.soloMenu || '확인하지 못함') + '</p>' +
      '<p><strong>혼자 앉을 자리</strong><br>' + esc(seat ? seat + (p.soloSeat === 'takeout_only' ? '' : ' 확인') : '1인석·바·창가 방향·칸막이 좌석 확인 못함. 일반 테이블 이용 불가라는 뜻은 아니에요.') + '</p>' +
      (p.minimumOrder ? '<p><strong>대표·특정 메뉴의 인원 조건</strong><br>' + esc(p.minimumOrder) + '</p>' : '<p><strong>대표·특정 메뉴의 인원 조건</strong><br>공개 자료에서 별도 조건을 확인하지 못함</p>') +
      (p.soloNote ? '<p>' + esc(p.soloNote) + '</p>' : '') +
      (p.soloSource ? '<a class="small" href="' + esc(p.soloSource) + '" target="_blank" rel="noopener noreferrer">혼자 이용 조사 출처</a>' : '') +
      (p.soloMenuSource && p.soloMenuSource !== p.soloSource ? ' · <a class="small" href="' + esc(p.soloMenuSource) + '" target="_blank" rel="noopener noreferrer">1인·단품 메뉴 근거</a>' : '') +
      (p.minimumOrderSource && p.minimumOrderSource !== p.soloSource ? ' · <a class="small" href="' + esc(p.minimumOrderSource) + '" target="_blank" rel="noopener noreferrer">최소 주문 근거</a>' : '') +
      '<p class="small">' + esc(p.soloChecked || activeRegion.dataChecked) + ' 공개 자료 조사 · 현장 좌석 배정과 메뉴 조건은 방문 전 재확인</p></div>';
  }
  function placeVisual(p, compact = false) {
    const media = window.HANGEORUM_PLACE_MEDIA?.[p.id] || window.HANGEORUM_PLACE_EXAMPLE_MEDIA?.[p.id];
    const safe = media?.src && /^(\.\/assets\/|https:\/\/)/.test(media.src);
    const kind = safe ? (media.kind === 'example' ? 'example' : media.kind === 'photo' ? 'photo' : 'illustration') : 'decoration';
    const label = media?.kind === 'example' ? '예시 사진 · 실제 장소 아님' : media?.kind === 'photo' ? '사진' : '일러스트';
    return '<div class="place-visual visual-' + esc(p.category) + ' ' + (compact ? 'is-thumb' : 'is-cover') + '" data-kind="' + kind + '">' +
      '<span class="place-visual-symbol" aria-hidden="true">' + uiIcon(p.category) + '</span>' +
      (safe ? '<img src="' + esc(media.src) + '" alt="' + esc(media.alt || p.name) + '" loading="lazy">' : '') +
      (!compact ? '<span class="media-caption">' + (safe ? label + (media.credit ? ' · ' + esc(media.credit) : '') : esc(categoryName(p.category)) + ' · 유형 이미지') + '</span>' : '') + '</div>';
  }
  const HOME_MOODS=[['all','전체'],['sea','바다'],['history','역사·골목'],['shops','책방·소품'],['cafe','여유']];
  const THEME_ICONS={first:'first',history:'culture',sea:'sea',shops:'books',food:'food',cafe:'cafe',oldtown:'culture',seosandong:'outdoors',gatbawi:'culture',peace:'sea',samhakdo:'experience',cafeWalk:'cafe'};
  function renderHome() {
    const available=REGIONS;
    $('#main').innerHTML=`<section class="page destination-page">
      <div class="diary-hero"><div class="hero-copy"><div class="eyebrow">나의 작은 여행 다이어리</div><h1>오늘,<br>어디로 떠날까요?</h1><p>뚜벅이 여행에 딱 맞는<br>나만의 하루를 찾아보세요.</p></div>${turtlePose('map','지도를 보며 여행을 준비하는 거북이','hero-turtle')}<span class="hero-note" aria-hidden="true">한걸음, 가볍게 떠나요</span></div>
      <form class="destination-search" id="destination-search">${uiIcon('search')}<input id="destination-query" aria-label="여행지 또는 장소 검색" placeholder="여행지, 장소를 검색해 보세요" autocomplete="off"><button type="submit" aria-label="검색">${uiIcon('arrow')}</button></form>
      <div class="home-moods" aria-label="여행 취향">${HOME_MOODS.map(([id,label])=>`<button type="button" data-home-mood="${id}" class="${state.homeMood===id?'active':''}" aria-pressed="${state.homeMood===id}">${label}</button>`).join('')}</div>
      <div class="diary-section-head"><div><span class="eyebrow">한걸음의 여행지</span><h2>마음이 머무는 곳</h2></div><span class="small">${available.map(x=>esc(x.name)).join(' · ')}</span></div>
      <div class="home-discover-layout"><div class="destination-grid ${available.length===1?'is-single':''}">${available.map(x=>`<button type="button" class="destination-tile" data-region="${esc(x.id)}" aria-label="${esc(x.name)} 여행지 소개 보기${x.ready?'':' (미리보기)'}"><div class="destination-picture"><img src="${esc(x.image)}" alt="${esc(x.imageAlt)}" loading="eager"><span class="picture-label">${esc(x.province)}</span><span class="picture-stamp" aria-hidden="true">${uiIcon(state.homeMood==='all'?'sea':THEME_ICONS[state.homeMood])}</span></div><span class="destination-copy"><strong>${esc(x.name)}</strong><small>${esc(x.teaser)}</small>${x.ready?'':'<span class="pill warn">미리보기 · 경로 검증 중</span>'}<span class="destination-tags">${x.tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</span><span class="destination-meta">${uiIcon('map')} ${x.themeCount}가지 테마로 만나는 ${esc(x.name)} <span aria-hidden="true">${uiIcon('arrow')}</span></span></span></button>`).join('')}</div>
      </div>
      <p class="home-footnote">한 도시씩, 차곡차곡. 걷기 좋은 여행지를 함께 채워갈게요.<span class="photo-attribution">앱에 사용한 <a href="./assets/photos/README.md" target="_blank" rel="noopener">여행지 사진 출처와 이용 조건</a></span></p></section>`;
    document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{const region=REGIONS.find(x=>x.id===b.dataset.region);if(region)showRegionIntro(region);});
    document.querySelectorAll('[data-home-mood]').forEach(b=>b.onclick=()=>{state.homeMood=b.dataset.homeMood;renderHome();});
    $('#destination-search').onsubmit=e=>{e.preventDefault();const q=$('#destination-query').value.trim();if(!q)return;const region=available.find(x=>x.name.includes(q)||x.teaser.includes(q));if(region){showRegionIntro(region);return;}const p=state.places.find(x=>x.name.includes(q));if(p){state.selected=p.id;state.placeTab='intro';state.placeBack='home';nav('place');}else toast('현재 선택한 지역에서 일치하는 장소를 찾지 못했어요.');};
  }
  function evidenceLink(url, label='근거 확인 ↗') {
    return /^https?:\/\//.test(url || '') ? '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>' : '';
  }
  function evidenceDates(x) { return '게시 '+(x?.postedAt || '시점 미확인')+' · 방문 '+(x?.visitedAt || '시점 미확인')+' · 확인 '+(x?.checkedAt || '시점 미확인'); }
  function soloResearchHtml(p) {
    const r=p.soloResearch, seat=r.seat || {}, fact=(label,x) => '<p><strong>'+label+'</strong><br>'+esc(x?.text || '공개 자료에서 확인하지 못함')+(x?.source?' '+evidenceLink(x.source):'')+(x?.checkedAt?'<small class="evidence-date">확인 '+esc(x.checkedAt)+'</small>':'')+'</p>';
    const reviews=(r.reviews || []).filter(x=>x.url);
    return '<section class="schedule-facts solo-research"><h2>혼자 이용하기</h2><p><strong>근거 수준</strong><br>'+esc(soloTravel.evidenceLevel(p))+'</p>'+fact('확인된 메뉴',r.menu)+(p.category==='cafe'?fact('식사 메뉴 확인 · 커피 방문과 별도',r.mealMenu):'')+fact('최소 주문 조건 · 적용 메뉴',r.minimumOrder)+fact('포장 이용',r.takeout)+'<p><strong>1인석 확인</strong><br>'+esc(seat.status==='confirmed' ? ({bar:'바 좌석',single:'1인석',window:'창가 방향 좌석',partition:'칸막이 좌석'}[seat.type] || seat.type || '좌석')+' 확인 · '+(seat.text || '') : '1인석 근거 미확인. 좌석이 없거나 혼자 앉을 수 없다는 뜻은 아니에요.')+(seat.source?' '+evidenceLink(seat.source):'')+'<small class="evidence-date">'+esc(evidenceDates(seat))+'</small></p>'+(reviews.length?'<h3>방문 후기 근거</h3>'+reviews.map(x=>'<p><strong>'+esc({solo_dining:'혼자 식사한 직접 후기',solo_visit:'혼자 방문한 직접 후기',tag:'후기 태그 · 직접 방문 근거 아님',observation:'관찰·추천 · 직접 혼자 이용 근거 아님'}[x.kind] || '참고 후기')+'</strong><br>'+esc(x.summary || '')+'<br>'+esc(x.author || '작성자 미확인')+' · '+evidenceLink(x.url)+'<small class="evidence-date">'+esc(evidenceDates(x))+'</small></p>').join(''):'<p>공개 자료에서 직접 혼자 방문·식사한 후기를 확인하지 못했어요.</p>')+(r.note?'<p>'+esc(r.note)+'</p>':'')+'<p class="small">혼자 식사한 후기만으로 모든 메뉴의 1인 주문이나 현재 최소 주문 조건을 확인한 것으로 보지 않아요. 좌석 배정과 주문 조건은 방문 전 확인해 주세요.</p></section>';
  }
  function reservationCardHtml(p) {
    const items=window.HangeoreumPlaceBooking.items(p);
    return items.length ? '<span class="reservation-card">'+items.map(x=>'<span><b>예약 상태: '+esc(window.HangeoreumPlaceBooking.label(x.status))+'</b><span>적용 범위: '+esc(x.scope)+'</span></span>').join('')+'</span>' : '';
  }
  function reservationHtml(p) {
    const items=window.HangeoreumPlaceBooking.items(p);
    if (!items.length) return '';
    return '<section class="place-price reservation-details"><h2>예약 안내</h2>'+items.map(x=>'<div class="reservation-item"><p><strong>예약 상태</strong><br>'+esc(window.HangeoreumPlaceBooking.label(x.status))+'</p><p><strong>적용 범위</strong><br>'+esc(x.scope)+'</p>'+(x.generalVisit?'<p>'+esc(x.generalVisit)+'</p>':'')+'<p><strong>예약 방법</strong><br>'+esc(x.method || '방법 미확인')+' '+evidenceLink(x.url,'예약·안내 페이지 ↗')+'</p><p><strong>회차·마감</strong><br>'+esc(x.sessions || '회차 미확인')+'<br>'+esc(x.deadline || '예약 마감 미확인')+'</p>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'<p class="small">'+esc(evidenceDates(x))+' '+(x.sources || []).map(u=>evidenceLink(u)).join(' · ')+'</p></div>').join('')+'<p class="small">계획표에 넣어도 예약은 완료되지 않습니다. 실제 예약과 이용 가능 여부는 안내 페이지에서 확인해 주세요.</p></section>';
  }
  function confirmPlaceReservation(places, onContinue) {
    const warnings=window.HangeoreumPlaceBooking.warnings(places);
    if (!warnings.length) return onContinue();
    if (document.querySelector('.reservation-warning')) return;
    const previousFocus=document.activeElement, previousModal=$('#modal-root .modal-backdrop'), app=$('#app'), appInert=app.inert;
    const previousInert=previousModal?.inert;
    if(previousModal) previousModal.inert=true;
    app.inert=true;
    const overlay=document.createElement('div'); overlay.className='modal-backdrop reservation-warning';
    overlay.innerHTML='<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="reservation-warning-title" aria-describedby="reservation-warning-summary"><h2 id="reservation-warning-title">예약 안내를 확인해 주세요</h2><p id="reservation-warning-summary">계획표에 넣어도 예약은 완료되지 않습니다.</p>'+warnings.map(x=>'<div class="reservation-item"><h3>'+esc(x.name)+'</h3><p><strong>'+esc(x.message)+'</strong> · '+esc(window.HangeoreumPlaceBooking.label(x.status))+'</p><p>적용 범위: '+esc(x.scope)+'</p>'+(x.generalVisit?'<p>'+esc(x.generalVisit)+'</p>':'')+(x.note?'<p>'+esc(x.note)+'</p>':'')+'<p>'+esc(x.method || '예약 방법 미확인')+' '+evidenceLink(x.url,'안내 확인 ↗')+'</p></div>').join('')+'<div class="modal-actions"><button type="button" class="btn btn-outline" data-reservation-cancel>취소</button><button type="button" class="btn btn-primary" data-reservation-continue>안내 확인 후 넣기</button></div></div>';
    const dismiss=()=>{overlay.remove(); app.inert=appInert; if(previousModal) previousModal.inert=previousInert; if(previousFocus?.isConnected) previousFocus.focus();};
    overlay.querySelector('[data-reservation-cancel]').onclick=dismiss;
    overlay.querySelector('[data-reservation-continue]').onclick=()=>{dismiss();onContinue();};
    overlay.onclick=e=>{if(e.target===overlay)dismiss();};
    overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();dismiss();} if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button,a[href]')]; const first=controls[0],last=controls.at(-1);if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}}};
    $('#modal-root').appendChild(overlay);overlay.querySelector('[data-reservation-cancel]').focus();
  }
  function showRegionIntro(region) { if(region.id!==activeRegion.id){location.href='./?region='+encodeURIComponent(region.id)+'&view=destination';return;} state.region=region.id; state.destinationTab='routes'; nav('destination'); }
  function destinationPlaceCard(p) { return '<button class="discovery-card" data-open-place="' + esc(p.id) + '">' + placeVisual(p) + '<strong>' + esc(p.name) + '</strong><small>' + esc(categoryName(p.category)) + '</small>' + reservationCardHtml(p) + '</button>'; }
  function renderDestination() {
    if(state.themeCandidateMap){state.themeCandidateMap.remove();state.themeCandidateMap=null;}
    const region=REGIONS.find(x=>x.id===state.region)||REGIONS[0];
    const tab=state.destinationTab||'routes';
    const themes=(region.id==='gyeongju'?GYEONGJU_THEMES:routeEngine.THEMES.filter(x=>x.id!=='balanced')).sort((a,b)=>(b.id===state.homeMood?1:0)-(a.id===state.homeMood?1:0));
    const featured=region.featuredIds.map(getPlace).filter(Boolean);
    $('#main').innerHTML=`<section class="destination-overview">
      <div class="city-cover"><img src="${esc(region.image)}" alt="${esc(region.imageAlt)}"><button class="round-control city-back" id="city-back" aria-label="여행지 선택으로">‹</button><span class="cover-label">${esc(region.province)} · ${esc(region.imageLabel)}</span></div>
      <div class="city-body"><div class="city-intro"><div><span class="eyebrow">${esc(region.introTitle)}</span><h1>${esc(region.name)}</h1><p>${esc(region.teaser)}<br>${esc(region.introLine)}</p><span class="pill">⌖ ${esc(region.province)} ${esc(region.name)}시</span></div><span class="city-turtle-note" aria-hidden="true">${esc(region.name)} 같이<br>걸을까요?</span>${turtlePose('discover','새 여행지를 발견한 거북이')}</div>${region.ready?'':'<p class="notice warn">미리보기 지역입니다. 장소 자료와 테마 코스를 검증 중이며, 실제 도보 경로와 운영 정보는 방문 전 확인해 주세요.</p>'}
      <div class="city-tabs" role="tablist" aria-label="${esc(region.name)} 여행 정보"><button role="tab" aria-selected="${tab==='routes'}" data-city-tab="routes">추천 루트</button><button role="tab" aria-selected="${tab==='places'}" data-city-tab="places">여행지</button>${region.id==='gyeongju'?`<button role="tab" aria-selected="${tab==='themeDraft'}" data-city-tab="themeDraft">테마 후보 지도</button>`:''}<button role="tab" aria-selected="${tab==='info'}" data-city-tab="info">여행 정보</button></div>
      <div class="city-content">${tab==='routes'?`<div class="diary-section-head"><h2>${region.id==='gyeongju'?'어떤 권역을 둘러볼까요?':region.id==='gangneung'?'어떤 테마 루트를 볼까요?':'어떤 하루를 걸어볼까요?'}</h2></div><div class="theme-discovery-list"><button type="button" class="theme-discovery theme-discovery--custom" id="discover-custom-route"><span class="theme-art theme-custom" aria-hidden="true"></span><span><strong>출발·도착 맞춤</strong><small>원하는 출발지와 도착지를 정하고 하루 동선을 만들어요.</small><em>내 경로 직접 만들기</em></span><b aria-hidden="true">›</b></button>${themes.map(t=>`<button class="theme-discovery" data-discover-theme="${t.id}"><span class="theme-art theme-${t.art||t.id}" aria-hidden="true">${uiIcon(THEME_ICONS[t.id]||t.icon)}</span><span><strong>${esc(t.name)}</strong><small>${esc(t.description||routeEngine.THEME_PRESETS[t.id].description)}</small><em>${region.id==='gyeongju'?'테마 장소와 보행 길선 보기':region.id==='gangneung'?'테마 루트 보기':'테마 루트 보기'}</em></span><b aria-hidden="true">›</b></button>`).join('')}</div><div class="diary-section-head"><h2>${esc(region.name)}에서 만나는 풍경</h2><button class="text-button" data-city-tab="places">모두 보기 ›</button></div><div class="discovery-grid">${featured.map(destinationPlaceCard).join('')}</div>`:tab==='places'?`<div class="diary-section-head"><h2>한곳씩, 마음에 담기</h2><span class="small">${state.places.length}곳</span></div><div class="discovery-grid">${state.places.map(destinationPlaceCard).join('')}</div>`:tab==='themeDraft'?`<section class="theme-candidate-explorer"><div class="diary-section-head"><div><span class="eyebrow">장소 후보 초안</span><h2>가까이 모여 있는 경주 테마</h2></div><span class="pill">6개 테마 · 지도 핀</span></div><p class="theme-candidate-intro">저장된 경주 장소 중 테마 중심점 가까이에 있는 후보만 표시해요. 핀은 후보 위치이며 방문 순서나 보행 경로는 아닙니다.</p><div class="theme-candidate-layout"><div id="theme-candidate-controls" class="theme-candidate-controls" aria-label="경주 테마 선택"></div><div class="theme-candidate-map-wrap"><div id="theme-candidate-map" role="img" aria-label="선택한 경주 테마의 후보 장소 지도"></div><p class="small">지도 배경 © OpenStreetMap contributors · 핀 간 실제 보행 거리와 출입구는 별도 확인이 필요합니다.</p></div></div></section>`:`<div class="travel-note">${turtlePose('walk','산책하는 거북이')}<div><h2>내 속도로 걷는 ${esc(region.name)}</h2><p>${esc(region.description)}</p><p>지도에서 장소를 살펴보거나, 날짜와 테마를 골라 하루 코스를 만들어 보세요.</p></div></div><div class="info-pair"><div><strong>걸어서, 필요할 땐 버스로</strong><p>걷기 좋은 동선을 먼저 찾고, 도보 연결이 어려우면 확인 가능한 버스 경로를 살펴봐요.</p></div><div><strong>출발 전 한 번 더 확인</strong><p>장소의 운영시간과 실제 출입구, 버스 배차는 방문일에 확인해 주세요.</p></div></div>`}</div>
      <div class="city-cta"><button class="btn btn-primary" id="choose-region">⌖ ${esc(region.name)} 지도 둘러보기</button><button class="btn btn-outline" id="city-plan">나의 하루 계획</button></div></div></section>`;
    if (region.id==='gyeongju' && tab==='info') {
      $('.info-pair').innerHTML=`
        <div><strong>경주역·시내·보문·불국사</strong><p>710·711번 관광 안내와 10번 노선은 권역 연결 후보예요. 2026년 7월 역세권 경로가 바뀌어 탑승 정류장과 귀환편을 다시 확인해야 해요.</p><a href="https://its.gyeongju.go.kr/" target="_blank" rel="noopener noreferrer">경주시 교통정보센터 ↗</a></div>
        <div><strong>감포·양남·양동·건천</strong><p>100·150·203·350번 등으로 이어지는 먼 권역이에요. 특정 편의 도착 시각과 돌아오는 버스가 확인되기 전에는 하루 코스로 확정하지 않아요.</p><a href="https://www.gyeongju.go.kr/tour/page.do?mnu_uid=4750" target="_blank" rel="noopener noreferrer">경주시 150번 관광 안내 ↗</a></div>
        <div><strong>지도 위치와 숙소</strong><p>지도 핀은 ${state.places.length}개 장소의 대표 위치예요. 숙소 10곳은 출발·도착 위치를 찾을 때만 쓰고 지도핀이나 여행지로 표시하지 않아요.</p></div>
        <div><strong>방문 전 확인</strong><p>시장 점포·사찰·전시관의 운영과 해안 안전 통제는 방문일에 달라질 수 있어요. 경로와 운영 확인이 끝나지 않은 테마는 조사 후보로 살펴봐 주세요.</p><a href="https://www.gyeongju.go.kr/tour/" target="_blank" rel="noopener noreferrer">경주문화관광 ↗</a></div>`;
    }
    $('#city-back').onclick=()=>nav('home');
    $('#choose-region').onclick=()=>{state.mapCenter=region.center;state.mapZoom=13;state.selected=null;state.categories.clear();state.mapDisplay='map';nav('region');};
    $('#city-plan').onclick=()=>nav('plan');
    if(region.id==='gyeongju'&&tab==='themeDraft')loadGyeongjuThemeCandidateMap();
    $('#discover-custom-route')?.addEventListener('click',()=>{state.route.mode='custom';state.route.results=[];state.route.selected=-1;nav('routes');});
    document.querySelectorAll('[data-city-tab]').forEach(b=>b.onclick=()=>{state.destinationTab=b.dataset.cityTab;if(region.id==='gyeongju'){const url=new URL(location.href);if(state.destinationTab==='themeDraft')url.searchParams.set('tab','themes');else url.searchParams.delete('tab');history.replaceState(null,'',url);}renderDestination();});
    document.querySelectorAll('[data-discover-theme]').forEach(b=>b.onclick=()=>{state.route.mode='theme';state.route.theme=b.dataset.discoverTheme;state.route.results=[];state.route.selected=-1;nav('routes');});
    document.querySelectorAll('[data-open-place]').forEach(b=>b.onclick=()=>{state.placeBack='destination';state.placeTab='intro';state.selected=b.dataset.openPlace;nav('place');});
  }
  async function loadGyeongjuThemeCandidateMap() {
    const element=$('#theme-candidate-map'), controls=$('#theme-candidate-controls');
    if(!element||!controls||activeRegion.id!=='gyeongju')return;
    if(!window.L){element.innerHTML='<div class="empty-state">지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div>';return;}
    try {
      const response=await fetch('./gyeongju-theme-candidates.geojson');
      if(!response.ok)throw new Error('테마 후보 파일을 불러오지 못했습니다.');
      const data=await response.json();
      if(!element.isConnected)return;
      const themes=data.themes||[], groups=new Map(themes.map(theme=>[theme.id,{theme,items:data.features.filter(item=>item.properties.themeId===theme.id)}]));
      const map=L.map(element,{scrollWheelZoom:false,dragging:true,touchZoom:true});state.themeCandidateMap=map;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
      L.control.scale({imperial:false}).addTo(map);
      let pinLayer=null;
      const selectTheme=(theme,button)=>{
        if(pinLayer)map.removeLayer(pinLayer);
        controls.querySelectorAll('[data-theme-candidate]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
        const group=groups.get(theme.id), bounds=L.latLngBounds([]);
        pinLayer=L.layerGroup(group.items.map(item=>{
          const [lon,lat]=item.geometry.coordinates, point=[lat,lon];bounds.extend(point);
          return L.circleMarker(point,{radius:7,color:theme.color,weight:2,fillColor:theme.color,fillOpacity:.88})
            .bindPopup('<strong>'+esc(item.properties.name)+'</strong><br><small>'+esc(categoryName(item.properties.category))+' · 초안 후보<br>테마 중심점까지 직선 '+Number(item.properties.distanceToAnchorMeters||0)+'m</small>');
        })).addTo(map);
        if(bounds.isValid())map.fitBounds(bounds,{padding:[28,28],maxZoom:16});
        const summary=$('#theme-candidate-summary');
        if(summary)summary.innerHTML='<strong>'+esc(theme.name)+' · '+group.items.length+'곳</strong><span>'+esc(theme.description)+' · 지도 표시 범위는 중심점 기준 반경 '+Math.round(theme.radiusKm*1000)+'m입니다.</span><button type="button" class="btn btn-outline btn-sm" id="open-candidate-theme-route">이 테마 루트 보기</button>';
        $('#open-candidate-theme-route')?.addEventListener('click',()=>{state.route.mode='theme';state.route.theme=theme.id;state.route.results=[];state.route.selected=-1;nav('routes');});
      };
      controls.innerHTML=themes.map(theme=>'<button type="button" class="theme-candidate-option" data-theme-candidate="'+esc(theme.id)+'" aria-pressed="false"><span class="theme-candidate-swatch" style="--theme-color:'+esc(theme.color)+'"></span><span><strong>'+esc(theme.name)+'</strong><small>'+groups.get(theme.id).items.length+'곳</small></span></button>').join('')+'<div id="theme-candidate-summary" class="theme-candidate-summary"></div>';
      controls.querySelectorAll('[data-theme-candidate]').forEach(button=>{const theme=themes.find(item=>item.id===button.dataset.themeCandidate);button.onclick=()=>selectTheme(theme,button);});
      const first=controls.querySelector('[data-theme-candidate]');if(first)first.click();
      setTimeout(()=>{if(state.themeCandidateMap===map)map.invalidateSize();},80);
    } catch(error) {if(element.isConnected)element.innerHTML='<div class="empty-state">'+esc(error.message||'테마 후보 지도를 불러오지 못했습니다.')+'</div>';}
  }
  function renderPlacePage() {
    const p=getPlace(state.selected);if(!p){nav('region');return;}
    const related=state.places.filter(x=>x.id!==p.id&&x.category===p.category).slice(0,4);
    const tab=state.placeTab||'intro';
    const media=window.HANGEORUM_PLACE_MEDIA?.[p.id]||window.HANGEORUM_PLACE_EXAMPLE_MEDIA?.[p.id];
    const photoSource=activeRegion.id!=='mokpo'&&media?.source?`<p class="small">${media.kind==='example'?'예시 사진 · 실제 장소 아님':'실제 사진'} · ${esc(media.credit)} · <a href="${esc(media.source)}" target="_blank" rel="noopener noreferrer">사진 원본</a> · <a href="${esc(media.licenseUrl||'./assets/photos/README.md')}" target="_blank" rel="noopener noreferrer">이용 조건</a></p>`:'';
    $('#main').innerHTML=`<section class="place-page"><div class="place-cover">${placeVisual(p)}<button class="round-control" id="place-back" aria-label="이전 화면">‹</button></div><div class="place-page-body"><span class="eyebrow">${esc(categoryName(p.category))}</span><h1>${esc(p.name)}</h1><p class="place-address">⌖ ${esc(p.locationText||'위치 확인 필요')}</p>${photoSource}${p.rating!=null?`<p class="place-rating">${esc(p.ratingSource||'카카오맵')} ${esc(p.rating.toFixed(1))} / 5 · 평가 ${esc(p.ratingCount)}건 · ${esc(p.ratingChecked||activeRegion.dataChecked)} 조사 ${p.ratingUrl?`· <a href="${esc(p.ratingUrl)}" target="_blank" rel="noopener noreferrer">평점 출처 ↗</a>`:''}</p>`:''}<div class="place-quick-actions"><button id="place-see-map">${uiIcon('location')}지도 위치</button><button id="place-plan">${uiIcon('plan')}계획표 열기</button>${p.source?`<a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">${uiIcon('external')}장소 정보</a>`:''}</div>
      <div class="city-tabs" role="tablist" aria-label="장소 상세 정보"><button role="tab" aria-selected="${tab==='intro'}" data-place-tab="intro">방문 안내</button><button role="tab" aria-selected="${tab==='hours'}" data-place-tab="hours">운영시간</button><button role="tab" aria-selected="${tab==='related'}" data-place-tab="related">함께 둘러보기</button></div>
      <div class="place-tab-content">${tab==='intro'?`${priceHtml(p)}${p.description?`<p>${esc(p.description)}</p>`:''}<div class="travel-note">${turtlePose('rest','잠시 쉬는 거북이')}<div><h2>여기서 잠깐!</h2><p>${esc((p.hours||p.unrestrictedAccess)?placeTimeText(p):p.scheduleText||'방문 가능한 시간은 아직 확인 중이에요. 운영시간 탭에서 조사 내용을 확인해 주세요.')}</p>${p.hours?.note?`<p>${esc(p.hours.note)}</p>`:''}</div></div>${p.mapPinBasis?`<p class="small">지도 표시점: ${esc(p.mapPinBasis)}. 실제 출입구와 보행 시작점은 따로 확인해 주세요.</p>`:''}${soloHtml(p)}${reservationHtml(p)}<h2>같은 취향의 장소</h2><div class="discovery-grid">${related.map(destinationPlaceCard).join('')}</div>`:tab==='hours'?`<h2>방문 전 확인해 주세요</h2>${scheduleHtml(p)}<p class="small">기본 조사 ${esc(activeRegion.dataChecked)}${p.mapWeekChecked?' · 주간표 확인 '+esc(p.mapWeekChecked):''}. 당일 변경은 장소 안내에서 확인해 주세요.</p>`:`<h2>같은 취향의 장소</h2><p class="small">같은 유형으로 묶은 장소예요. 이동 거리는 지도에서 확인해 주세요.</p><div class="discovery-grid">${related.map(destinationPlaceCard).join('')}</div>`}</div>
      <button class="btn btn-primary place-main-cta" id="place-map-cta">⌖ 지도로 보기</button></div></section>`;
    $('#place-back').onclick=()=>{state.placeTab='intro';nav(state.placeBack||'region');};
    const seeMap=()=>{const point=pinPoint(p);if(!point){toast('이 장소의 지도 위치를 확인하고 있어요.');return;}state.mapDisplay='map';state.mapCenter=point;state.mapZoom=15;state.categories.clear();state.selected=null;nav('region');};
    $('#place-see-map').onclick=seeMap;$('#place-map-cta').onclick=seeMap;
    $('#place-plan').onclick=()=>{
      nav('plan');
      const minute=planSlots().find((slot)=>!state.draft.entries[slot]);
      openSlotEditor(minute ?? null, hhmm(minute ?? toMin(state.draft.start)), false, p.id);
    };
    document.querySelectorAll('[data-place-tab]').forEach(b=>b.onclick=()=>{state.placeTab=b.dataset.placeTab;renderPlacePage();});
    document.querySelectorAll('[data-open-place]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.openPlace;state.placeTab='intro';renderPlacePage();window.scrollTo(0,0);});
  }
  function renderRegionMap() {
    closeMapQuickAdd();
    const region = REGIONS.find((x) => x.id === state.region) || REGIONS[0];
    const list = state.places.filter((p) => !state.categories.size || state.categories.has(p.category));
    const chosen = CATEGORIES.filter(([id]) => state.categories.has(id)).map(([, label]) => label);
    const resultLabel = chosen.length === 0 ? '전체' : chosen.length <= 2 ? chosen.join('·') : '선택한 분류 ' + chosen.length + '개';
    if (state.mapProvider === 'leaflet') state.map?.remove();
    state.map = null; state.mapProvider = null; state.mapFocusedPlace = null; state.mapMarkers = new Map();
    $('#main').innerHTML=`<section class="explore-page ${state.mapDisplay==='list'?'list-mode':''}">
      <div class="explore-topbar"><button class="round-control" id="region-back" aria-label="${esc(region.name)} 소개로">${uiIcon('back')}</button><h1>${esc(region.name)} 한 바퀴</h1><div class="view-switch" aria-label="탐색 방식"><button data-map-display="map" class="${state.mapDisplay==='map'?'active':''}" aria-pressed="${state.mapDisplay==='map'}">지도</button><button data-map-display="list" class="${state.mapDisplay==='list'?'active':''}" aria-pressed="${state.mapDisplay==='list'}">목록</button></div></div>
      <div class="explore-workspace"><div class="explore-search"><form id="map-search-form" class="explore-search-form">${uiIcon('search')}<input id="map-search" aria-label="장소 또는 주소 검색" autocomplete="off" placeholder="${esc(region.name)}의 장소, 주소 검색"><button type="submit" aria-label="검색">${uiIcon('arrow')}</button></form><div class="filter-strip" aria-label="장소 유형 여러 개 선택 가능">${CATEGORIES.map(([id,label,emoji])=>{const active=id==='all'?!state.categories.size:state.categories.has(id);return `<button class="filter-chip ${active?'active':''}" data-category="${id}" aria-pressed="${active}"><span aria-hidden="true">${emoji}</span> ${label}</button>`;}).join('')}</div></div>
      <div class="explore-map"><div id="map"></div><button class="round-control recenter-control" id="recenter" aria-label="${esc(region.name)} 중심으로 돌아가기" title="${esc(region.name)} 중심으로 돌아가기">${uiIcon('target')}</button><span class="map-location-label">${uiIcon('location')} ${esc(region.name)}</span></div>
      <aside class="explore-sheet"><span class="sheet-handle" aria-hidden="true"></span><div class="explore-sheet-title"><div><span class="eyebrow">발걸음이 닿는 곳</span><h2>${esc(resultLabel==='전체'?region.name+'의 장소':resultLabel)} <small>${list.length}</small></h2></div><span class="small" id="pin-count">지도 핀 ${list.filter(hasPin).length}곳</span></div><div class="place-list">${list.map(p=>`<div class="place-row"><button type="button" class="place-row-main" data-place="${p.id}" aria-label="${esc(p.name)} ${hasPin(p)?'지도 위치 보기, 다시 누르면 설명 보기':'지도 위치 확인 중, 설명은 오른쪽 화살표'}">${placeVisual(p,true)}<span class="place-row-copy"><small class="place-row-category">${esc(categoryName(p.category))}</small><strong>${esc(p.name)}</strong><small>${esc(p.locationText||'위치 확인 필요')}</small>${reservationCardHtml(p)}</span></button><button type="button" class="place-row-open" data-open-map-place="${p.id}" aria-label="${esc(p.name)} 설명 보기"><span class="row-chevron" aria-hidden="true">›</span></button></div>`).join('')}</div><p class="map-evidence">지도 핀은 대표 위치예요. 실제 출입구는 방문 전 확인해 주세요.</p><div class="explore-actions"><button class="btn btn-outline" id="go-plan">${uiIcon('plan')} 직접 계획</button><button class="btn btn-primary" id="go-routes">${uiIcon('map')} 추천 루트</button></div></aside></div></section>`;
    initHomeMap(list);
    $('#region-back').onclick=()=>nav('destination');
    $('#go-plan').onclick=()=>nav('plan');$('#go-routes').onclick=()=>nav('routes');
    $('#recenter').onclick=()=>{const points=region.id==='gyeongju'?list.filter(hasPin).map(pinPoint):[];if(points.length && state.mapProvider==='leaflet')state.map?.fitBounds(points,{padding:[25,25]});else if(state.mapProvider==='kakao'){state.map?.setCenter(kakaoPoint(...region.center));state.map?.setLevel(kakaoLevel(13));}else state.map?.setView(region.center,13);};
    $('#map-search-form').onsubmit=searchMap;
    document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{const offset=$('.filter-strip').scrollLeft;const id=b.dataset.category;if(id==='all')state.categories.clear();else if(state.categories.has(id))state.categories.delete(id);else state.categories.add(id);state.selected=null;renderRegionMap();$('.filter-strip').scrollLeft=offset;});
    document.querySelectorAll('.explore-sheet .place-row').forEach(row=>row.onclick=(event)=>{if(event.target.closest('[data-open-map-place]'))return;focusMapPlace(row.querySelector('[data-place]').dataset.place);});
    document.querySelectorAll('[data-open-map-place]').forEach(b=>b.onclick=()=>selectPlace(b.dataset.openMapPlace));
    document.querySelectorAll('[data-map-display]').forEach(b=>b.onclick=()=>{closeMapQuickAdd();state.mapDisplay=b.dataset.mapDisplay;$('.explore-page').classList.toggle('list-mode',state.mapDisplay==='list');document.querySelectorAll('[data-map-display]').forEach(x=>{const active=x.dataset.mapDisplay===state.mapDisplay;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active);});if(state.mapProvider==='kakao')state.map?.relayout();else state.map?.invalidateSize();});
  }
  async function initHomeMap(list) {
    const container = $('#map');
    const pinned = list.filter(hasPin);
    if (!navigator.onLine) { container.innerHTML = '<div class="empty-state" style="margin:20px">지도는 인터넷에 연결하면 볼 수 있습니다.</div>'; return; }
    if (!window.L || container !== $('#map')) return;
    const map = L.map('map', { zoomControl: false }).setView(state.mapCenter, state.mapZoom);
    state.map = map; state.mapProvider = 'leaflet';
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    const colors = CATEGORY_COLORS;
    pinned.forEach((p) => {
      const marker = L.circleMarker(pinPoint(p), { radius: 7, weight: 2, color: '#fff', fillColor: colors[p.category] || '#123348', fillOpacity: .95 }).addTo(map);
      marker.bindTooltip(esc(p.name)); marker.on('click', () => openMapQuickAdd(p));
      state.mapMarkers.set(p.id, marker);
    });
    if (KAKAO_KEY && list.some((p) => !hasPin(p) && p.addressQuery)) loadKakao().then(() => {
      if (container === $('#map')) geocodeAddressPlaces(list, map, colors, container);
    }).catch(() => {});
    if ((state.categories.size || activeRegion.id==='gyeongju') && pinned.length) map.fitBounds(pinned.map(pinPoint), { padding: [25, 25], maxZoom: 14 });
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
        const expected = p.addressQuery.replace(new RegExp('^'+activeRegion.name+'시\\s*'), '').replace(/\s/g, '');
        const returned = String(hit.road_address?.address_name || hit.address_name || '').replace(/\s/g, '');
        if (!returned.includes(expected)) continue;
        geocodeCache[p.addressQuery] = {x: hit.x, y: hit.y};
        save(STORAGE_GEOCODES, geocodeCache);
      }
      const lat = Number(hit.y), lon = Number(hit.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
          Math.abs(lat - REGION_CENTER[0]) > .15 || Math.abs(lon - REGION_CENTER[1]) > .2) continue;
      p.lat = lat; p.lon = lon; p.pinBasis = 'address';
      const marker = L.circleMarker([lat, lon], { radius: 7, weight: 2, color: '#fff', fillColor: colors[p.category] || '#123348', fillOpacity: .95 }).addTo(map);
      marker.bindTooltip(esc(p.name + ' · 건물 주소 위치')); marker.on('click', () => openMapQuickAdd(p));
      state.mapMarkers.set(p.id, marker);
      if ($('#pin-count')) $('#pin-count').textContent = '지도 핀 ' + list.filter(hasPin).length + '곳';
    }
  }
  function focusMapPlace(id) {
    if (state.mapFocusedPlace === id) { selectPlace(id); return; }
    const place = getPlace(id);
    const point = pinPoint(place);
    if (!point) { toast('이 장소의 지도 위치를 확인하고 있어요.'); return; }
    document.querySelector('[data-map-display="map"]')?.click();
    const previous = state.mapMarkers.get(state.mapFocusedPlace);
    previous?.setStyle({radius:7,weight:2,color:'#fff'});
    state.mapFocusedPlace = id;
    document.querySelectorAll('.explore-sheet .place-row').forEach(row => row.classList.toggle('is-focused', row.querySelector('[data-place]')?.dataset.place === id));
    const marker = state.mapMarkers.get(id);
    marker?.setStyle({radius:11,weight:3,color:'#244c39'});
    marker?.bringToFront();
    marker?.openTooltip();
    state.map?.flyTo(point, 15);
  }
  function selectPlace(id) {
    if(!getPlace(id))return;
    state.selected=id;state.placeBack='region';state.placeTab='intro';nav('place');
  }
  function closeMapQuickAdd() {
    mapQuickForm?.remove();
    mapQuickForm = null;
    if (mapQuickOutsideHandler) document.removeEventListener('pointerdown', mapQuickOutsideHandler, true);
    mapQuickOutsideHandler = null;
    if (mapQuickResizeHandler) window.removeEventListener('resize', mapQuickResizeHandler);
    mapQuickResizeHandler = null;
  }
  function positionMapQuickAdd(form, left, top) {
    const x = Math.min(Math.max(0, left), Math.max(0, window.innerWidth - form.offsetWidth));
    const y = Math.min(Math.max(0, top), Math.max(0, window.innerHeight - form.offsetHeight));
    form.style.transform = 'none';
    form.style.left = x + 'px';
    form.style.top = y + 'px';
    mapQuickPosition = { left: x, top: y };
  }
  function openMapQuickAdd(place) {
    closeMapQuickAdd();
    const duration = routeEngine.stay(place, false);
    const form = document.createElement('form');
    form.className = 'map-quick-add';
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-label', place.name + ' 계획표 추가');
    form.tabIndex = -1;
    form.innerHTML = '<strong class="map-quick-add-name" title="잡아서 창 이동">' + esc(place.name) + '</strong>' +
      '<label for="map-quick-time">방문 시각</label><input id="map-quick-time" type="time" required step="60" class="text-field" value="' + esc(state.draft.start) + '">' +
      '<label for="map-quick-duration">체류시간 (분)</label><input id="map-quick-duration" type="number" min="1" step="1" required inputmode="numeric" class="text-field" value="' + esc(duration) + '">' +
      '<div class="map-quick-transparency"><label for="map-quick-transparency">투명도 <output for="map-quick-transparency">' + mapQuickTransparency + '%</output></label><input id="map-quick-transparency" type="range" min="0" max="30" step="5" value="' + mapQuickTransparency + '" aria-valuetext="' + mapQuickTransparency + '% 투명"></div>' +
      '<div class="map-quick-add-actions"><button type="button" class="btn btn-outline">취소</button><button type="submit" class="btn btn-primary">추가</button></div>';
    form.style.opacity = String(1 - mapQuickTransparency / 100);
    const transparencySlider = form.querySelector('#map-quick-transparency');
    transparencySlider.oninput = () => {
      mapQuickTransparency = Number(transparencySlider.value);
      form.style.opacity = String(1 - mapQuickTransparency / 100);
      form.querySelector('output').textContent = mapQuickTransparency + '%';
      transparencySlider.setAttribute('aria-valuetext', mapQuickTransparency + '% 투명');
    };
    document.body.appendChild(form);
    mapQuickForm = form;
    if (mapQuickPosition) positionMapQuickAdd(form, mapQuickPosition.left, mapQuickPosition.top);
    mapQuickResizeHandler = () => { if (mapQuickPosition) positionMapQuickAdd(form, mapQuickPosition.left, mapQuickPosition.top); };
    window.addEventListener('resize', mapQuickResizeHandler);
    const dragHandle = form.querySelector('.map-quick-add-name');
    dragHandle.onpointerdown = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const rect = form.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      dragHandle.setPointerCapture(event.pointerId);
      dragHandle.classList.add('dragging');
      dragHandle.onpointermove = (moveEvent) => {
        if (moveEvent.pointerId === event.pointerId) positionMapQuickAdd(form, moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
      };
      const finish = () => { dragHandle.classList.remove('dragging'); dragHandle.onpointermove = null; };
      dragHandle.onpointerup = finish;
      dragHandle.onpointercancel = finish;
    };
    form.focus({preventScroll:true});
    mapQuickOutsideHandler = (event) => { if (!form.contains(event.target) && !event.target.closest('#modal-root')) closeMapQuickAdd(); };
    setTimeout(() => { if (mapQuickForm === form) document.addEventListener('pointerdown', mapQuickOutsideHandler, true); }, 0);
    form.querySelector('[type="button"]').onclick = closeMapQuickAdd;
    form.onsubmit = (event) => {
      event.preventDefault();
      const time = form.querySelector('[type="time"]').value;
      const minutes = Number(form.querySelector('[type="number"]').value);
      if (!time) return toast('방문 시각을 입력해 주세요.');
      if (!Number.isSafeInteger(minutes) || minutes < 1) return toast('체류시간을 1분 이상의 정수로 입력해 주세요.');
      const selected = toMin(time), draft = state.draft, end = routeEngine.minutes(draft.end || '24:00');
      if (selected < toMin(draft.start) || selected + minutes > end) return toast('방문 시각과 체류시간을 계획표의 시작·종료 범위 안으로 정해 주세요.');
      const conflict = Object.entries(draft.entries || {}).find(([at, entry]) => selected < Number(at) + (Number(entry.duration) || 60) && selected + minutes > Number(at));
      if (conflict) return toast(hhmm(Number(conflict[0])) + ' 일정과 시간이 겹칩니다. 다른 시각을 골라 주세요.');
      beforeAddReservation([place], () => {
        draft.entries[selected] = {placeId:place.id, duration:minutes, memo:''};
        persistDraft();
        closeMapQuickAdd();
        toast(place.name + '을(를) ' + hhmm(selected) + ' 계획표에 넣었습니다.');
      });
    };
  }
  async function searchMap(event) {
    event.preventDefault(); const q = $('#map-search').value.trim(); if (!q) return;
    if (activeRegion.id==='gyeongju' && q.length>=3 && state.lodgings.some((place) => place.name.includes(q) || place.address===q)) {
      toast('숙소는 지도에 표시하지 않아요. 추천 루트에서 출발·도착 위치로 검색해 주세요.'); return;
    }
    const match = state.places.find((p) => p.name.includes(q) && coord(p));
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
        state.map?.flyTo([lat, lon], 15);
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
    if (p?.id === 'p15') {
      const actualDate=dateAt(date,minute), month=Number(actualDate.slice(5,7)), day=weekday(actualDate), time=minute%1440;
      const scheduleYear=actualDate.slice(0,4)==='2026';
      const inSeason=[4,5,9,10,11].includes(month), operatingDay=day!==1;
      const times=inSeason ? (day===5 || day===6 ? [1200,1230,1260] : [1200,1230]) :
        [6,7,8].includes(month) && day!==1 ? [1200,1230,1260] : [];
      if(!scheduleYear || !operatingDay || !times.includes(time) || Number(entry.duration||20)>20)
        return {kind:'bad',title:'공연 회차 시간 확인 필요',detail:'2026년 목포시 공지에 있는 운영일·회차에 맞춰 방문해 주세요.'};
      return {kind:'ok',title:'공연 시간표상 관람 가능',detail:'2026년 목포시 정기 공연 시간표 기준입니다. 기상·현장 사정으로 취소될 수 있어 당일 공지를 확인하세요.'};
    }
    if (p?.unrestrictedAccess) return p.accessConstraint === 'publicFerry' ?
      {kind:'warn',title:'산책 시간 제한 없음 · 배편 확인',detail:'섬 자체의 입장시간은 없지만 실제 이동·귀항은 여객선 시간과 기상에 따릅니다.'} :
      {kind:'ok',title:'야외 접근 가능',detail:'정해진 출입시간이 없는 산책 구간입니다. 기상·안전 통제와 야간 보행 여건은 현장에서 확인하세요.'};
    if (daily?.closed) return {kind:'bad',title:'해당 날짜 휴무',detail:'날짜별 시간표에 휴무로 표시되었습니다.'};
    const actualDate = dateAt(date, minute);
    const weekly = p?.weeklyHours?.[weekday(actualDate)];
    const h = daily?.open ? {...p.hours,...weekly,...daily,breaks:daily.breaks?.length ? daily.breaks : p.hours?.breaks} :
      p?.hours ? {...p.hours,...weekly} : null;
    if (!p || !h) return { kind: 'unknown', title: '운영시간 확인 필요', detail: '장소 운영정보가 없어 가능 여부를 확정할 수 없습니다.' };
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
    state.planMap?.remove(); state.planMap = null;
    const d = state.draft;
    if (!d.entries) d.entries = {};
    if (!Array.isArray(d.pending)) d.pending=[];
    const slots = planSlots();
    const filled = slots.filter((m) => d.entries[m]);
    const mapped = filled.map((minute, index) => ({minute, number:index + 1, entry:d.entries[minute]}));
    const missing = mapped.filter(({entry}) => !pinPoint(entryPlace(entry) || entry));
    $('#main').innerHTML = '<section class="page planner-page"><button class="back" id="plan-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">나의 하루 계획</div><h1>시간계획표</h1><p>시간은 예상입니다. 실제로 떠날 때 다음 장소의 길을 열어보세요.</p></div><div class="top-actions"><button class="btn btn-outline" id="new-plan">새 계획</button><button class="btn btn-primary" id="save-plan">계획 저장</button></div></div>' +
      '<section class="plan-map-section" aria-labelledby="plan-map-title"><div class="plan-map-heading"><h2 id="plan-map-title">계획 장소 지도</h2><p>번호는 계획표의 방문 순서입니다.</p></div>' +
      (navigator.onLine && window.L ? '<div id="plan-map" role="img" aria-label="계획표의 방문 순서 번호핀 지도"></div>' : '<p class="plan-map-message">인터넷에 연결하면 지도를 볼 수 있어요.</p>') +
      (missing.length ? '<p class="plan-map-note">' + missing.map(({number}) => number).join(', ') + '번 장소는 위치를 찍으면 지도에 표시돼요.</p>' : '') + '</section>' +
      '<div class="planner-grid"><div><div class="card"><label class="field-label" for="plan-title">계획 이름</label><input class="text-field" id="plan-title" value="' + esc(d.title) + '" maxlength="80"><div class="form-grid" style="margin-top:14px"><div class="field-group"><label class="field-label" for="plan-date">날짜</label><input class="text-field" type="date" id="plan-date" value="' + esc(d.date) + '"></div><div class="field-group"><label class="field-label" for="plan-start">시작 시각</label><input class="text-field" type="time" id="plan-start" value="' + esc(d.start) + '"></div><div class="field-group"><label class="field-label" for="plan-end">끝낼 시각</label><input class="text-field" type="time" id="plan-end" value="' + esc(d.end === '24:00' ? '23:59' : d.end || '23:59') + '" ' + (d.end === '24:00' ? 'disabled' : '') + '><label class="check-line"><input type="checkbox" id="plan-midnight" ' + (d.end === '24:00' ? 'checked' : '') + '> 자정까지</label></div></div></div>' +
      '<div class="slot-list">' + slots.map((m) => slotHtml(m, d.entries[m])).join('') + '</div></div>' +
      '<aside class="card plan-aside"><div class="eyebrow">계획 안내</div><h3>내 일정은 내 속도로</h3><p>장소에서 일찍 나오거나 오래 머물러도 괜찮아요. 다음 장소로 출발할 때 버튼을 누르면 그 시각 기준으로 다시 확인합니다.</p><div class="notice">운영시간·브레이크·공식 입장/주문 마감을 확인합니다. <strong>폐관 1시간 전 입장</strong>은 권장 안내이며 자동 삭제 기준이 아닙니다.</div><p class="small" style="margin:14px 0 0">장소 정보 기준 ' + esc(activeRegion.dataChecked) + '. 임시휴무와 실제 출입구는 방문 전에 다시 확인하세요.</p></aside></div></section>';
    $('.plan-aside')?.insertAdjacentHTML('afterbegin', turtlePose('memo', '계획을 적는 거북이', 'turtle-aside'));
    if (d.pending.length) $('.slot-list').insertAdjacentHTML('beforebegin','<section class="plan-pending"><h2>보류 중인 장소 <small>' + d.pending.length + '곳</small></h2><p class="small">빈 시각을 정하면 계획표에 넣을 수 있습니다.</p>' + d.pending.map((item,i) => '<div class="plan-pending-item"><div><strong>' + esc(entryLabel(item.entry)) + '</strong><small>추천 ' + esc(hhmm(item.minute)) + (item.date !== d.date ? ' · 추천 날짜 ' + esc(item.date) : '') + '</small></div><label>넣을 시각 <input type="time" class="text-field" data-pending-time="' + i + '" value="' + esc(hhmm(item.minute)) + '"></label><button type="button" class="btn btn-outline btn-sm" data-apply-pending="' + i + '">넣기</button><button type="button" class="btn btn-outline btn-sm" data-remove-pending="' + i + '" aria-label="' + esc(entryLabel(item.entry)) + ' 보류에서 빼기">빼기</button></div>').join('') + '</section>');
    $('#plan-back').onclick = () => nav('region');
    $('#save-plan').onclick = savePlan;
    $('#new-plan').onclick = () => openModal('<h2>새 계획을 시작할까요?</h2><p>현재 계획은 저장하지 않았다면 복구할 수 없습니다.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="confirm-new">새 계획</button></div>', () => { $('#confirm-new').onclick = () => { state.draft = { id: null, title: '나의 ' + activeRegion.name + ' 하루', date: today(), start: '09:00', end:'24:00', origin: null, theme:'balanced', mealTimes:[], solo:false, entries: {}, pending:[] }; persistDraft(); closeModal(); renderPlan(); }; });
    $('#plan-title').onchange = (e) => { d.title = e.target.value.trim() || '나의 ' + activeRegion.name + ' 하루'; persistDraft(); };
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
    if (!filled.length) $('.slot-list')?.insertAdjacentHTML('afterbegin', '<div class="notice">시간대를 골라 장소를 넣어 보세요. 추가할 때 시·분을 직접 정할 수 있습니다.</div>');
    if (navigator.onLine && window.L) initPlanMap(mapped);
  }
  function initPlanMap(items) {
    const element = $('#plan-map');
    if (!element) return;
    const map = L.map(element, {scrollWheelZoom:false, dragging:true, touchZoom:true}).setView(REGION_CENTER, 13);
    state.planMap = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const groups = new Map();
    items.forEach(({minute, number, entry}) => {
      if (isLodgingPoint(entryPlace(entry) || entry)) return;
      const point = pinPoint(entryPlace(entry) || entry);
      if (!point) return;
      const key = point.join(',');
      if (!groups.has(key)) groups.set(key, {point, labels:[]});
      groups.get(key).labels.push({number, name:entryLabel(entry), minute});
    });
    const bounds = L.latLngBounds([]);
    groups.forEach(({point, labels}) => {
      bounds.extend(point);
      const numbers = labels.map(({number}) => number).join('·');
      const tooltip = labels.map(({number, name, minute}) => number + '번 · ' + hhmm(minute) + ' ' + name).join(' / ');
      const width = Math.max(34, Math.min(94, 16 + numbers.length * 9));
      L.marker(point, {icon:L.divIcon({className:'plan-number-pin', html:'<span>' + esc(numbers) + '</span>', iconSize:[width,34], iconAnchor:[width/2,17]})}).addTo(map).bindTooltip(tooltip);
    });
    if (bounds.isValid()) map.fitBounds(bounds, {padding:[38,38], maxZoom:15});
    setTimeout(() => { if (state.planMap === map) map.invalidateSize(); }, 50);
  }
  function slotHtml(minute, entry) {
    const time = '<div class="slot-time">' + esc(hhmm(minute)) + (entry ? '' : '<small>시간대</small>') + '</div>';
    if (!entry) return '<div class="slot-card">' + time + '<div class="slot-content slot-empty"><span>원하는 분을 정해 추가하세요.</span><button class="btn btn-outline btn-sm" data-edit-slot="' + minute + '">+ 일정 추가</button></div></div>';
    const result = evaluate(entry, minute, state.draft.date);
    const place = entryPlace(entry);
    return '<div class="slot-card">' + time + '<div class="slot-content"><div class="toolbar" style="justify-content:space-between"><h3>' + esc(entryLabel(entry)) + '</h3>' + pillFor(result) + '</div><p>' + esc(result.detail) + '</p>' + (place ? '<p class="small">' + esc(placeTimeText(place)) + '</p>' : '<p class="small">직접 입력한 장소 · 영업 정보 미확인</p>') + (entry.memo ? '<p>메모 · ' + esc(entry.memo) + '</p>' : '') + '<div class="slot-actions"><button class="btn btn-mint btn-sm" data-go-next="' + minute + '">이제 이 장소로 이동</button><button class="btn btn-outline btn-sm" data-edit-slot="' + minute + '">수정</button><button class="btn btn-outline btn-sm" data-remove-slot="' + minute + '">삭제</button></div></div></div>';
  }
  function recommendations(minute, duration = 60, mealOnly = false) {
    const d = state.draft;
    const used = new Set(Object.values(d.entries).map((e) => e.placeId));
    const earlier = Object.entries(d.entries).map(([t,e]) => [Number(t),e]).filter(([t,e]) => t < minute && coord(entryCoord(e))).sort((a,b) => b[0]-a[0])[0];
    const anchor = earlier ? entryCoord(earlier[1]) : (d.origin === 'current' ? d.currentOrigin || STATION : d.origin === 'custom' ? d.customOrigin || STATION : d.customOrigin?.id === d.origin ? d.customOrigin : getPlace(d.origin) || STATION);
    return state.places.filter((p) => coord(p) && !used.has(p.id) && (mealOnly === ['food','cafe'].includes(p.category)) && (!d.solo || soloTravel.canVisit(p)))
      .map((p) => ({ p, result: evaluate({placeId:p.id,duration},minute,d.date), distance: km(anchor,p) || 99 }))
      .filter((v) => v.distance <= 1.1 && v.result.kind !== 'bad' && !(v.result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(v.result.title)))
      .sort((a,b) => (b.result.kind === 'ok' ? 1 : 0) - (a.result.kind === 'ok' ? 1 : 0) || (routeEngine.themeScore(b.p,d.theme || 'balanced',0)-routeEngine.themeScore(a.p,d.theme || 'balanced',0)) || a.distance-b.distance).slice(0,3);
  }
  function openSlotEditor(minute, selectedTime = hhmm(minute), preservePin = false, preselectedPlaceId = null) {
    if (!preservePin) state.pinSelection = null;
    const entry = minute == null ? null : state.draft.entries[minute];
    const initialPlace = getPlace(preselectedPlaceId || entry?.placeId);
    const initialDuration = Number(entry?.duration) || (initialPlace ? routeEngine.stay(initialPlace, false) : 60);
    const body = '<h2>일정 넣기</h2><label class="field-label" for="entry-time">방문 시작 시각 (시·분)</label><input class="text-field" type="time" step="60" id="entry-time" value="' + esc(selectedTime) + '"><p class="small entry-time-help">계획표의 시작·종료 시각 안에서 1분 단위로 정할 수 있습니다.</p><div class="route-solo-control plan-recommend-control"><span class="section-label">선택한 시각에 추천하는 장소</span><label class="route-solo-label" for="plan-meal-only"><input type="checkbox" id="plan-meal-only"> 식사·카페</label></div><div class="route-solo-control"><label class="route-solo-label" for="plan-solo"><input type="checkbox" id="plan-solo" ' + (state.draft.solo ? 'checked' : '') + '> 혼자 여행</label><span class="small">식당은 1인·단품 메뉴와 직접 식사 후기 기준 · 카페 방문과 식사 메뉴는 구분</span></div><div id="entry-recommendations"></div>' +
      '<div class="divider"></div><div class="section-label">입력</div><label class="field-label" for="place-picker">앱에 있는 장소 찾기</label><input class="text-field" id="place-picker" autocomplete="off" placeholder="장소 이름 검색" value="' + esc(initialPlace?.name || '') + '"><p id="selected-place-note" class="small">' + (initialPlace ? '선택한 장소: ' + esc(initialPlace.name) : '장소를 검색해 선택하거나 아래에 직접 입력하세요.') + '</p><div id="picker-results" class="picker-list" style="display:none"></div>' +
      '<div class="section-label">또는 내가 아는 장소 직접 추가</div><div class="form-grid two"><div class="field-group"><label class="field-label" for="custom-name">이름</label><input class="text-field" id="custom-name" value="' + esc(entry?.name || '') + '" placeholder="장소 이름"></div><div class="field-group"><label class="field-label" for="custom-location">위치·주소</label><input class="text-field" id="custom-location" value="' + esc(entry?.locationText || '') + '" placeholder="주소 또는 위치 설명"></div></div><button class="btn btn-outline btn-sm" style="margin-top:8px" id="choose-pin">지도에서 위치 찍기</button><span id="pin-note" class="small" style="margin-left:8px">' + (coord(state.pinSelection) || coord(entry) ? '핀 지정됨' : '핀 미지정') + '</span>' +
      '<div class="form-grid two" style="margin-top:15px"><div class="field-group"><label class="field-label" for="entry-duration">예상 체류 (분)</label><input class="text-field" type="number" min="1" step="1" inputmode="numeric" id="entry-duration" value="' + esc(initialDuration) + '">' + (initialPlace ? '<span class="small">코스에서 쓰는 예상 체류시간을 제안합니다. 직접 바꿀 수 있어요.</span>' : '') + '</div><div class="field-group"><label class="field-label" for="entry-memo">기타 메모</label><input class="text-field" id="entry-memo" value="' + esc(entry?.memo || '') + '" placeholder="적어 두고 싶은 내용"></div></div>' +
      '<div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="save-custom">계획표에 넣기</button></div>';
    openModal(body, () => {
      let selectedPlaceId = initialPlace?.id || null;
      const showRecommendations = () => {
        const value = $('#entry-time').value;
        if (!value) return;
        const mealOnly = $('#plan-meal-only').checked;
        const next = recommendations(toMin(value), Number($('#entry-duration').value) || 60, mealOnly);
        $('#entry-recommendations').innerHTML = next.length ? '<div class="suggest-grid">' + next.map(({p,result,distance}) => '<button class="suggest-btn" data-recommend="' + p.id + '"><strong>' + esc(p.name) + '</strong><small>직선 약 ' + distance.toFixed(2) + 'km · ' + esc(result.title) + '</small>'+(state.draft.solo && p.soloResearch?'<small>'+esc(soloTravel.evidenceLevel(p))+'</small>':'')+'</button>').join('') + '</div>' : '<div class="notice warn">이 시각·거리·' + (mealOnly ? '식사·카페' : '장소') + ' 조건에 맞는 후보를 확인하지 못했습니다. 직접 입력할 수 있어요.</div>';
        $('#entry-recommendations').querySelectorAll('[data-recommend]').forEach((b) => b.onclick = () => setEntry(minute, { placeId: b.dataset.recommend, memo: '' }));
      };
      $('#entry-time').onchange = showRecommendations;
      $('#entry-duration').oninput = showRecommendations;
      $('#plan-meal-only').onchange = showRecommendations;
      $('#plan-solo').onchange = (event) => { state.draft.solo = event.target.checked; persistDraft(); showRecommendations(); };
      showRecommendations();
      $('#place-picker').oninput = (e) => {
        selectedPlaceId = null;
        $('#selected-place-note').textContent = '검색 결과에서 장소를 선택하거나 아래에 직접 입력하세요.';
        const q = e.target.value.trim().toLowerCase(); const box = $('#picker-results');
        if (!q) { box.style.display = 'none'; return; }
        const matches = state.places.filter((p) => p.name.toLowerCase().includes(q)).slice(0,8);
        box.style.display = 'block'; box.innerHTML = matches.length ? matches.map((p) => '<button class="picker-option" data-picker="' + p.id + '"><strong>' + esc(p.name) + '</strong><small>' + esc(placeTimeText(p)) + '</small></button>').join('') : '<div class="small" style="padding:12px">자료에 없는 장소입니다. 아래에서 직접 추가하세요.</div>';
        box.querySelectorAll('[data-picker]').forEach((b) => b.onclick = () => setEntry(minute, { placeId:b.dataset.picker, duration:Number($('#entry-duration').value), memo:$('#entry-memo').value.trim() }));
      };
      $('#custom-name').oninput = () => {
        if (!selectedPlaceId) return;
        selectedPlaceId = null;
        $('#place-picker').value = '';
        $('#selected-place-note').textContent = '직접 입력할 장소를 저장합니다.';
      };
      $('#choose-pin').onclick = () => chooseCustomPin(minute);
      $('#save-custom').onclick = () => {
        if (selectedPlaceId) return setEntry(minute, { placeId:selectedPlaceId, memo:$('#entry-memo').value.trim() });
        const name = $('#custom-name').value.trim(); if (!name) { toast('장소 이름을 입력해 주세요.'); $('#custom-name').focus(); return; }
        const pin = state.pinSelection;
        setEntry(minute, { name, locationText: $('#custom-location').value.trim(), lat:pin?.lat ?? entry?.lat ?? null, lon:pin?.lon ?? entry?.lon ?? null, duration:Number($('#entry-duration').value), memo:$('#entry-memo').value.trim() });
      };
    });
  }
  function setEntry(minute, entry) {
    const value = $('#entry-time')?.value;
    if (!value) return toast('방문 시작 시각을 입력해 주세요.');
    const duration = Number($('#entry-duration')?.value);
    if (!Number.isSafeInteger(duration) || duration < 1) { toast('예상 체류시간을 1분 이상의 정수로 입력해 주세요.'); $('#entry-duration').focus(); return; }
    entry.duration = duration;
    const selected = toMin(value), d = state.draft, end = routeEngine.minutes(d.end || '24:00');
    if (selected < toMin(d.start) || selected + duration > end) return toast('방문 시각과 체류시간을 계획표의 시작·종료 범위 안으로 정해 주세요.');
    const conflict = Object.entries(d.entries).find(([at, existing]) => Number(at) !== minute && selected < Number(at) + (Number(existing.duration) || 60) && selected + duration > Number(at));
    if (conflict) return toast(hhmm(Number(conflict[0])) + ' 일정과 시간이 겹칩니다. 다른 시각을 골라 주세요.');
    confirmPlaceReservation([getPlace(entry.placeId)], () => {
      if (minute != null && selected !== minute) delete d.entries[minute];
      d.entries[selected] = entry; state.pinSelection = null; persistDraft(); closeModal(); renderPlan(); toast('계획표에 넣었습니다.');
    });
  }
  function removeEntry(minute) { openModal('<h2>이 계획을 삭제할까요?</h2><p>' + esc(entryLabel(state.draft.entries[minute])) + ' · ' + esc(hhmm(minute)) + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-danger" id="confirm-remove">삭제</button></div>', () => { $('#confirm-remove').onclick = () => { delete state.draft.entries[minute]; persistDraft(); closeModal(); renderPlan(); }; }); }
  function chooseCustomPin(minute) {
    if (!navigator.onLine || !window.L) { toast('지도에서 위치를 찍으려면 인터넷이 필요합니다.'); return; }
    const name = $('#custom-name').value, locationText = $('#custom-location').value, duration = $('#entry-duration').value, memo = $('#entry-memo').value, selectedTime = $('#entry-time').value;
    const originalPin = state.pinSelection;
    const pin = originalPin || (coord(state.draft.entries[minute]) ? state.draft.entries[minute] : null);
    openModal('<h2>지도에서 위치 찍기</h2><p>지도 위를 눌러 장소 위치를 선택하세요. 실제 건물 출입구인지 확인해 주세요.</p><div class="pin-map-wrap"><div id="pin-map"></div></div><p id="picked-coord" class="small">' + (pin ? pin.lat.toFixed(5) + ', ' + pin.lon.toFixed(5) : '아직 위치를 찍지 않았습니다.') + '</p><div class="modal-actions"><button class="btn btn-outline" id="pin-back">돌아가기</button><button class="btn btn-primary" id="pin-done" ' + (pin ? '' : 'disabled') + '>위치 사용</button></div>', async () => {
      const back = (usePin) => { if (!usePin) state.pinSelection = originalPin; openSlotEditor(minute, selectedTime, true); $('#custom-name').value = name; $('#custom-location').value = locationText; $('#entry-duration').value = duration; $('#entry-memo').value = memo; };
      $('#pin-back').onclick = () => back(false); $('#pin-done').onclick = () => back(true);
      if (KAKAO_KEY) {
        try {
          await loadKakao();
          if (!$('#pin-map')) return;
          const map = new kakao.maps.Map($('#pin-map'), {center: kakaoPoint(...(pin ? [pin.lat, pin.lon] : REGION_CENTER)), level: kakaoLevel(14)});
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
      const map = L.map('pin-map').setView(pin ? [pin.lat,pin.lon] : REGION_CENTER, 14);
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
    const d = JSON.parse(JSON.stringify(state.draft)); d.title = $('#plan-title')?.value.trim() || d.title || '나의 ' + activeRegion.name + ' 하루';
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
    const places = [STATION, ...routeEngine.prepareRoutePlaces(state.places).filter((p) => coord(p) && !['p41','p51'].includes(p.id))];
    field.querySelector('.field-label').outerHTML = '<div class="route-field-header"><label class="field-label" for="route-' + kind + '-query">' + (isOrigin ? '시작 위치' : '도착 위치') + '</label><button type="button" class="route-current-btn" id="route-' + kind + '-current" aria-label="현재 위치를 ' + (isOrigin ? '시작' : '도착') + ' 위치로 사용">📍 현재 위치</button></div>';
    field.querySelector('#use-location')?.remove();
    select.outerHTML = '<div class="route-place-search"><div class="route-search-line"><input class="text-field" id="route-' + kind + '-query" autocomplete="off" placeholder="장소명 또는 주소 입력" aria-controls="route-' + kind + '-matches"><button type="button" class="route-search-icon" id="route-' + kind + '-online" aria-label="온라인에서 ' + (isOrigin ? '시작' : '도착') + ' 위치 검색" title="온라인 주소·장소 검색">🔍</button></div><div class="route-place-selected" id="route-' + kind + '-selected" role="status"></div><div class="route-place-matches" id="route-' + kind + '-matches"></div></div>';
    const input = $('#route-' + kind + '-query'), matches = $('#route-' + kind + '-matches');
    const selected = $('#route-' + kind + '-selected');
    const value = () => isOrigin ? r.origin : r.destination;
    const set = (id, place) => {
      if (isOrigin) { r.origin = id; if (id === 'custom') r.customOrigin = place; }
      else { r.destination = id; if (id === 'custom') r.customDestination = place; }
      selected.innerHTML = '<span>선택한 위치</span><strong>' + esc(place?.name || (id === 'current' ? '현재 위치' : (places.find((p) => p.id === id)?.name || STATION.name))) + '</strong>';
      input.value = ''; matches.innerHTML = '';
      r.results = []; $('#route-results').innerHTML = '';
    };
    const current = value() === 'custom' ? (isOrigin ? r.customOrigin : r.customDestination) : value() === 'current' ? r.current : getPlace(value()) || places.find((p) => p.id === value());
    selected.innerHTML = '<span>선택한 위치</span><strong>' + esc(current?.name || STATION.name) + '</strong>';
    const addressQuery = (address) => String(address || '').replace(/\([^)]*\).*$/, '').trim();
    const addressTail = (address) => addressQuery(address).replace(/^.*?(?:목포시|강릉시|경주시)\s*/, '').replace(/\s+/g, '').toLowerCase();
    function rememberLodgingPin(place, point) {
      const resolved = {...place,lat:point.lat,lon:point.lon};
      const index = state.lodgings.findIndex((item) => item.id === place.id);
      if (index >= 0) state.lodgings[index] = resolved;
      lodgingPins[place.id] = {address:place.address,lat:point.lat,lon:point.lon};
      save(STORAGE_LODGING_PINS,lodgingPins);
      set(place.id,resolved);
    }
    async function choose(place) {
      if (place?.lodgingSourceId && coord(place)) {
        const lodging = state.lodgings.find((item) => item.id === place.lodgingSourceId);
        if (lodging) rememberLodgingPin(lodging,place);
        return;
      }
      if (!place?.id?.startsWith('lodging-') || coord(place)) { set(place.id || 'custom', place.id ? place : {...place,id:'custom'}); return; }
      if (!navigator.onLine) { toast('숙소 주소의 위치를 확인하려면 인터넷 연결이 필요합니다.'); return; }
      matches.innerHTML = '<p class="small">저장된 숙소 주소의 위치를 확인하고 있어요.</p>';
      try {
        const query = addressQuery(place.address);
        const response = await fetch('/api/place-search?q=' + encodeURIComponent(query), {cache:'no-store'});
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('주소 검색 서버 연결이 필요합니다.');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '숙소 주소를 검색하지 못했습니다.');
        const results = data.results || [];
        if (!results.length) { show([]); toast('저장된 숙소 주소의 위치를 찾지 못했습니다. 다른 주소로 온라인 검색해 주세요.'); return; }
        const match = results.find((item) => coord(item) && addressTail(item.address) === addressTail(query));
        if (!match) { show(results.map((item) => ({...item,lodgingSourceId:place.id}))); toast('저장 주소와 일치하는 위치가 없습니다. 검색 결과에서 위치를 직접 선택해 주세요.'); return; }
        rememberLodgingPin(place,match);
      } catch (error) { matches.innerHTML = ''; toast(error.message || '숙소 주소 검색에 실패했습니다.'); }
    }
    function show(items) {
      matches.innerHTML = items.length ? items.map((p,i) => '<button type="button" class="route-place-match" data-match="' + i + '"><strong>' + esc(p.name) + '</strong>' + (p.address ? '<small>' + esc(p.address) + '</small>' : '') + '</button>').join('') : '<p class="small">검색 결과가 없습니다.</p>';
      matches.querySelectorAll('[data-match]').forEach((button) => button.onclick = () => {
        choose(items[Number(button.dataset.match)]);
      });
    }
    input.oninput = () => {
      const q = input.value.trim().toLocaleLowerCase();
      matches.innerHTML = '';
      if (q) show([...places,...state.lodgings].filter((p) => p.name.toLocaleLowerCase().includes(q) || p.id?.startsWith('lodging-') && p.address?.toLocaleLowerCase().includes(q)).slice(0, 12));
    };
    input.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); $('#route-' + kind + '-online').click(); } };
    $('#route-' + kind + '-online').onclick = async () => {
      const q = input.value.trim();
      if (q.length < 2) return toast('주소나 장소명을 두 글자 이상 입력해 주세요.');
      const knownLodging = state.lodgings.find((place) => place.name.toLocaleLowerCase() === q.toLocaleLowerCase());
      if (knownLodging) { await choose(knownLodging); return; }
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
    if (activeRegion.id==='gangneung' && r.mode==='theme' && ['food','sea','shops','cafe','history'].includes(r.theme)) {
      const candidates=(await loadGangneungReviewRoutes()).filter(route=>route.themeId===r.theme);
      r.reviewOptions=candidates.map(buildGangneungReviewRoute).filter(Boolean);
      r.review=r.reviewOptions[0] || null;
      r.reviewSelected=0;
      r.themeReviewOnly=true;
      r.locationMissing=false;
      return [];
    }
    const routePlaces=routeEngine.prepareRoutePlaces(r.solo && r.mode !== 'theme' ? state.places.filter(soloTravel.canVisit) : state.places);
    r.review=null;
    r.locationMissing=false;
    const preset=r.mode === 'theme' ? routeEngine.THEME_PRESETS[r.theme] : null;
    const origin=routeEngine.prepareRoutePlaces([preset ? (getPlace(preset.originId) || STATION) : routeOrigin()])[0];
    const destination=routeEngine.prepareRoutePlaces([preset ? (getPlace(preset.destinationId) || STATION) : routeDestination()])[0];
    if(!coord(origin) || !coord(destination)) {r.locationMissing=true;return [];}
    const validateRoute=(p,minute,duration,date) => r.mode==='theme' ? validateThemeVisit(p,minute,duration,date) : evaluate({placeId:p.id,duration},minute,date);
    let apiAvailable=true;
    const unavailableRouteLegs=new Map();
    const providers={
      routeProvider:async (a,b) => { if (!apiAvailable) { await loadSavedWalkPaths(); if (!savedWalkOptions(a,b).length) throw Error('도보 API 연결 불가'); } try { const route=(await getRoute('walk',a,b))[0]; return {...route,points:route.points || []}; } catch (error) { if (/조회하지 못|연결하지 못|503|502|429|안전 한도|Unexpected token/.test(error.message)) apiAvailable=false; throw error; } },
      busProvider:async (a,b) => { if(!apiAvailable) return []; try{return await getRoute('transit',a,b);}catch(error){if(/조회하지 못|연결하지 못|503|502|429|안전 한도|Unexpected token/.test(error.message))apiAvailable=false;throw error;} }
    };
    if (preset) {
      const routes=await routeEngine.generateThemeDay({places:routePlaces,origin,destination,date:r.date,start:r.themeStart || '10:00',theme:r.theme,recommendationCount:10,validate:validateRoute,...providers});
      if(!routes.length) {
        const window=routeEngine.themeWindow(r.themeStart || '10:00');
        const review=await routeEngine.generateReviewRoute({places:routePlaces,origin,destination,date:r.date,start:r.themeStart || '10:00',end:window.end,theme:r.theme,validate:validateRoute,offlineOnly:!apiAvailable,...providers});
        r.review=review ? {...review,issues:['선택한 테마가 방문 수·영업시간·실제 이동 경로 확인 기준을 충족하지 않아, 가까운 장소를 검토용 초안으로 표시했습니다.',...review.issues],originPoint:origin,destinationPoint:destination,routingPlaces:routePlaces} : null;
        if(r.review) r.themeReviewOnly=true;
      }
      return routes.map((route) => ({...route,originId:origin.id,destinationId:destination.id,originPoint:origin,destinationPoint:destination,routingPlaces:routePlaces}));
    }
    const input={places:routePlaces,origin,destination,
      start:r.start,end:r.end,date:r.date,theme:'balanced',mealTimes:[],routeFocus:r.focus,
      requiredPlaceId:r.must && !r.mustOptional ? r.must : '',preferredPlaceId:r.must && r.mustOptional ? r.must : '',
      validate:validateRoute,...providers};
    const routes=await routeEngine.generateAdaptive(input);
    if(!routes.length) {
      const review=await routeEngine.generateReviewRoute({...input,offlineOnly:!apiAvailable});
      r.review=review ? {...review,originPoint:origin,destinationPoint:destination,routingPlaces:routePlaces} : null;
    }
    return routes.map((route) => ({...route,
      originId:origin.id,destinationId:destination.id,originPoint:origin,destinationPoint:destination,routingPlaces:routePlaces}));
  }
  function captureRouteInputs() {
    const r=state.route;
    r.date=$('#route-date').value || today();
    if (r.mode === 'theme') { if(activeRegion.id!=='gyeongju'){const start=$('#theme-route-start');if(start)r.themeStart=start.value;} return; }
    r.start=$('#route-start').value;
    r.end=$('#route-midnight').checked ? '24:00' : $('#route-end').value;
    r.mustOptional=$('#route-must-optional').checked;
  }
  function validateThemeVisit(place,minute,duration,date) {
    const result=evaluate({placeId:place.id,duration},minute,date);
    if (result.kind!=='ok') return {...result,kind:'bad'};
    if (place.unrestrictedAccess && (minute<7*60 || minute+duration>18*60))
      return {kind:'bad',title:'야간 산책 여건 미확인'};
    return result;
  }
  function buildGangneungReviewRoute(candidate) {
    const locations=candidate.placeIds.map(id=>{const place=getPlace(id),point=pinPoint(place);return place&&point?{...place,lat:point[0],lon:point[1]}:null;});
    if(locations.some(place=>!place)) return null;
    const legs=candidate.legs.map(leg=>leg.mode==='transit' ? {
      ...leg,mode:'transit',minutes:leg.minutes,meters:leg.meters??0,routeUrl:leg.routeUrl,buses:leg.buses,surveyed:leg.surveyed
    } : {
      ...leg,mode:'walk',minutes:leg.geometryMinutes??leg.minutes,meters:leg.geometryMeters??leg.straightLineMeters??leg.meters,actual:Boolean(leg.walkPoints?.length>1 && leg.geometrySource!=='straight-line-order-draft'),
      walkPoints:leg.walkPoints||[],geometrySource:leg.geometrySource,routeUrl:candidate.directionStatus==='straight-line-order-draft'?undefined:leg.routeUrl,surveyed:leg.surveyed
    });
    const unknownNames=candidate.unknownHoursPlaceIds.map(id=>getPlace(id)?.name).filter(Boolean);
    const issues=[
      candidate.orderStatus==='user-confirmed' ? '장소 방문 순서는 확정했습니다. 방문 시각·영업일·대기·예약 조건은 날짜별로 검증하지 않았습니다.' : '방문 시각·영업일·대기·예약 조건을 날짜별로 검증하지 않은 순서 초안입니다.',
      candidate.directionStatus==='straight-line-order-draft' ? '점선은 장소 핀 대표점 사이의 직선거리 순서를 보여줍니다. 실제 보행 가능한 길·방향·출입구는 확인하지 않았으며, 도보 시간이나 실제 거리를 뜻하지 않습니다.' : candidate.walkGeometry ? '도보 구간은 OSM 보행망 길선을 저장했습니다. 버스 구간과 핀 스냅 차이가 80m를 넘은 구간은 선을 잇지 않았습니다. 장소 대표 핀과 실제 출입구는 별도 확인이 필요합니다.' :
        '일부 구간은 네이버 조회 당시 거리·시간을 담았고, 나머지는 지도 링크에서 재확인해야 합니다. 실제 길선과 건물 출입구도 미확인입니다.'
    ];
    if(unknownNames.length)issues.push('운영시간 미확인: '+unknownNames.join(', '));
    if(!candidate.walkGeometry && candidate.directionStatus!=='straight-line-order-draft') issues.push('구간별 네이버 길찾기 링크를 제공하지만, 일부 구간만 조회 당시 거리·시간이 기록되어 있습니다. 나머지는 새로 조회해 주세요.');
    issues.push('방문 시각·운영일·예약·체류시간은 코스 전체로 맞춰 검증하지 않았습니다. 장소별 체류시간과 이동 여유를 조정해 주세요.');
    if(legs.some(leg=>leg.mode==='transit'))issues.push(legs.some(leg=>leg.mode==='transit'&&!leg.surveyed) ? '일부 대중교통 구간은 노선·승하차 위치·배차·대기시간을 확인하지 않았습니다. 지도 연결은 별도 표시를 확인해 주세요.' : '버스 노선·승하차 정류장·현재 지도 조회시간은 확인했습니다. 출발 시각별 운행·배차·대기시간은 달라질 수 있고, 버스 거리는 네이버 지도 눈금으로 추산한 값입니다. 지도 파란 점선은 실제 버스 도로 경로가 아니라 장소 사이를 잇는 표시입니다.');
    if(candidate.themeId==='cafe')issues.push('카페 전용 코스라 식사 정차는 넣지 않았습니다. 카페 주문·휴식과 이동시간은 직접 조정해야 합니다.');
    const routedWalkLegs=legs.filter(leg=>leg.mode==='walk'&&leg.actual);
    const totalWalkMeters=routedWalkLegs.reduce((sum,leg)=>sum+(leg.meters||0),0);
    const totalWalkMinutes=routedWalkLegs.reduce((sum,leg)=>sum+(leg.minutes||0),0);
    const transitSummary=legs.filter(leg=>leg.mode==='transit'&&leg.surveyed).reduce((summary,leg)=>({busDistanceMetersApprox:summary.busDistanceMetersApprox+(leg.busDistanceMetersApprox||0),busRideMinutes:summary.busRideMinutes+(leg.busRideMinutes||0),totalRouteMinutes:summary.totalRouteMinutes+(leg.totalRouteMinutes||0),accessWalkMeters:summary.accessWalkMeters+(leg.accessWalkMeters||0),egressWalkMeters:summary.egressWalkMeters+(leg.egressWalkMeters||0)}),{busDistanceMetersApprox:0,busRideMinutes:0,totalRouteMinutes:0,accessWalkMeters:0,egressWalkMeters:0});
    const naverWalkSummary=legs.filter(leg=>leg.mode==='walk'&&leg.naverMeters!=null).reduce((summary,leg)=>({meters:summary.meters+leg.naverMeters,minutes:summary.minutes+leg.naverMinutes,legs:summary.legs+1}),{meters:0,minutes:0,legs:0});
    return {id:candidate.id,title:candidate.title,orderStatus:candidate.orderStatus||null,orderConfirmedOn:candidate.orderConfirmedOn||null,planNote:candidate.planNote,mealSlots:candidate.mealSlots||{},transitLegCount:candidate.transitLegCount||0,transitSummary,naverWalkSummary,totalWalkMeters,totalWalkMinutes,unroutedWalkLegCount:legs.filter(leg=>leg.mode==='walk'&&!leg.actual).length,theme:candidate.themeId,originId:locations[0].id,destinationId:locations.at(-1).id,
      originName:locations[0].name,destinationName:locations.at(-1).name,
      originPoint:locations[0],destinationPoint:locations.at(-1),routingPlaces:locations,
      rows:locations.slice(1,-1).map((place,i)=>({placeId:place.id,stopKind:candidate.stopKinds?.[place.id],mode:legs[i].mode,
        walkEstimate:legs[i].minutes,walkMeters:legs[i].meters,minutes:legs[i].minutes,meters:legs[i].meters,
        actual:legs[i].actual,walkPoints:legs[i].walkPoints,geometrySource:legs[i].geometrySource,
        ...legs[i]})),
      endWalk:legs.at(-1),stopKinds:candidate.stopKinds||{},issues,walkGeometry:candidate.walkGeometry||null,reviewOnly:true,totalPlaceCount:locations.length,directionStatus:candidate.directionStatus};
  }
  async function buildMarketExteriorRoute(date,startTime) {
    if (weekday(date)===1 || !['11:00','11:30'].includes(startTime)) return [];
    const data=await loadMarketExteriorRoute();
    const points=data.geometry.coordinates, indices=data.geometry.stopPointIndices;
    if (indices[0]!==0 || indices.at(-1)!==points.length-1 ||
        indices.some((index,i)=>!Number.isInteger(index) || index<0 || index>=points.length || (i>0 && index<=indices[i-1]))) return [];
    const locations=data.stops.map((stop,i)=>{
      const original=getPlace(stop.id), point=points[indices[i]];
      if (!original || !point || !point.every(Number.isFinite)) throw Error('시장 코스 장소 좌표가 빠졌습니다.');
      return {...original,lat:point[1],lon:point[0],name:stop.id==='g1'?'강릉중앙시장 외곽 접근점':original.name};
    });
    const start=toMin(startTime), visitTimes=startTime==='11:00' ? [670,720,785] : [700,750,815];
    const durations=[30,60,45], kinds=['visit','meal','visit'];
    const rows=[];
    for (let i=0;i<3;i++) {
      const leg=data.legs[i], place=locations[i+1];
      const result=place.id==='g1' ? {kind:'unknown',title:'시장 점포별 운영 확인 필요'} :
        evaluate({placeId:place.id,duration:durations[i]},visitTimes[i],date);
      if (result.kind==='bad') return [];
      rows.push({placeId:place.id,minute:visitTimes[i],duration:durations[i],kind:kinds[i],
        walkEstimate:leg.minutes,walkMeters:leg.meters,actual:true,mode:'walk',
        walkPoints:points.slice(indices[i],indices[i+1]+1),
        savedPathId:data.id+'-leg-'+(i+1),savedPathLabel:'OSM 보행로 · 출입구 미확인',source:data.source,result});
    }
    const last=data.legs[3];
    const endWalk={mode:'walk',minutes:last.minutes,meters:last.meters,walkEstimate:last.minutes,walkMeters:last.meters,
      actual:true,walkPoints:points.slice(indices[3],indices[4]+1),savedPathId:data.id+'-leg-4',
      savedPathLabel:'OSM 보행로 · 출입구 미확인',source:data.source};
    const endArrival=rows.at(-1).minute+rows.at(-1).duration+last.minutes;
    return [{id:data.id,title:'코스 1 · 관아·임당·중앙시장 외곽',theme:'shops',
      start,end:endArrival,endArrival,rows,endWalk,walkMeters:data.meters,transport:'walk',
      signature:data.stops.map(s=>s.id).join(','),originId:'g27',destinationId:'g7',
      originName:locations[0].name,destinationName:locations.at(-1).name,
      originPoint:locations[0],destinationPoint:locations.at(-1),routingPlaces:locations,
      staticExteriorRoute:true,plannedMeals:[rows[1].minute],autoSchedule:true}];
  }
  let themeTimeCheckId=0;
  const themeTimeCache=new Map();
  async function refreshThemeStartTimes() {
    const checkId=++themeTimeCheckId, r=state.route;
    const select=$('#theme-route-start'), help=$('#theme-time-help'), button=$('#make-routes');
    if (!select || r.mode!=='theme') return;
    if (activeRegion.id==='gangneung' && ['food','sea','shops','cafe','history'].includes(r.theme)) {
      const referenceStart=r.theme==='cafe'?'10:00':'08:00';
      select.innerHTML='<option value="'+referenceStart+'">'+referenceStart+' (참고)</option>';
      select.value=referenceStart;r.themeStart=referenceStart;r.themeReviewOnly=true;
      select.disabled=false;button.disabled=false;button.textContent='10곳 코스 초안 보기';
      help.textContent=r.theme==='cafe'?'특색 카페 10곳의 방문 순서 초안입니다. 식당 정차는 없습니다.':'시내에서 시작해 아침·점심·저녁을 한 번씩 배치한 초안입니다. 장소 영업과 구간별 길찾기는 확인이 필요합니다.';
      return;
    }
    select.disabled=true; button.disabled=true;
    select.innerHTML='<option value="">확인 중…</option>';
    help.textContent='선택한 날짜·테마의 시작시간을 확인하고 있어요.';
    const preset=routeEngine.THEME_PRESETS[r.theme], routePlaces=routeEngine.prepareRoutePlaces(state.places);
    const origin=routeEngine.prepareRoutePlaces([getPlace(preset.originId) || STATION])[0];
    const destination=routeEngine.prepareRoutePlaces([getPlace(preset.destinationId) || STATION])[0];
    const input={places:routePlaces,origin,destination,date:$('#route-date').value || today(),theme:r.theme,
      validate:validateThemeVisit};
    const cacheKey=input.date+'|'+input.theme;
    let available=themeTimeCache.get(cacheKey);
    if (!available) {
      available=[];
      const unavailableLegs=new Map();
      const routeProvider=async (a,b) => {
        const key=[a.id,a.lat,a.lon,b.id,b.lat,b.lon].join('|');
        if(unavailableLegs.has(key)) throw unavailableLegs.get(key);
        try { return (await getRoute('walk',a,b))[0]; }
        catch (error) {
          // 한 구간의 실패로 다른 등록 장소의 저장 경로까지 차단하지 않는다.
          unavailableLegs.set(key,error);
          throw error;
        }
      };
      for (const [index,start] of routeEngine.THEME_START_TIMES.entries()) {
        if (checkId!==themeTimeCheckId) return;
        if (index%4===0) { help.textContent='시작시간 확인 중… '+(index+1)+'/'+routeEngine.THEME_START_TIMES.length; await new Promise(resolve=>setTimeout(resolve,0)); }
        if (await routeEngine.themeStartCandidate({...input,start,routeProvider,busProvider:async (a,b)=>{if(!apiAvailable)return[];try{return await getRoute('transit',a,b);}catch(error){if(/조회하지 못|연결하지 못|503|502|429|안전 한도|Unexpected token/.test(error.message))apiAvailable=false;throw error;}}})) available.push(start);
      }
      themeTimeCache.set(cacheKey,available);
    }
    if (checkId!==themeTimeCheckId || !select.isConnected) return;
    if (!available.length) {
      select.innerHTML='<option value="">가능한 시작시간 없음</option>';
      help.textContent='방문 5곳 이상을 실제 이동 경로까지 확인한 시작시간이 없습니다. 다른 날짜나 테마를 골라 주세요.';
      return;
    }
    select.innerHTML=available.map(time=>'<option value="'+time+'">'+time+'</option>').join('');
    select.value=available.includes(r.themeStart) ? r.themeStart : available[0];
    r.themeStart=select.value;
    select.disabled=false; button.disabled=false;
    help.textContent='방문 5곳 이상·실제 이동 경로 확인된 시작시간 '+available.length+'개 · 코스를 만들 때 다시 검사합니다.';
  }
  function renderRoutes() {
    state.themeCourseMap?.remove(); state.themeCourseMap=null;
    themeTimeCheckId++;
    state.resultMap?.remove(); state.resultMap=null;
    const r = state.route;
    if(activeRegion.id==='mokpo' && r.mode==='theme' && !routeEngine.THEMES.some(theme=>theme.id===r.theme && theme.id!=='balanced')) r.theme='oldtown';
    if(activeRegion.id==='gangneung' && r.mode==='theme' && !['food','sea','shops','cafe','history'].includes(r.theme)) r.theme='food';
    if(activeRegion.id==='gyeongju' && r.mode==='theme' && !GYEONGJU_THEMES.some(theme=>theme.id===r.theme)) r.theme='hwangridan';
    const endpointPlaces = routeEngine.prepareRoutePlaces(state.places).filter((p) => coord(p) && !['p41','p51'].includes(p.id));
    const options = [STATION,...endpointPlaces].map((p) => '<option value="' + esc(p.id) + '" ' + (r.origin === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const destinationOptions = [STATION,...endpointPlaces].map((p) => '<option value="' + esc(p.id) + '" ' + (r.destination === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const must = '<option value="">선택 안 함</option>' + state.places.filter((p) => coord(p) && !routeEngine.EXCLUDED_IDS.has(p.id)).map((p) => '<option value="' + esc(p.id) + '" ' + (r.must === p.id ? 'selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const routeThemeOptions=activeRegion.id==='gyeongju'?GYEONGJU_THEMES:routeEngine.THEMES;
    const themeOptions=routeThemeOptions.map((t) => '<option value="' + t.id + '" ' + (r.theme === t.id ? 'selected' : '') + '>' + t.name + '</option>').join('');
    $('#main').innerHTML = '<section class="page routes-page"><button class="back" id="routes-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">하루 동선 후보</div><h1>추천 루트</h1><p>출발지에서 도착지까지 가까운 곳을 이어 주세요. 식사는 원하는 시각에 맞춥니다.</p></div></div><div class="card"><div class="form-grid"><div class="field-group"><label class="field-label" for="route-date">날짜</label><input class="text-field" type="date" id="route-date" value="' + esc(r.date) + '"></div><div class="field-group"><label class="field-label" for="route-start">시작 시각</label><input class="text-field" type="time" id="route-start" value="' + esc(r.start) + '"></div><div class="field-group"><label class="field-label" for="route-end">끝낼 시각</label><input class="text-field" type="time" id="route-end" value="' + esc(r.end === '24:00' ? '23:59' : r.end) + '" ' + (r.end === '24:00' ? 'disabled' : '') + '><label class="check-line"><input type="checkbox" id="route-midnight" ' + (r.end === '24:00' ? 'checked' : '') + '> 자정까지</label></div></div><div class="form-grid two" style="margin-top:14px"><div class="field-group"><label class="field-label" for="route-origin">시작 위치</label><select class="select-field" id="route-origin">' + options + (r.current ? '<option value="current" ' + (r.origin === 'current' ? 'selected' : '') + '>현재 위치</option>' : '') + '</select><button class="btn btn-outline btn-sm" id="use-location" style="margin-top:8px">현재 위치 사용</button></div><div class="field-group"><label class="field-label" for="route-destination">도착 위치</label><select class="select-field" id="route-destination">' + destinationOptions + (r.current ? '<option value="current" ' + (r.destination === 'current' ? 'selected' : '') + '>현재 위치</option>' : '') + '</select></div></div><div class="form-grid two" style="margin-top:14px"><div class="field-group"><label class="field-label" for="route-theme">여행 테마</label><select class="select-field" id="route-theme">' + themeOptions + '</select></div><div class="field-group"><label class="field-label" for="route-must">꼭 가고 싶은 장소</label><select class="select-field" id="route-must">' + must + '</select></div></div><div class="form-grid meal-grid" style="margin-top:14px">' + '' + '</div><p class="small" style="margin:10px 0 0">식사 시각은 비워둘 수 있습니다. 입력한 시각에는 음식점 또는 카페만 넣습니다.</p><div class="modal-actions"><button class="btn btn-primary" id="make-routes">코스 찾기</button></div></div><div class="notice warn" style="margin-top:18px">걷기를 우선합니다. 도보로 연결하기 어려울 때만 버스를 확인합니다. 걷는 구간은 1.6km·30분, 하루 도보 합계는 8km 이내입니다. 확인되지 않은 영업시간과 추정 이동 구간은 따로 표시합니다. 케이블카를 도보 이동으로 계산하지 않습니다.</div><div id="route-results" class="route-results"></div></section>';
    setupRoutePlaceSearch('origin');
    setupRoutePlaceSearch('destination');
    setupRequiredPlaceSearch();
    $('#route-origin-query').closest('.form-grid').classList.add('route-endpoint-grid');
    $('#route-origin-query').closest('.form-grid').insertAdjacentHTML('beforebegin',
      '<div class="route-solo-control"><label class="route-solo-label" for="route-solo"><input type="checkbox" id="route-solo" ' + (r.solo ? 'checked' : '') + '> 혼자 여행</label><span class="small">1인·단품 메뉴와 직접 혼자 식사한 후기 기준 · 카페 식사는 식사 메뉴 확인</span></div>');
    $('#route-must-query').closest('.form-grid').style.gridTemplateColumns='minmax(0,1fr)';
    $('#route-end').closest('.field-group').querySelector('.field-label').textContent='끝낼 시각 (도착)';
    const mealGrid=$('.meal-grid');
    mealGrid.nextElementSibling.id='route-meal-guide';
    mealGrid.nextElementSibling.textContent='코스를 먼저 찾은 뒤, 그 길에서 들를 수 있는 식당과 식사 시각을 선택할 수 있습니다.';
    mealGrid.remove();
    $('#main .page-head h1').textContent = r.mode === 'theme' ? '테마 루트' : '추천 루트';
    $('#main .page-head p').textContent = r.mode === 'theme' ? '테마와 날짜를 고른 뒤 테마 루트 보기를 누르면 저장된 방문 순서와 지도를 확인할 수 있어요.' : '출발·도착 위치와 가고 싶은 장소를 정하세요. 끝낼 시각까지 도착하고, 식당과 방문 시각은 결과에서 직접 고릅니다.';
    const modeTabs='<div class="route-mode-tabs"><button type="button" class="filter-chip ' + (r.mode !== 'theme' ? 'active' : '') + '" data-route-mode="custom">출발·도착 맞춤</button><button type="button" class="filter-chip ' + (r.mode === 'theme' ? 'active' : '') + '" data-route-mode="theme">테마 루트</button></div>';
    const themeNotice=activeRegion.id==='gangneung' ? '요일별로 묶어 저장한 보행 길선을 확인할 수 있습니다. 운영시간과 버스 연결의 미확인 항목은 결과에 표시합니다.' : '요일별로 묶어 저장한 보행 길선을 확인할 수 있습니다. 운영시간과 현장 출입은 방문 전에 다시 확인하세요.';
    const themeCards=activeRegion.id==='gyeongju' ? (r.mode === 'theme' ? '<div class="card route-theme-panel"><p class="small">'+(activeRegion.id==='gyeongju'?'테마를 고르고 저장된 루트 초안을 바로 확인하세요.':'테마 코스는 걷기 좋은 권역의 하루 동선을 자동으로 짭니다. 방문 시간과 식사·카페 휴식도 선택한 날짜의 운영정보를 고려해 배치합니다.')+'</p><div class="route-theme-grid">' + routeThemeOptions.filter((t) => t.id !== 'balanced').map((t) => '<button type="button" class="route-theme-choice ' + (r.theme === t.id ? 'active' : '') + '" data-theme-choice="' + t.id + '" aria-pressed="' + (r.theme === t.id) + '"><strong>' + esc(t.name) + '</strong><small>' + esc(t.description||routeEngine.THEME_PRESETS[t.id].description) + '</small></button>').join('') + '</div><p class="small">선택한 코스: ' + esc(routeThemeOptions.find(t=>t.id===r.theme)?.description||routeEngine.THEME_PRESETS[r.theme]?.description||'') + '</p></div>' : '') : (r.mode === 'theme' ? '<div class="card route-theme-panel"><p class="small">'+themeNotice+'</p><div class="route-theme-grid">' + routeEngine.THEMES.filter((t) => t.id !== 'balanced').map((t) => '<button type="button" class="route-theme-choice ' + (r.theme === t.id ? 'active' : '') + '" data-theme-choice="' + t.id + '"><strong>' + esc(t.name) + '</strong><small>' + esc(routeEngine.THEME_PRESETS[t.id].description) + '</small></button>').join('') + '</div><p class="small">선택한 테마: ' + esc(routeEngine.THEME_PRESETS[r.theme]?.description || '') + '</p></div>' : '');
    $('#main .page-head').insertAdjacentHTML('afterend', modeTabs+themeCards);
    if(activeRegion.id==='gyeongju' && r.mode==='theme') {
      $('#main .page-head .eyebrow').textContent='테마별 루트 초안';
      $('#main .page-head h1').textContent='테마 루트';
      $('#main .page-head p').textContent='테마를 고르고 저장된 루트 초안을 바로 확인하세요.';
      $('[data-route-mode="theme"]').textContent='테마 루트';
    }
    if(activeRegion.id==='gangneung' && r.mode==='theme')
      $('#main .notice.warn').textContent=themeNotice;
    $('#route-theme').closest('.field-group').style.display='none';
    if (r.mode === 'theme') {
      $('#route-start').closest('.field-group').style.display='none';
      $('#route-end').closest('.field-group').style.display='none';
      $('#route-date').closest('.form-grid').style.gridTemplateColumns='minmax(0,1fr)';
      if(activeRegion.id==='gangneung'){
        $('#route-date').closest('.form-grid').insertAdjacentHTML('afterend','<p class="small" id="theme-time-help">선택한 테마의 저장된 루트 초안을 불러옵니다.</p>');
      } else if(activeRegion.id==='gyeongju') {
        const dateNotice=$('#main .notice.warn');
        dateNotice.textContent='요일별 정기휴무를 반영한 저장 루트 초안입니다. 방문 시각·임시휴무·현장 통제·버스 운행은 별도 확인하세요.';
        $('#make-routes').closest('.modal-actions').insertAdjacentElement('beforebegin',dateNotice);
        dateNotice.style.marginTop='14px';
        $('#make-routes').textContent='테마 루트 보기';
      } else if(activeRegion.id!=='mokpo') $('#route-date').closest('.field-group').insertAdjacentHTML('afterend','<div class="field-group"><label class="field-label" for="theme-route-start">시작시간</label><select class="select-field" id="theme-route-start" disabled><option value="">확인 중…</option></select><span class="small" id="theme-time-help" aria-live="polite">선택한 날짜·테마의 시작시간을 확인하고 있어요.</span></div>');
      $('#route-origin-query').closest('.form-grid').style.display='none';
      $('.route-solo-control').style.display='none';
      $('#route-must-query').closest('.form-grid').style.display='none';
      $('#route-meal-guide').style.display='none';
      if(activeRegion.id==='gangneung') $('#make-routes').textContent='테마 루트 보기';
      else if(activeRegion.id==='mokpo') {
        $('#make-routes').textContent='테마 루트 보기';
        $('#main .notice.warn').textContent='요일별 정기휴무를 반영한 저장 루트 초안입니다. 방문 시각과 임시휴무는 다시 확인하세요.';
      }
    }
    if(activeRegion.id==='gangneung' && r.mode==='theme'){
      $('#main .page-head h1').textContent='테마 루트';
      $('#main .page-head .eyebrow').textContent='테마별 루트 초안';
    }
    document.querySelectorAll('[data-route-mode]').forEach((button) => button.onclick=() => { captureRouteInputs(); r.mode=button.dataset.routeMode;r.reviewDetailsPage=false; r.results=[];r.review=null;r.reviewOptions=[]; r.selected=-1; renderRoutes(); });
    $('#route-solo').onchange=(event) => { captureRouteInputs(); r.solo=event.target.checked; r.results=[]; r.selected=-1; renderRoutes(); };
    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.onclick=() => { captureRouteInputs(); r.theme=button.dataset.themeChoice;r.reviewDetailsPage=false; r.results=[];r.review=null;r.reviewOptions=[]; r.selected=-1; renderRoutes(); });
    $('#routes-back').onclick = () => nav('region');
    $('#route-date').onchange=() => { r.date=$('#route-date').value || today(); r.results=[]; r.review=null;r.reviewOptions=[]; r.selected=-1; $('#route-results').innerHTML=''; if(r.mode==='theme' && activeRegion.id==='gangneung') refreshThemeStartTimes(); };
    $('#route-midnight').onchange = (e) => { $('#route-end').disabled=e.target.checked; };
    $('#make-routes').onclick = async () => {
      if(['mokpo','gyeongju'].includes(activeRegion.id) && r.mode==='theme') {
        captureRouteInputs();
        if(!$('#route-date').value) return toast('날짜를 선택해 주세요.');
        showSavedWeekdayRoute(r.theme);
        return;
      }
      if(activeRegion.id==='gangneung' && r.mode==='theme'){
        captureRouteInputs();
        showSavedWeekdayRoute(r.theme);
        return;
      }
      if (r.mode === 'theme') { $('#theme-course-list')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
      if (r.mode !== 'theme' && ($('#route-origin-query').value.trim() || $('#route-destination-query').value.trim() || $('#route-must-query').value.trim())) { toast('검색 결과에서 위치와 가고 싶은 장소를 선택해 주세요.'); return; }
      captureRouteInputs();
      if (r.solo && r.mode !== 'theme' && r.must && !soloTravel.canVisit(getPlace(r.must))) { toast('선택한 필수 장소는 혼자 여행 후보에서 제외됩니다. 장소를 바꾸거나 혼자 여행 체크를 해제해 주세요.'); return; }
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
      catch { r.results=[]; r.review=null; r.selected=-1; showRouteResults(); toast('경로 계산에 실패했습니다. 다시 시도해 주세요.'); }
      finally { button.disabled=false; button.textContent=r.mode === 'theme' ? '테마 루트 보기' : '코스 찾기'; }
    };
    if (activeRegion.id==='gyeongju' && r.mode==='theme') {
      const selected=GYEONGJU_THEMES.some(t=>t.id===r.theme)?r.theme:'hwangridan';
      r.theme=selected;r.results=[];r.selected=-1;
      if(new URLSearchParams(location.search).has('routepreview') && !r.previewConsumed){r.previewConsumed=true;showSavedWeekdayRoute(selected);}
    } else if (r.results.length || r.review) showRouteResults();
    if (r.mode==='theme' && r.skipThemeTimeRefreshOnce) r.skipThemeTimeRefreshOnce=false;
    else if (r.mode==='theme' && activeRegion.id==='gangneung') refreshThemeStartTimes();
  }
  function routeLegText(row) {
    const leg=row.busLeg || row;
    if(leg.mode==='bus') {
      const buses=leg.steps.filter(s=>s.type==='BUS').map(s=>(s.vehicle ? s.vehicle+(s.vehicle.endsWith('번')?'':'번')+' ' : '')+s.guidance).join(' → ');
      return (leg.savedBusId ? '버스 탑승 평균 '+leg.busRideMinutes+'분 · 계획상 총 ' : '버스 연결 ')+leg.minutes+'분 (정류장 도보 '+leg.walkMinutes+'분·추가 대기 여유 없음) · '+buses;
    }
    return '앞 장소에서 도보 '+(row.walkEstimate ?? row.minutes)+'분 / '+((row.walkMeters ?? row.meters)/1000).toFixed(2)+'km '+(row.savedPathId ? '('+(row.savedPathLabel || '미리 저장한 길')+')' : row.actual ? '(카카오 경로)' : '(보수적 추정)');
  }
  function routePathPicker(route,index) {
    const from=index ? routePlace(route.rows[index-1]?.placeId,route) : route.originPoint;
    const to=index<route.rows.length ? routePlace(route.rows[index].placeId,route) : route.destinationPoint;
    const leg=index<route.rows.length ? route.rows[index] : route.endWalk;
    if (leg.mode==='bus' || !coord(from) || !coord(to)) return '';
    const variants=savedWalkOptions(from,to);
    if (variants.length<2) return '';
    const active=leg.savedPathId || walkPathChoices.get(savedWalkPaths.choiceKey(from,to)) || variants[0].id;
    return '<div class="route-path-choice"><small>이 구간의 길 선택</small><div class="route-tabs">'+variants.map(v=>'<button type="button" class="filter-chip '+(v.id===active?'active':'')+'" data-walk-choice="'+index+'" data-walk-id="'+esc(v.id)+'" aria-pressed="'+(v.id===active)+'">'+esc(v.label)+' · '+(v.meters/1000).toFixed(2)+'km</button>').join('')+'</div><small>저장한 실제 길선으로 표시합니다. 도착 시간이 달라질 수 있습니다.</small></div>';
  }
  function routeBusAlternatives(route,index) {
    const from=index ? routePlace(route.rows[index-1]?.placeId,route) : route.originPoint;
    const to=index<route.rows.length ? routePlace(route.rows[index].placeId,route) : route.destinationPoint;
    const leg=index<route.rows.length ? route.rows[index] : route.endWalk;
    if (leg.mode==='bus' || !coord(from) || !coord(to)) return '';
    const options=savedBusLegs?.options(from,to) || [];
    if (!options.length) return '';
    return '<div class="route-path-choice"><small>이 구간의 버스 대안 · 도보와 배차 대기 별도</small>'+options.map(bus=>'<p>'+esc(bus.routeNumber)+'번 · 탑승 평균 약 '+esc(bus.averageBusRideMinutes)+'분 · '+esc(bus.boardingStop.name)+' 승차 → '+esc(bus.alightingStop.name)+' 하차'+(bus.timetable?' · <a href="'+esc(bus.timetable.url)+'" target="_blank" rel="noopener noreferrer">공식 시간표</a>':'')+(bus.serviceNotice?' · <a href="'+esc(bus.serviceNotice.url)+'" target="_blank" rel="noopener noreferrer">운행 공지</a>':'')+'</p>').join('')+'</div>';
  }
  function routeBusDetails(leg) {
    const bus=leg.busLeg || leg;
    if (bus.mode!=='bus') return '';
    const stops=bus.busStops ? '<p class="small">승차 '+esc(bus.busStops.boarding.name)+' ('+esc(bus.busStops.boarding.id)+') → 하차 '+esc(bus.busStops.alighting.name)+' ('+esc(bus.busStops.alighting.id)+')</p>' : '';
    const links=[['공식 시간표',bus.timetable],['운행 공지',bus.serviceNotice]].filter(([,item])=>item)
      .map(([label,item])=>'<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>').join(' · ');
    return stops+(links?'<p class="small">'+links+'</p>':'');
  }
  function routeSourceLinks(route) {
    const sources=[...route.rows,route.endWalk].map(leg=>leg.source).filter(Boolean);
    return [...new Map(sources.map(source=>[source.url,source])).values()]
      .map(source=>' · 길선 자료 <a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.label)+'</a>'+(source.naverUrl?' · <a href="'+esc(source.naverUrl)+'" target="_blank" rel="noopener noreferrer">네이버 길찾기 확인</a>':'')).join('');
  }
  async function chooseRoutePath(index,id) {
    const r=state.route, chosen=r.results[r.selected];
    if (!chosen) return;
    const from=index ? routePlace(chosen.rows[index-1]?.placeId,chosen) : chosen.originPoint;
    const to=index<chosen.rows.length ? routePlace(chosen.rows[index].placeId,chosen) : chosen.destinationPoint;
    if (!coord(from) || !coord(to)) return;
    const key=savedWalkPaths.choiceKey(from,to), before=walkPathChoices.get(key);
    if (before===id || (!before && savedWalkOptions(from,to)[0]?.id===id)) return;
    walkPathChoices.set(key,id);
    try {
      const checked=await routeEngine.verifyEditedRoute(chosen,{places:state.places,origin:chosen.originPoint,destination:chosen.destinationPoint,date:r.date,
        validate:(p,minute,duration,date)=>evaluate({placeId:p.id,duration},minute,date),routeProvider:confirmedWalk});
      if (!checked) throw new Error('선택한 길로는 현재 방문 시각이나 도보 제한을 지킬 수 없습니다.');
      r.results[r.selected]=checked;
      save(STORAGE_WALK_PATH_CHOICES,Object.fromEntries(walkPathChoices));
      showRouteResults();
    } catch(error) {
      if (before===undefined) walkPathChoices.delete(key); else walkPathChoices.set(key,before);
      toast(error.message || '선택한 길을 적용하지 못했습니다.');
    }
  }
  function showReviewRoute(root,review) {
    const busRideText=(value)=>{
      if(value==null) return '시간 미확인';
      const seconds=Math.round(value*60);
      return '약 '+Math.floor(seconds/60)+'분'+(seconds%60 ? ' '+seconds%60+'초' : '');
    };
    const legText=(leg)=>leg.mode==='transit' && !leg.surveyed ? '버스 경로 미확인' : leg.mode==='transit' && leg.busDistanceMetersApprox ? '버스 '+(leg.buses||'')+' · '+(leg.boardingStop?.name||'승차 정류장')+' → '+(leg.alightingStop?.name||'하차 정류장')+' · 약 '+(leg.busDistanceMetersApprox/1000).toFixed(1)+'km · 탑승 '+leg.busRideMinutes+'분' : leg.mode==='transit' ? '버스 이동 약 '+leg.minutes+'분'+(leg.buses?' · '+leg.buses:'') : leg.mode==='bus' ? '버스 탑승 '+busRideText(leg.busRideMinutes)+' · 정류장 도보 약 '+leg.walkMinutes+'분' :
      leg.geometrySource==='straight-line-order-draft' ? '핀 사이 직선 약 '+((leg.meters||0)/1000).toFixed(2)+'km · 실제 보행로·시간 미확인' :
      leg.actual && leg.walkPoints?.length>1 && leg.naverMeters!=null ? '도보 약 '+leg.minutes+'분 · '+(leg.meters/1000).toFixed(2)+'km / 지도 약 '+leg.naverMinutes+'분 · '+leg.naverMeters+'m' :
      leg.actual && leg.walkPoints?.length>1 ? '도보 약 '+leg.minutes+'분 · '+(leg.meters/1000).toFixed(2)+'km' : !leg.surveyed ? '도보 거리 미확인' : review.reviewOnly ? '도보 약 '+leg.minutes+'분 · '+(leg.meters/1000).toFixed(2)+'km' : '약 '+leg.minutes+'분 · '+(leg.meters/1000).toFixed(2)+'km';
    const straightDraft=review.directionStatus==='straight-line-order-draft';
    const confirmedOrder=review.orderStatus==='user-confirmed';
    const numberedStops=straightDraft||confirmedOrder;
    const startStop=numberedStops?'<div class="route-stop"><div class="route-stop-time">1</div><div><strong>출발 · '+(review.mealSlots?.[review.originId]?esc(review.mealSlots[review.originId]+' 식사 · '):'')+esc(review.originName)+'</strong><p>코스 시작 장소</p></div></div>':'';
    const showMapLink=review.theme!=='cafe';
    const stops=review.rows.map((row,index)=>'<div class="route-stop"><div class="route-stop-time">'+(numberedStops?index+2:index+1)+'</div><div><strong>'+(review.mealSlots?.[row.placeId]?esc(review.mealSlots[row.placeId]+' 식사 · '):row.stopKind==='take-home'?'포장해 갈 먹거리 · ':'')+esc(routePlace(row.placeId,review)?.name || '장소')+'</strong><p>앞 장소에서 '+esc(legText(row.busLeg || {...row,mode:row.mode,minutes:row.walkEstimate,meters:row.walkMeters,actual:row.actual,walkPoints:row.walkPoints,geometrySource:row.geometrySource,walkMinutes:0,busRideMinutes:row.busRideMinutes||0,buses:row.buses,surveyed:row.surveyed}))+'</p>'+(showMapLink&&row.routeUrl?'<a href="'+esc(row.routeUrl)+'" target="_blank" rel="noopener noreferrer">네이버 구간 길찾기 확인</a>':'')+'</div></div>').join('');
    const issues=review.issues.length ? review.issues.map(issue=>'<li>'+esc(issue)+'</li>').join('') : '<li>확정 코스 탐색에서 모든 이동·운영 조건을 함께 검증하지 못했습니다.</li>';
    const options=state.route.reviewOptions || [];
    const tabs=options.length>1 ? '<div class="section-label">검토용 코스 '+options.length+'개</div><div class="route-tabs">'+options.map((option,i)=>'<button class="filter-chip '+(state.route.reviewSelected===i?'active':'')+'" data-review-tab="'+i+'">'+esc(option.title)+'</button>').join('')+'</div>' : '';
    const intro=straightDraft ? '장소 '+(review.totalPlaceCount||review.rows.length+2)+'곳을 핀 간 직선거리 기준으로 이은 순서 초안입니다. 지도 점선은 실제 길이 아니며, 도보 경로와 이동시간은 아직 확인하지 않았습니다.' : confirmedOrder&&review.walkGeometry ? '장소 '+(review.totalPlaceCount||review.rows.length+2)+'곳의 방문 순서를 확정했습니다. 지도에는 저장된 GPX 보행 구간만 실선으로 표시하고, 연결 경로가 없는 구간은 잇지 않았습니다.' : review.reviewOnly ? '테마에 맞는 장소 '+(review.totalPlaceCount||review.rows.length+2)+'곳을 하나의 방문 순서로 묶은 초안입니다. 이동·영업 조건은 전체 경로로 검증되지 않았습니다.' : '가까운 장소를 방문 순서로 이은 초안입니다. 이동시간은 좌표로 계산한 참고치이며, 실제 보행 경로·버스·영업 여부를 확인한 추천 코스가 아닙니다.';
    const transitNote=review.directionStatus==='straight-line-order-draft' ? '지도 점선은 지도 핀 대표점끼리의 직선 연결입니다. 실제 보행 가능한 길·방향·출입구를 확인하지 않았으므로 길찾기 선이나 예상 보행거리로 사용하지 마세요.' : review.walkGeometry ? (review.theme==='cafe' ? '초록 실선은 OpenStreetMap 보행망 GPX입니다. 파란 점선은 버스 이동 구간의 순서를 이어 보여주는 장소 간 직선 연결로, 실제 도로를 따라가는 버스 노선 선형은 아닙니다. 노선·정류장 정보와 네이버 경로 전체 시간은 각 구간 설명에 있습니다. 버스 거리는 지도 눈금 추산이며 출발시각별 운행·배차·대기시간은 달라질 수 있습니다.' : '실선은 OpenStreetMap 보행망에서 저장한 도보 길선입니다. 버스 구간은 지도에 연결선을 그리지 않습니다. 장소 핀 스냅과 출입구·현장 통행은 별도 확인이 필요합니다.') : review.directionStatus==='mixed-review' ? '각 구간의 네이버 길찾기 링크를 열어 이동방법과 소요시간을 확인하세요. 링크 조회값이 저장된 구간과 재조회가 필요한 구간을 구분해 표시합니다.' : review.reviewOnly ? '지도 핀은 장소 대표점이며 실제 출입구와 길선은 별도 확인이 필요합니다.' : '버스 60분 기준은 탑승시간만 계산합니다. 정류장 도보·환승·실제 배차 대기는 별도입니다.';
    const totalWalkDuration=review.totalWalkMinutes>=60?Math.floor(review.totalWalkMinutes/60)+'시간 '+review.totalWalkMinutes%60+'분':review.totalWalkMinutes+'분';
    const naverWalkNote=review.naverWalkSummary?.legs?'<br><strong>네이버 도보 '+review.naverWalkSummary.legs+'구간 합계</strong> · 약 '+(review.naverWalkSummary.meters/1000).toFixed(2)+'km · 약 '+review.naverWalkSummary.minutes+'분':'';
    const busSummary=review.transitSummary?.busDistanceMetersApprox?'<br><strong>버스</strong> · 약 '+(review.transitSummary.busDistanceMetersApprox/1000).toFixed(1)+'km · 탑승 약 '+review.transitSummary.busRideMinutes+'분':'';
    const walkSummary=confirmedOrder&&review.walkGeometry?'<p class="notice"><strong>도보 거리 합계</strong> · 약 '+(review.totalWalkMeters/1000).toFixed(1)+'km · 약 '+totalWalkDuration+naverWalkNote+busSummary+'</p>':'';
    const startMeal=review.mealSlots?.[review.originId],endMeal=review.mealSlots?.[review.destinationId];
    const endStop='<div class="route-stop"><div class="route-stop-time">'+(numberedStops?(review.totalPlaceCount+' · 도착'):'도착')+'</div><div><strong>'+(endMeal?esc(endMeal+' 식사 · '):'')+esc(review.destinationName)+'</strong><p>앞 장소에서 '+esc(legText(review.endWalk))+'</p>'+(showMapLink&&review.endWalk.routeUrl?'<a href="'+esc(review.endWalk.routeUrl)+'" target="_blank" rel="noopener noreferrer">네이버 구간 길찾기 확인</a>':'')+'</div></div>';
    const geometryLinks=review.walkGeometry ? '<p class="small">파일: <a href="./'+esc(review.walkGeometry.gpx)+'" download>GPX 다운로드</a> · <a href="./'+esc(review.walkGeometry.file)+'" download>GeoJSON 다운로드</a> · © OpenStreetMap contributors</p>' : '';
    if(state.route.reviewDetailsPage){
      root.innerHTML='<div class="card route-review-details"><button type="button" class="back" id="review-details-back">← 루트로 돌아가기</button><span class="eyebrow">'+esc(review.title||'테마 루트')+'</span><h2>조사·동선 정보</h2><section><h3>초안과 순서 기준</h3><p>'+esc(intro)+'</p>'+(review.planNote?'<p class="notice">'+esc(review.planNote)+'</p>':'')+'</section><section><h3>거리·지도 표시 기준</h3><p>'+esc(transitNote)+'</p><p>표시된 도보 거리는 저장된 보행 경로 또는 지도 조회값입니다. 출입구·현장 통행, 신호 대기와 체류시간은 포함되지 않을 수 있습니다.</p></section><section><h3>확인할 점</h3><ul>'+issues+'</ul></section>'+geometryLinks+'</div>';
      $('#review-details-back').onclick=()=>{state.route.reviewDetailsPage=false;showRouteResults();$('#route-results').scrollIntoView({behavior:'smooth',block:'start'});};
      return;
    }
    const mapCaption=review.directionStatus==='straight-line-order-draft'?'번호는 방문 순서 · 점선은 핀 간 직선 참고입니다.':review.walkGeometry&&review.theme==='cafe'?'번호는 방문 순서 · 초록 선은 도보 · 파란 점선은 버스 구간 표시입니다.':review.walkGeometry?'번호는 방문 순서 · 선은 도보 구간입니다.':'번호는 방문 순서입니다.';
    root.innerHTML=tabs+'<div class="card route-review"><span class="eyebrow">'+(confirmedOrder?'장소 순서 확정':'루트 초안')+' · '+(review.totalPlaceCount||review.rows.length)+'곳</span><h2>'+esc(review.title || review.originName+' → '+review.destinationName)+'</h2>'+(review.title?'<p><strong>출발 · '+(startMeal?esc(startMeal+' 식사 · '):'')+esc(review.originName)+' → 도착 · '+(endMeal?esc(endMeal+' 식사 · '):'')+esc(review.destinationName)+'</strong></p>':'')+walkSummary+'<div class="route-result-map-wrap"><div id="route-result-map" role="img" aria-label="검토용 방문 순서 지도"></div><p class="small">'+mapCaption+'</p></div>'+startStop+stops+endStop+geometryLinks+'<button class="btn btn-outline" id="go-own-plan">내 계획 만들기</button><button type="button" class="text-button route-info-link" id="route-info-link">조사·이동 정보 자세히 보기 →</button></div>';
    root.querySelectorAll('[data-review-tab]').forEach(button=>button.onclick=()=>{state.route.reviewDetailsPage=false;state.route.reviewSelected=Number(button.dataset.reviewTab);state.route.review=options[state.route.reviewSelected];showRouteResults();});
    $('#route-info-link').onclick=()=>{state.route.reviewDetailsPage=true;showRouteResults();$('#route-results').scrollIntoView({behavior:'smooth',block:'start'});};
    if(review.theme==='shops') root.querySelector('.route-review').insertAdjacentHTML('beforeend','<button type="button" class="btn btn-outline" id="view-market-short-route">경로선 확인된 기존 시장 외곽 5곳 코스 보기</button>');
    initResultMap(review);
    $('#go-own-plan').onclick=()=>nav('plan');
    if($('#view-market-short-route')) $('#view-market-short-route').onclick=async()=>{
      const routes=await buildMarketExteriorRoute(state.route.date,'11:00');
      if(!routes.length){toast('선택한 날짜에는 기존 시장 외곽 코스를 열 수 없습니다. 월요일 휴무를 확인해 주세요.');return;}
      state.route.review=null;state.route.reviewOptions=[];state.route.results=routes;state.route.baseResults=[...routes];state.route.selected=0;showRouteResults();
    };
  }
  function showGangneungThemePlacePicks(picks) {
    const root=$('#route-results');
    state.resultMap?.remove();state.resultMap=null;
    const places=picks.placeIds.map(id=>getPlace(id)).filter(Boolean);
    const categoryName=(category)=>CATEGORIES.find(item=>item[0]===category)?.[1] || '장소';
    const list=[...places].sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(place=>
      '<div class="theme-place-pick"><strong>'+esc(place.name)+'</strong><span>'+esc(categoryName(place.category))+'</span></div>'
    ).join('');
    root.hidden=false;
    root.innerHTML='<div class="card theme-place-picks-card"><span class="eyebrow">검토용 장소 초안 · '+places.length+'곳</span><h2>'+esc(picks.title)+'</h2><p>테마에 어울리는 장소 후보만 골랐습니다. 방문 순서와 이동 경로는 아직 정하지 않았어요.</p><button type="button" class="btn btn-primary" id="show-straight-line-route">확정 방문 순서와 GPX 보기</button><div class="theme-place-picks-list">'+list+'</div><p class="small">장소 후보 미검증 초안 · 2km 권역 필터 적용 · 장소별 운영·예약·현장 출입구는 아직 확인하지 않았습니다.</p></div>';
    $('#show-straight-line-route').onclick=async()=>{const button=$('#show-straight-line-route');button.disabled=true;button.textContent='확정 방문 순서를 불러오는 중…';try{const routes=(await loadGangneungReviewRoutes()).filter(route=>route.themeId===picks.id).map(buildGangneungReviewRoute).filter(Boolean);if(!routes.length)throw Error('이 테마의 확정 방문 순서가 없습니다.');state.route.reviewDetailsPage=false;state.route.reviewOptions=routes;state.route.reviewSelected=0;state.route.review=routes[0];state.route.results=[];state.route.selected=-1;showRouteResults();}catch(error){button.disabled=false;button.textContent='확정 방문 순서와 GPX 보기';toast(error.message||'방문 순서를 불러오지 못했습니다.');}};
  }
  function showRouteResults() {
    const r = state.route, root = $('#route-results');
    state.resultMap?.remove(); state.resultMap=null;
    const chosen=r.results[r.selected];
    if(!chosen) $('.routes-page')?.classList.remove('has-route-result');
    if(!chosen && r.review) { showReviewRoute(root,r.review);return; }
    const emptyReason=r.locationMissing ? '출발 또는 도착 위치의 좌표를 확인할 수 없습니다. 위치를 다시 지정해 주세요.' : r.mode === 'theme' ? '이 시각에는 방문 5곳 이상을 실제 이동 경로까지 확인한 코스를 만들지 못했습니다. 다른 시작시간이나 날짜·테마를 선택해 주세요.' : r.must && !r.mustOptional ? '선택한 장소를 반드시 포함하면서 끝낼 시각까지 도착하는 코스를 찾지 못했습니다. 시간이나 위치를 바꾸거나, 해당 장소의 ‘루트에 꼭 넣을 필요 없음’을 체크해 다시 찾아보세요.' : '출발·도착 위치가 멀거나 도착 시각을 맞추기 어려울 수 있습니다. 도보와 확인 가능한 버스 연결로 코스를 완성하지 못했습니다. 끝낼 시각이나 도착 위치를 조정해 보세요.';
    const stops=chosen ? chosen.rows.map((x,i) => {
      const previous=chosen.rows[i-1];
      const freeMinutes=x.minute-(previous ? previous.minute+previous.duration : chosen.start)-x.walkEstimate;
      const gap=freeMinutes > 25 ? '<div class="route-gap">' + esc(hhmm(previous ? previous.minute+previous.duration : chosen.start)) + ' 이후 약 ' + freeMinutes + '분 빈 시간 · 자유롭게 보내거나 이동 여유로 사용하세요.</div>' : '';
      const stopPlace=routePlace(x.placeId,chosen), scenic=stopPlace?.shortScenicWalk;
      return gap + '<div class="route-stop"><div class="route-stop-time">' + esc(hhmm(x.minute)) + '<small>~ ' + esc(hhmm(x.minute+x.duration)) + '</small><button type="button" class="route-add-one" data-add-route-stop="' + i + '" aria-label="' + esc(stopPlace?.name) + '만 시간계획표에 넣기">+ 넣기</button></div><div><strong>' + (x.kind === 'meal' ? '식사 · ' : x.kind === 'cafe' ? '카페 휴식 · ' : '') + esc(stopPlace?.name) + '</strong><p>' + esc(x.duration) + '분 ' + (scenic?'일부 산책':'체류') + ' · ' + esc(routeLegText(x)) + '</p>' + (scenic?'<small>'+esc(scenic.label)+' · 표시점은 접근 기준이며 실제 산책길은 현장 안내를 확인하세요.</small><br>':'') + '<small>' + esc(x.result.title) + (x.result.kind === 'unknown' ? ' · 영업 확인 필요' : '') + '</small>' + routeBusDetails(x) + routePathPicker(chosen,i) + routeBusAlternatives(chosen,i) + '</div></div>';
    }).join('') : '';
    const endRow=chosen ? '<div class="route-stop"><div class="route-stop-time">' + esc(hhmm(chosen.endArrival)) + '</div><div><strong>도착 · ' + esc(chosen.destinationName) + '</strong><p>' + esc(routeLegText(chosen.endWalk)) + '</p>' + routeBusDetails(chosen.endWalk) + routePathPicker(chosen,chosen.rows.length) + routeBusAlternatives(chosen,chosen.rows.length) + '</div></div>' : '';
    const free=chosen && !chosen.autoSchedule && chosen.endArrival < chosen.end-15 ? '<div class="notice" style="margin-top:12px">' + esc(hhmm(chosen.endArrival)) + ' 도착 후 ' + esc(hhmm(chosen.end)) + '까지 자유시간입니다. 확인되지 않은 야간 영업 장소를 임의로 넣지 않았습니다.</div>' : '';
    root.innerHTML = chosen ? '<div class="section-label">추천 코스 ' + r.results.length + '개</div><div class="route-tabs">' + r.results.map((x,i) => '<button class="filter-chip ' + (i === r.selected ? 'active' : '') + '" data-route-tab="' + i + '">' + esc(x.title) + '</button>').join('') + '</div><div class="card"><p><strong>' + esc(chosen.originName) + ' ' + esc(hhmm(chosen.start)) + ' 출발 → ' + esc(chosen.destinationName) + ' ' + esc(hhmm(chosen.end)) + '까지</strong></p><p class="small">방문 ' + chosen.rows.length + '곳 · 도보 합계 약 ' + (chosen.walkMeters/1000).toFixed(2) + 'km · ' + esc(routeEngine.THEMES.find((t) => t.id === chosen.theme)?.name || '') + '</p>' + stops + endRow + free + '<p class="small" style="margin-top:14px">영업시간 미확인 장소는 방문 전 확인하세요. 주소 좌표는 건물 대표점일 수 있으며, 이동시간에 신호와 대기는 별도로 여유를 두세요.</p><button class="btn btn-primary" id="import-route">시간계획표에 넣기</button></div>' : '<div class="card empty-state"><h3>조건에 맞는 코스를 찾지 못했습니다.</h3><p>' + esc(emptyReason) + '</p><button class="btn btn-outline" id="go-own-plan">내 계획 만들기</button></div>';
    if (chosen) {
      root.querySelector('.route-tabs').insertAdjacentHTML('afterend','<div class="route-result-map-wrap"><div id="route-result-map" role="img" aria-label="추천 코스 이동 순서 지도"></div><p class="small">숫자는 방문 순서, 화살표는 이동 방향입니다. 초록 선은 도보, 파란 선은 버스 연결입니다. 점선은 경로 미확인 구간의 방향입니다. 지도 위에서 휠·두 손가락으로 확대·축소하고, 드래그로 이동할 수 있습니다.'+routeSourceLinks(chosen)+'</p></div>');
      initResultMap(chosen);
      if (chosen.staticExteriorRoute) root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend',
        '<div class="notice warn">중앙시장은 건물 밖 보행로의 접근점까지 표시합니다. 시장 내부 통로와 각 건물 출입문은 경로선에 포함되지 않았으니 현장 안내를 확인하세요. 시장 간식은 영업 중인 점포에서 자유롭게 선택할 수 있습니다. 배니닭강정 개별 정차는 포함하지 않았습니다. 관아는 출발 전에 둘러보는 일정으로 잡아 주세요.</div>');
      if(chosen.actualTimeAdjusted) root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<p class="notice">실제 도보 시간과 운영시간에 맞춰 방문 순서를 조정했어요.' + (chosen.adjustedDroppedNames?.length ? ' 시간에 맞지 않는 선택 장소(' + esc(chosen.adjustedDroppedNames.join(', ')) + ')는 제외했어요.' : ' 출발·도착과 필수 조건은 유지했어요.') + '</p>');
      if(chosen.transport==='walk-bus') root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<p class="notice">도보만으로 연결하기 어려워 버스를 포함했습니다. 버스 구간에는 추가 대기 여유를 더하지 않았습니다. 실제 배차·막차는 출발 전에 확인하세요.</p>');
      if(chosen.autoSchedule && !chosen.plannedMeals.length) root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<p class="notice">동선과 운영시간에 맞는 식사를 자동으로 넣지 못했습니다. 식사는 시간계획표에서 추가해 주세요.</p>');
      if (chosen.reverseDropped) root.querySelector('.route-result-map-wrap').insertAdjacentHTML('afterend','<div class="notice warn" style="margin-bottom:14px">반대 방향에서는 운영시간·도보 조건에 맞추기 위해 방문지 ' + chosen.reverseDropped + '곳을 제외했습니다.</div>');
      root.querySelectorAll('[data-add-route-stop]').forEach((button) => button.onclick=() => addRouteStop(chosen.rows[Number(button.dataset.addRouteStop)]));
      root.querySelectorAll('[data-walk-choice]').forEach(button=>button.onclick=()=>chooseRoutePath(Number(button.dataset.walkChoice),button.dataset.walkId));
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
          const results=(await Promise.all((await makeRoutes()).map(async base=>{
            const updated=await keepFixedRouteMeals(base,meals);
            return updated ? {...updated,mealBase:meals.length ? base : undefined,skippedMeals:chosen?.skippedMeals || {}} : null;
          }))).filter(Boolean);
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
  async function showSavedMokpoCourse(themeId) {
    const root=$('#route-results');
    if(!root || activeRegion.id!=='mokpo') return;
    state.resultMap?.remove();state.resultMap=null;
    root.hidden=false;
    root.innerHTML='<div class="card"><p>저장된 목포 테마 코스를 불러오고 있어요.</p></div>';
    try {
      const catalog=await loadThemeCourseCatalog();
      if(activeRegion.id!=='mokpo' || state.route.theme!==themeId || !root.isConnected) return;
      const course=catalog.courses.find(item=>item.theme===themeId);
      if(!course || !Array.isArray(course.stops) || !course.stops.length) throw new Error('선택한 테마의 저장 코스가 없습니다.');
      const first=course.stops[0],last=course.stops.at(-1);
      const rows=course.stops.map((stop,index)=>{
        const leg=course.legs?.[index-1];
        const movement=index===0?'코스 시작':leg?.meters!=null?'앞 장소에서 도보 약 '+leg.meters+'m · '+leg.minutes+'분':'앞 장소에서의 이동은 별도 확인 필요';
        return '<div class="route-stop"><div class="route-stop-time">'+(index+1)+'</div><div><strong>'+esc(stop.name)+'</strong><p>'+movement+(stop.arrival?' · 기본 방문 '+esc(stop.arrival):'')+'</p></div></div>';
      }).join('');
      const detailedRows=course.stops.map((stop,index)=>{
        const hours=stop.hoursReview||stop.scheduleText||'운영시간 확인 필요';
        const menu=stop.specialtyMenu?'<p>대표 메뉴 '+esc(stop.specialtyMenu)+(stop.specialtyPrice?' · '+esc(stop.specialtyPrice):'')+'</p>':'';
        return '<div class="route-stop"><div class="route-stop-time">'+(index+1)+'</div><div><strong>'+esc(stop.name)+'</strong><p>기본 방문 '+esc(stop.arrival||'시각 미확인')+'~'+esc(stop.departure||'시각 미확인')+' · '+esc(hours)+'</p>'+menu+'</div></div>';
      }).join('');
      const warnings=(course.geometryWarnings||[]).map(note=>'<p class="notice warn">'+esc(note)+'</p>').join('');
      state.mokpoCourseGuide={title:course.title,html:'<p class="notice warn">저장된 코스 초안입니다. 선택 날짜의 현장 운영·교통·입장 가능 여부는 다시 확인하세요.</p><p>'+esc(course.routeReview||'방문 전 경로와 운영정보를 확인하세요.')+'</p><p>'+esc(course.hoursReview||'운영정보를 방문 전에 확인하세요.')+'</p>'+warnings+'<section class="saved-route-itinerary" aria-label="장소별 방문 안내">'+detailedRows+'</section><p class="small">저장 길선 자료: <a href="'+esc(course.source?.url||'https://gpx.studio/')+'" target="_blank" rel="noopener noreferrer">'+esc(course.source?.label||'gpx.studio')+'</a> · 도보 거리와 시간에는 장소 체류·대기와 버스 탑승시간이 포함되지 않습니다.</p>'};
      root.classList.remove('result-list-view');
      root.innerHTML='<div class="card saved-theme-route-card"><span class="eyebrow">저장된 목포 테마 코스 초안</span><h2>'+esc(course.title)+'</h2><p class="saved-theme-route-trip"><strong>'+esc(first.name)+' → '+esc(last.name)+'</strong></p><p class="saved-theme-route-summary">기본 일정 '+esc(course.start)+'~'+esc(course.end)+' · 저장 보행선 약 '+(course.distanceMeters/1000).toFixed(2)+'km · 방문 '+course.stops.length+'곳'+(course.transitCount?' · 대중교통 '+course.transitCount+'회':'')+'</p><div class="route-result-map-wrap"><div id="route-result-map" role="img" aria-label="'+esc(course.title)+' 방문 순서와 저장 보행선 지도"></div><p class="small">번호는 방문 순서입니다. 초록 선은 저장된 보행 구간이며 버스 이동은 길선에 포함하지 않았습니다.</p></div><section class="saved-theme-route-stops" aria-label="번호별 방문 장소와 이동 거리·시간">'+rows+'</section><div class="saved-theme-route-links"><a href="#mokpo-course-guide" id="open-mokpo-course-guide">장소별 방문 안내·검증 근거 보기 →</a></div></div>';
      initSavedMokpoCourseMap(course);
      $('#open-mokpo-course-guide').onclick=event=>{event.preventDefault();nav('themeExplanation');};
    } catch(error) {
      root.innerHTML='<div class="card empty-state"><h3>저장 코스를 불러오지 못했습니다.</h3><p>'+esc(error.message||'잠시 뒤 다시 시도해 주세요.')+'</p></div>';
    }
  }
  function holidayVariantAsRoute(variant,day) {
    const stops=variant.placeIds.map(id=>{
      const place=getPlace(id),point=place&&pinPoint(place);
      if(!place || !point) throw new Error('휴일 대체 장소의 위치를 확인하지 못했습니다: '+id);
      return {placeId:id,name:place.name,category:place.category,mealRole:variant.mealSlots[id]||null,lat:point[0],lon:point[1]};
    });
    const walkLegs=new Map();
    variant.walkGroups.forEach((group,groupIndex)=>{
      const path=variant.walkPaths[groupIndex];
      group.slice(1).forEach((to,index)=>walkLegs.set(group[index]+'|'+to,{
        mode:'walk',status:'api-routed',meters:path.legMeters[index],minutes:path.legMinutes[index],
        coordinates:index===0?path.coordinates:[]
      }));
    });
    const legs=stops.slice(1).map((stop,index)=>{
      const from=stops[index].placeId,to=stop.placeId;
      const walk=walkLegs.get(from+'|'+to);
      if(walk)return walk;
      const bus=variant.transitLegs.find(item=>item.from===from && item.to===to);
      return {mode:'bus',route:bus?.route||'',busRideMinutes:bus?.minutes??null};
    });
    return {
      ...variant,holidayVariant:variant,dayNames:['일','월','화','수','목','금','토'].filter((_,index)=>index===day),
      stops,legs,walkMeters:variant.walkingMeters,walkMinutes:variant.walkingMinutes,
      busCount:legs.filter(leg=>leg.mode==='bus').length,checkedOn:variant.checkedAt,
      issues:[variant.limit,...legs.filter(leg=>leg.mode==='bus'&&!Number.isFinite(leg.busRideMinutes)).map(()=> '버스 구간의 운행과 소요시간 확인 필요')].filter(Boolean),
      excludedClosed:variant.replace?[{name:getPlace(variant.replace.from)?.name||variant.replace.from}]:[]
    };
  }
  async function showSavedWeekdayRoute(themeId) {
    const root=$('#route-results');
    if(!root) return;
    state.resultMap?.remove();state.resultMap=null;
    root.hidden=false;
    root.innerHTML='<div class="card"><p>요일별 보행 경로를 불러오고 있어요.</p></div>';
    const regionId=activeRegion.id, selectedDate=state.route.date;
    try {
      const [all,updates,holidays]=await Promise.all([loadThemeWeekdayRoutes(),loadThemeRouteUpdates(),loadHolidayThemeRoutes()]);
      if(activeRegion.id!==regionId || state.route.theme!==themeId || !root.isConnected) return;
      const day=new Date(`${selectedDate}T12:00:00`).getDay();
      if(!Number.isInteger(day)) throw new Error('날짜를 다시 선택해 주세요.');
      const changed=updates.filter(item=>item.region===regionId && item.themeId===themeId && item.weekdays.includes(day) &&
        item.validFrom<=selectedDate && selectedDate<=item.validThrough).sort((a,b)=>b.validFrom.localeCompare(a.validFrom));
      const holidayDate=selectedDate.startsWith('2026-') && (day===0 || day===6 || holidays.publicHolidays.includes(selectedDate));
      const variant=holidayDate && holidays.variants.find(item=>item.region===regionId && item.themeId===themeId && item.weekdays.includes(day));
      const route=changed[0]||(variant?holidayVariantAsRoute(variant,day):null)||all.find(item=>item.region===regionId && item.themeId===themeId && item.weekdays.includes(day));
      if(!route) throw new Error('선택한 요일의 저장 루트가 없습니다.');
      const changeSummary=route.holidayVariant?'휴일 대체: '+route.reason:route.validFrom?'장소 변경 반영: '+((route.sourceChange?.unavailablePlaceIds||[]).length?(route.sourceChange?.unavailablePlaceIds||[]).map(id=>getPlace(id)?.name||id).join(', '):'운영시간·위치 자료 변경')+
        ((route.sourceChange?.replacements||[]).length?' · 대체 '+route.sourceChange.replacements.map(item=>getPlace(item.added)?.name||item.added).join(', '):'')+' · 적용 기간 '+route.validFrom+'~'+(route.validThrough==='9999-12-31'?'별도 재개 공지 전':route.validThrough):'';
      const holidayWarning=holidayDate && !variant && !changed.length?'이 공휴일·주말에 별도 검증한 대체 루트가 없습니다. 표시된 요일별 루트의 실제 운영을 방문 전에 확인하세요.':'';
      if(route.status==='suppressed') {
        root.innerHTML='<div class="card empty-state"><h3>이 날짜의 테마 추천을 중지했습니다.</h3><p>'+esc(changeSummary)+'</p><p>방문 가능한 장소가 '+route.stops.length+'곳으로 줄었습니다. 대체 장소와 이동 경로를 재검토해야 합니다.</p><p class="notice warn">'+esc((route.issues||[]).join(' · '))+'</p></div>';
        return;
      }
      const first=route.stops[0],last=route.stops.at(-1);
      const issues=route.issues||[];
      const status=issues.length?'이 요일은 아직 추천 확정 전입니다. 아래 항목을 확인해 주세요.':'보행 길선 확인 완료 · 방문 시각과 현장 운영은 확인 필요';
      const closure=route.excludedClosed?.length?'정기휴무로 제외: '+route.excludedClosed.map(item=>item.name).join(', '):'저장 자료에서 이 요일에 제외할 정기휴무 장소가 없습니다.';
      const rows=route.stops.map((stop,index)=>{
        const leg=route.legs[index-1];
        const movement=index===0?'코스 시작':leg?.mode==='bus'?'앞 장소에서 버스 이동 · '+(leg.route?esc(leg.route)+' · ':'')+(Number.isFinite(leg.busRideMinutes)?'탑승 약 '+leg.busRideMinutes+'분':'탑승 시간 미확인')+' · 정류장 접근 도보·승하차·배차 확인 필요':leg?.status==='api-routed'?'앞 장소에서 도보 약 '+leg.meters+'m · '+leg.minutes+'분':'앞 장소에서의 보행 길선 확인 필요';
        const role={breakfast:'아침',lunch:'점심',dinner:'저녁',cafe:'카페'}[stop.mealRole]||stop.mealRole;
        return '<div class="route-stop"><div class="route-stop-time">'+(index+1)+'</div><div><strong>'+esc(stop.name)+'</strong><p>'+movement+(role?' · '+esc(role):'')+'</p></div></div>';
      }).join('');
      const guideRows=route.stops.map((stop,index)=>{
        const place=getPlace(stop.placeId);
        const menu=place?.priceInfo?'<p>'+esc(place.priceInfo.label||'대표 비용')+' · '+esc(place.priceInfo.price||'가격 확인 필요')+'</p>':'';
        const solo=place?.category==='food'&&place.soloNote?'<p>혼자 식사: '+esc(place.soloNote)+'</p>':'';
        return '<div class="route-stop"><div class="route-stop-time">'+(index+1)+'</div><div><strong>'+esc(stop.name)+'</strong><p>'+esc(place?.scheduleText||'운영시간 확인 필요')+'</p><p>'+esc(place?.closureText||'정기휴무·임시휴무 확인 필요')+'</p>'+menu+solo+'</div></div>';
      }).join('');
      const issueHtml=issues.map(issue=>'<p class="notice warn">'+esc(issue)+'</p>').join('');
      const fallbackHtml=(route.mealFallbacks||[]).map(item=>'<p class="notice warn">'+esc(route.stops.find(stop=>stop.placeId===item.placeId)?.name||'식당')+'까지 편도 '+item.minutes+'분 · '+esc(item.reason)+'</p>').join('');
      const countExceptionHtml=route.placeCountException?'<p class="notice warn">'+esc(route.stops.length)+'곳으로 저장: '+esc(route.placeCountException.reason)+'</p>':'';
      state.weekdayRouteGuide={title:route.title,html:'<p class="notice warn">'+esc(selectedDate)+' · '+esc(status)+' 방문 시각별 개점·마감, 공휴일·임시휴무, 실제 출입구는 아직 검증되지 않았습니다.</p>'+(changeSummary?'<p>'+esc(changeSummary)+'</p>':'')+(holidayWarning?'<p class="notice warn">'+esc(holidayWarning)+'</p>':'')+'<p>'+esc(closure)+'</p>'+issueHtml+fallbackHtml+countExceptionHtml+'<section class="saved-route-itinerary" aria-label="장소별 방문 안내">'+guideRows+'</section><p class="small">보행 길선: <a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener noreferrer">FOSSGIS OSRM foot</a>·OpenStreetMap, '+esc(route.checkedOn)+' 조회. 지도 선은 보행 API가 반환한 구간만 표시하며 버스·길선 미확인 구간은 연결하지 않습니다. 체류·대기·탑승시간은 도보 합계에서 제외합니다.</p>'+(route.holidayVariant?'':'<a class="btn btn-outline" href="./'+(route.validFrom?'theme-route-updates.gpx':'theme-weekday-routes.gpx')+'" download>요일별 전체 GPX 받기</a>')};
      root.classList.remove('result-list-view');
      root.innerHTML='<div class="card saved-theme-route-card"><span class="eyebrow">'+esc(selectedDate)+' · 적용 요일 '+esc(route.dayNames.join('·'))+' · '+(issues.length?'검토 중':'보행 길선 확인')+'</span><h2>'+esc(route.title)+'</h2><p class="saved-theme-route-trip"><strong>'+esc(first.name)+' → '+esc(last.name)+'</strong></p><p class="saved-theme-route-summary">보행 API 길선 약 '+(route.walkMeters/1000).toFixed(2)+'km · '+route.walkMinutes+'분 · 방문 '+route.stops.length+'곳'+(route.busCount?' · 버스 '+route.busCount+'구간':'')+'</p><p class="notice '+(issues.length?'warn':'')+'">'+esc(status)+'</p>'+(changeSummary?'<p class="notice warn">'+esc(changeSummary)+'</p>':'')+(holidayWarning?'<p class="notice warn">'+esc(holidayWarning)+'</p>':'')+'<p class="small">'+esc(closure)+'</p>'+issueHtml+fallbackHtml+countExceptionHtml+'<div class="route-result-map-wrap"><div id="route-result-map" role="img" aria-label="'+esc(route.title)+' 요일별 방문 번호와 보행 API 길선 지도"></div><p class="small">번호는 방문 순서입니다. 초록 선은 보행 API 길선이며 버스 구간은 선으로 잇지 않았습니다.</p></div><section class="saved-theme-route-stops" aria-label="번호별 방문 장소와 이동 거리·시간">'+rows+'</section><div class="saved-theme-route-links"><button type="button" class="btn btn-primary" id="import-theme-route-plan">내 계획표에 넣기</button><a href="#weekday-guide" id="open-weekday-route-guide">장소별 방문 안내·검증 근거 보기 →</a></div></div>';
      initSavedWeekdayRouteMap(route);
      $('#open-weekday-route-guide').onclick=(event)=>{event.preventDefault();nav('weekdayGuide');};
      $('#import-theme-route-plan').onclick=()=>importThemeRoutePlan(route);
    } catch(error) {
      root.innerHTML='<div class="card empty-state"><h3>요일별 저장 경로를 불러오지 못했습니다.</h3><p>'+esc(error.message||'잠시 뒤 다시 시도해 주세요.')+'</p></div>';
    }
  }
  function initSavedWeekdayRouteMap(route) {
    const element=$('#route-result-map');
    if(!window.L || !element) return;
    const map=L.map(element,{scrollWheelZoom:false,dragging:true,touchZoom:true});state.resultMap=map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const bounds=L.latLngBounds([]);
    route.legs.forEach(leg=>{
      if(leg.mode!=='walk' || !Array.isArray(leg.coordinates) || leg.coordinates.length<2) return;
      const points=leg.coordinates.map(([lon,lat])=>[lat,lon]);
      L.polyline(points,{color:'#087a61',weight:5,opacity:.88}).addTo(map);
      points.forEach(point=>bounds.extend(point));
    });
    route.stops.forEach((stop,index)=>{
      if(!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon)) return;
      const point=[stop.lat,stop.lon];bounds.extend(point);
      L.marker(point,{icon:L.divIcon({className:'route-map-pin',html:'<span>'+(index+1)+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map).bindTooltip((index+1)+'. '+stop.name);
    });
    if(bounds.isValid()) map.fitBounds(bounds,{padding:[32,32],maxZoom:15});
    setTimeout(()=>{if(state.resultMap===map)map.invalidateSize();},50);
  }
  function renderWeekdayRouteGuide() {
    const guide=state.weekdayRouteGuide;
    if(!guide){nav('routes');return;}
    $('#main').innerHTML='<section class="page routes-page saved-route-guide-page"><button class="back" id="back-to-weekday-route">← 테마 루트 지도</button><div class="page-head"><div><span class="eyebrow">요일별 테마 루트</span><h1>'+esc(guide.title)+' 방문 안내</h1><p>장소 정보와 경로 확인 범위를 살펴보세요.</p></div></div><div class="card saved-route-guide-content">'+guide.html+'</div></section>';
    $('#back-to-weekday-route').onclick=()=>{nav('routes');if(activeRegion.id!=='mokpo')showSavedWeekdayRoute(state.route.theme);};
  }
  function initSavedMokpoCourseMap(course) {
    const element=$('#route-result-map');
    if(!window.L || !element) return;
    const map=L.map(element,{scrollWheelZoom:false,dragging:true,touchZoom:true});state.resultMap=map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const bounds=L.latLngBounds([]);
    (course.coordinateSegments||[]).forEach(segment=>{
      const points=segment.map(([lon,lat])=>[lat,lon]);
      if(points.length>1) L.polyline(points,{color:'#087a61',weight:5,opacity:.88}).addTo(map);
      points.forEach(point=>bounds.extend(point));
    });
    course.stops.forEach((stop,index)=>{
      const place=getPlace(stop.placeId),point=pinPoint(place);
      if(!point) return;
      bounds.extend(point);
      L.marker(point,{icon:L.divIcon({className:'route-map-pin',html:'<span>'+(index+1)+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map).bindTooltip((index+1)+'. '+stop.name);
    });
    if(bounds.isValid()) map.fitBounds(bounds,{padding:[32,32],maxZoom:15});
    setTimeout(()=>{if(state.resultMap===map)map.invalidateSize();},50);
  }
  function renderThemeCourseExplanation() {
    const guide=state.mokpoCourseGuide;
    if(!guide){nav('routes');return;}
    $('#main').innerHTML='<section class="page routes-page saved-route-guide-page"><button class="back" id="back-to-mokpo-course">← 테마 코스 지도</button><div class="page-head"><div><span class="eyebrow">목포 테마 코스 초안</span><h1>'+esc(guide.title)+' 방문 안내</h1><p>장소 정보와 저장 경로의 확인 범위를 살펴보세요.</p></div></div><div class="card saved-route-guide-content">'+guide.html+'</div></section>';
    $('#back-to-mokpo-course').onclick=()=>nav('routes');
  }
  async function showSavedGyeongjuRoute(themeId) {
    const root=$('#route-results');
    if (!root || activeRegion.id !== 'gyeongju') return;
    state.resultMap?.remove(); state.resultMap=null;
    root.hidden=false;
    root.innerHTML='<div class="card"><p>저장된 보행 경로를 불러오고 있어요.</p></div>';
    try {
      if (!state.gyeongjuRoutes) {
        const response=await fetch('./gyeongju-six-theme-routes.geojson');
        if(!response.ok) throw new Error('저장 경로 파일을 읽지 못했습니다.');
        state.gyeongjuRoutes=await response.json();
      }
      const feature=state.gyeongjuRoutes.features.find(item=>item.properties.themeId===themeId);
      if(!feature) throw new Error('선택한 테마의 저장 경로가 없습니다.');
      const p=feature.properties;
      const mealByName=new Map((p.meals||[]).map(meal=>[meal.name,meal]));
      const visitItems=[
        ...p.stops.map(stop=>({...stop,meal:mealByName.get(stop.name)||null})),
        ...(p.meals||[]).filter(meal=>!p.stops.some(stop=>stop.name===meal.name)).map(meal=>({...meal,meal}))
      ].sort((a,b)=>a.sequence-b.sequence);
      const busBefore=p.themeId==='bulguksa'&&p.busLegs?.length>=2?new Map([[2,p.busLegs[0]],[5,p.busLegs[1]]]):new Map();
      const transitRow=leg=>'<div class="route-stop saved-route-transit-step"><div class="route-stop-time">버스</div><div><strong>'+esc(leg.from)+' → '+esc(leg.to)+'</strong><p>'+esc(leg.route)+' · 탑승 '+leg.boardings+'회'+(leg.stopCandidate?' · 정류장 후보 '+esc(leg.stopCandidate):'')+'</p><small>'+(leg.sourceUrl?'<a href="'+esc(leg.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(leg.sourceTitle||'공식 노선 안내')+'</a> · ':'')+esc(leg.scheduleStatus||'방문일 운행 확인 필요')+'</small></div></div>';
      const timelineRows=visitItems.map((item,index)=>{
        const transit=busBefore.has(item.sequence)?transitRow(busBefore.get(item.sequence)):'';
        const previous=visitItems.slice(0,index).reverse().find(entry=>p.stops.some(stop=>stop.name===entry.name));
        const leg=p.legMetrics?.find(metric=>metric.to===item.name);
        const movement=item.sequence===1?'하루 동선 시작':busBefore.has(item.sequence)?(item.sequence===2?'버스 하차 후 권역 도보 시작':'버스 복귀 후 시내 저녁'):leg?'앞 장소에서 약 '+leg.meters+'m · 도보 '+leg.minutes+'분':previous?'앞 장소에서 이어지는 이동은 별도 확인 필요':'테마 시작점';
        const meal=item.meal;
        const heading=(meal?esc(meal.slot)+' · ':'')+esc(item.name);
        const details=meal?esc(meal.placement)+' · '+esc(meal.menu||'대표 메뉴')+' · '+esc(meal.price)+'<br>'+esc(meal.locationText||'저장 장소')+' · '+esc(meal.hours):esc(item.locationText||'저장 장소')+(item.routeSnapMeters>50?' · 대표 핀에서 길선 접점 약 '+item.routeSnapMeters+'m':'')+(item.scheduleText?'<br>'+esc(item.scheduleText):'');
        return transit+'<div class="route-stop"><div class="route-stop-time">'+item.sequence+'</div><div><strong>'+heading+'</strong><p>'+movement+'</p><small>'+details+'</small></div></div>';
      }).join('');
      const compactRows=visitItems.map((item,index)=>{
        const bus=busBefore.has(item.sequence)?busBefore.get(item.sequence):null;
        const transit=bus?'<div class="route-stop saved-route-transit-step"><div class="route-stop-time">버스</div><div><strong>'+esc(bus.from)+' → '+esc(bus.to)+'</strong><p>'+esc(bus.route)+' · 이동시간·승차 정류장 미확인</p></div></div>':'';
        const leg=p.legMetrics?.find(metric=>metric.to===item.name);
        const movement=index===0?'코스 출발':bus?'버스 하차 후 방문':leg?'앞 장소에서 도보 '+leg.meters+'m · 약 '+leg.minutes+'분':'앞 장소에서의 이동 거리·시간 미확인';
        const heading=(item.meal?esc(item.meal.slot)+' · ':'')+esc(item.name);
        return transit+'<div class="route-stop"><div class="route-stop-time">'+item.sequence+'</div><div><strong>'+heading+'</strong><p>'+movement+'</p></div></div>';
      }).join('');
      const offsetNote=p.maxPlaceSnapMeters>100?'<p class="notice warn">일부 장소 좌표는 권역 대표 핀이에요. 보행 길선과의 연결점은 가장 멀리 '+p.maxPlaceSnapMeters+'m 떨어져 있어 실제 출입구와 산책로 진입 위치를 현장에서 확인해 주세요.</p>':'';
      const accessNotes=(p.unverifiedAccess||[]).map(item=>'<p class="notice warn">미확인 보행 연결 · '+esc(item.placeName)+' 대표 핀과 보행망 접점이 약 '+item.gapMeters+'m 떨어져 있어요. 실제 출입구와 사이 길은 확인하지 못했으며 지도 선은 그 구간을 연결하지 않습니다.</p>').join('');
      const walkingSource=p.walkingProvider==='fossgis-osrm-foot'?'<a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener noreferrer">OpenStreetMap FOSSGIS 보행망</a>':'<a href="https://gpx.studio/" target="_blank" rel="noopener noreferrer">gpx.studio GraphHopper 보행 경로</a>';
      const optional=(p.optionalVisitNotes||[]).map(note=>'<p class="notice warn">'+esc(note)+'</p>').join('');
      const routeMapCaption='번호는 방문 순서입니다. 초록 선은 확인된 보행 구간이며 버스 이동은 선으로 잇지 않았습니다.';
      const routeFlowNote=p.routeFlowNote?'<p class="notice">'+esc(p.routeFlowNote)+'</p>':'';
      const description=GYEONGJU_THEMES.find(theme=>theme.id===themeId)?.description||'';
      const first=visitItems[0]?.name||'출발지 미확인', last=visitItems.at(-1)?.name||'도착지 미확인';
      const busText=p.busRides?' · 버스 '+p.busRides+'회':' · 버스 없음';
      const dateNotice='선택한 날짜 '+esc(state.route.date)+' · 날짜별 운영시간·버스 운행은 아직 검증되지 않은 저장 루트 초안입니다.';
      state.gyeongjuRouteGuide={title:p.title,html:'<p class="notice warn">'+dateNotice+'</p><p>기본 출발 '+esc(p.startTime||'10:00')+' · '+esc(p.originArea||'경주 시내 숙소권')+'</p><p>테마 후보 '+(p.placePoolCount||p.stopCount)+'곳 중 방문 '+p.stopCount+'곳 · 카페 '+p.cafeCount+'곳 · 도보 '+(p.walkingDistanceMeters/1000).toFixed(2)+'km'+busText+'</p>'+routeFlowNote+'<p>'+esc(p.breakfastRule||'09:00 이전 출발이면 시내에서 아침 식사 후 합류')+'</p><section class="saved-route-itinerary" aria-label="장소별 상세 방문 안내">'+timelineRows+'</section>'+offsetNote+accessNotes+optional+'<p class="small saved-route-source">도보 이동 약 '+p.walkingMinutes+'분 · 확인 '+esc(p.checkedAt)+' · '+walkingSource+' · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. 버스 구간과 방문·식사 체류시간은 도보 시간에 포함하지 않습니다. 운영시간·현장 통제·귀환 교통은 방문일에 확인하세요.</p><a class="btn btn-outline" href="./gyeongju-six-theme-routes.gpx" download>보행 구간 GPX 받기</a>'};
      root.classList.remove('result-list-view');
      $('.routes-page')?.classList.remove('has-route-result');
      root.innerHTML='<div class="card saved-theme-route-card"><span class="eyebrow">저장된 테마 루트 초안</span><h2>'+esc(p.title)+'</h2><p class="saved-theme-route-description">'+esc(description)+'</p><p class="saved-theme-route-trip"><strong>'+esc(first)+' → '+esc(last)+'</strong></p><p class="saved-theme-route-summary">기본 출발 '+esc(p.startTime||'10:00')+' · 도보 거리 합계(확인 구간) 약 '+(p.walkingDistanceMeters/1000).toFixed(2)+'km · 방문 '+p.stopCount+'곳'+busText+'</p><div class="route-result-map-wrap"><div id="route-result-map" role="img" aria-label="'+esc(p.title)+' 번호 방문 핀과 확인된 보행 구간 지도"></div><p class="small">'+routeMapCaption+'</p></div><section class="saved-theme-route-stops" aria-label="번호별 방문 장소와 이동 거리·시간">'+compactRows+'</section><div class="saved-theme-route-links"><a href="#route-guide" id="open-gyeongju-route-guide">장소별 방문 안내·검증 근거 보기 →</a></div></div>';
      initSavedGyeongjuRouteMap(feature,[]);
      $('#open-gyeongju-route-guide').onclick=(event)=>{event.preventDefault();nav('routeGuide');};
    } catch(error) {
      root.innerHTML='<div class="card empty-state"><h3>저장 경로를 불러오지 못했습니다.</h3><p>'+esc(error.message||'잠시 뒤 다시 시도해 주세요.')+'</p></div>';
    }
  }
  function renderGyeongjuRouteGuide() {
    const guide=state.gyeongjuRouteGuide;
    if(!guide){nav('routes');return;}
    $('#main').innerHTML='<section class="page routes-page saved-route-guide-page"><button class="back" id="back-to-gyeongju-route">← 테마 루트 지도</button><div class="page-head"><div><span class="eyebrow">경주 테마 루트 초안</span><h1>'+esc(guide.title)+' 방문 안내</h1><p>장소 정보와 경로 검증 근거를 확인하세요.</p></div></div><div class="card saved-route-guide-content">'+guide.html+'</div></section>';
    $('#back-to-gyeongju-route').onclick=()=>{state.route.previewConsumed=true;nav('routes');showSavedGyeongjuRoute(state.route.theme);};
  }
  function initSavedGyeongjuRouteMap(feature,draftFeatures=[]) {
    const mapElement=$('#route-result-map');
    if(!window.L||!mapElement) return;
    const map=L.map(mapElement,{scrollWheelZoom:false,dragging:true,touchZoom:true});state.resultMap=map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const lineGroups=feature.geometry.type==='MultiLineString'?feature.geometry.coordinates:[feature.geometry.coordinates];
    const bounds=L.latLngBounds([]);
    lineGroups.forEach(group=>{const coords=group.map(([lon,lat])=>[lat,lon]);L.polyline(coords,{color:'#087a61',weight:5,opacity:.88}).addTo(map);coords.forEach(point=>bounds.extend(point));});
    const draftLayer=L.layerGroup();
    draftFeatures.forEach(item=>{
      const [lon,lat]=item.geometry.coordinates,point=[lat,lon];bounds.extend(point);
      L.marker(point,{icon:L.divIcon({className:'theme-draft-map-pin',html:'<span aria-hidden="true"></span>',iconSize:[18,18],iconAnchor:[9,9]})})
        .bindTooltip(item.properties.name,{direction:'top',offset:[0,-8]})
        .bindPopup('<strong>'+esc(item.properties.name)+'</strong><br><small>'+esc(item.properties.themeName)+' · 초안 후보</small>')
        .addTo(draftLayer);
    });
    draftLayer.addTo(map);map._themeDraftLayer=draftLayer;
    feature.properties.stops.forEach(stop=>{
      const point=[stop.lat,stop.lon];bounds.extend(point);
      L.marker(point,{icon:L.divIcon({className:'route-map-pin',html:'<span>'+stop.sequence+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map).bindTooltip(stop.sequence+'. '+stop.name);
    });
    (feature.properties.meals||[]).filter(meal=>meal.mapPin&&Number.isFinite(meal.lat)&&Number.isFinite(meal.lon)).forEach(meal=>{
      const point=[meal.lat,meal.lon];bounds.extend(point);
      const label=(meal.slot==='점심'?'점심':'저녁')+' · '+meal.name;
      L.marker(point,{icon:L.divIcon({className:'route-map-pin route-map-pin--meal',html:'<span>'+meal.sequence+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map).bindTooltip(meal.sequence+'. '+label);
    });
    map.fitBounds(bounds,{padding:[32,32],maxZoom:15});
    setTimeout(()=>{if(state.resultMap===map)map.invalidateSize();},50);
  }
  function presentRouteResult(chosen) {
    const root=$('#route-results'), page=$('.routes-page'), r=state.route;
    const wasResult=page.classList.contains('has-route-result');
    page.classList.add('has-route-result');root.hidden=false;if(!wasResult)window.scrollTo(0,0);
    const itinerary=root.querySelector('.card');itinerary?.classList.add('route-itinerary');
    const elapsed=chosen.endArrival-chosen.start;
    root.insertAdjacentHTML('afterbegin',`<div class="route-overview-heading"><button class="round-control" id="edit-route-conditions" aria-label="추천 조건으로 돌아가기">${uiIcon('back')}</button><div><span class="eyebrow">나의 ${esc(activeRegion.name)} 하루</span><h1>${esc(chosen.title)}</h1></div></div><div class="result-view-switch view-switch" aria-label="추천 코스 보기"><button data-result-view="map">지도</button><button data-result-view="list">방문 순서</button></div>`);
    root.querySelector('.route-result-map-wrap')?.insertAdjacentHTML('afterend',`<div class="route-overview-stats"><div><small>도보 거리</small><strong>${(chosen.walkMeters/1000).toFixed(2)}<span> km</span></strong></div><div><small>예상 일정</small><strong>${Math.floor(elapsed/60)}<span>시간 ${elapsed%60?elapsed%60+'분':''}</span></strong></div><div><small>방문 장소</small><strong>${chosen.rows.length}<span>곳</span></strong></div></div>`);
    const sync=()=>{const list=r.presentation==='list';root.classList.toggle('result-list-view',list);root.querySelectorAll('[data-result-view]').forEach(b=>{const active=b.dataset.resultView===(list?'list':'map');b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});if(!list)requestAnimationFrame(()=>state.resultMap?.invalidateSize());};
    $('#edit-route-conditions').onclick=()=>{state.resultMap?.remove();state.resultMap=null;page.classList.remove('has-route-result');root.hidden=true;window.scrollTo(0,0);};
    root.querySelectorAll('[data-result-view]').forEach(b=>b.onclick=()=>{r.presentation=b.dataset.resultView;sync();});
    sync();
  }
  function initResultMap(route) {
    const mapElement=$('#route-result-map');
    if (!window.L || !mapElement) return;
    const stops=[route.originPoint,...route.rows.map((row) => routePlace(row.placeId,route)),route.destinationPoint];
    if (stops.some((place) => !coord(place))) return;
    const map=L.map(mapElement,{scrollWheelZoom:false,dragging:true,touchZoom:true}); state.resultMap=map;
    // Handle wheel input directly so embedded browsers use the same zoom gesture as desktop browsers.
    let wheelTotal=0, wheelPoint=null, wheelTimer=null;
    const applyWheelZoom=() => {
      wheelTimer=null;
      if (state.resultMap !== map || !wheelTotal) return;
      const steps=Math.max(1,Math.min(3,Math.round(Math.abs(wheelTotal)/100)));
      map.setZoomAround(wheelPoint,map.getZoom()+(wheelTotal<0 ? steps : -steps));
      wheelTotal=0;
    };
    const onWheel=(event) => {
      if (!event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      wheelPoint=map.mouseEventToContainerPoint(event);
      wheelTotal+=event.deltaY*(event.deltaMode===1 ? 16 : event.deltaMode===2 ? mapElement.clientHeight : 1);
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer=setTimeout(applyWheelZoom,45);
    };
    mapElement.addEventListener('wheel',onWheel,{capture:true,passive:false});
    map.on('unload',() => {
      mapElement.removeEventListener('wheel',onWheel,true);
      if (wheelTimer) clearTimeout(wheelTimer);
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const bounds=L.latLngBounds([]);
    const roundTrip=routeEngine.distanceKm(route.originPoint,route.destinationPoint) < .015;
    stops.forEach((place,index) => {
      const point=[place.lat,place.lon]; bounds.extend(point);
      if (isLodgingPoint(place)) return;
      if (roundTrip && (index === 0 || index === stops.length-1)) return;
      const label=route.directionStatus==='straight-line-order-draft'||route.orderStatus==='user-confirmed' ? String(index+1) : index === 0 ? '출발' : index === stops.length-1 ? '도착' : String(index);
      L.marker(point,{icon:L.divIcon({className:'route-map-pin',html:'<span>' + label + '</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map).bindTooltip(place.name || label);
    });
    if (roundTrip && !isLodgingPoint(route.originPoint)) {
      const place=route.originPoint;
      L.marker([place.lat,place.lon],{icon:L.divIcon({className:'route-map-pin route-map-pin--home',html:'<span>출·도착</span>',iconSize:[54,30],iconAnchor:[27,15]})}).addTo(map).bindTooltip(place.name || '출발·도착');
    }
    for (let i=0;i<stops.length-1;i++) {
      const leg=i<route.rows.length ? route.rows[i] : route.endWalk;
      const bus=leg.busLeg || leg;
      if (bus.busStops) for (const [label,stop] of [['승차',bus.busStops.boarding],['하차',bus.busStops.alighting]]) {
        const point=[stop.lat,stop.lon]; bounds.extend(point);
        L.circleMarker(point,{radius:7,color:'#c36b2e'}).addTo(map).bindTooltip(label+' · '+stop.name);
      }
      const points=leg.walkPoints || leg.points || [];
      const busConnector=route.reviewOnly&&route.theme==='cafe'&&leg.mode==='transit';
      if (route.reviewOnly && points.length < 2 && !busConnector) continue;
      const path=points.length > 1 ? points.map(([lon,lat]) => [lat,lon]) : [[stops[i].lat,stops[i].lon],[stops[i+1].lat,stops[i+1].lon]];
      const line=L.polyline(path,{color:busConnector||leg.mode==='bus' ? '#2864c8' : leg.actual && points.length>1 ? '#087a61' : '#6c8290',weight:busConnector?5:4,opacity:.9,dashArray:busConnector?'9,8':leg.actual && points.length>1 ? null : '6,7'}).addTo(map);
      if(busConnector) line.bindTooltip('버스 '+(leg.buses||'')+' · 장소 간 연결 표시, 실제 노선 형상 미표시');
      bounds.extend(line.getBounds());
      const pointIndex=Math.floor((path.length-1)/2), from=path[pointIndex], to=path[pointIndex+1];
      const middle=[(from[0]+to[0])/2,(from[1]+to[1])/2];
      const angle=Math.atan2(-(to[0]-from[0]),(to[1]-from[1])*Math.cos(from[0]*Math.PI/180))*180/Math.PI;
      L.marker(middle,{interactive:false,icon:L.divIcon({className:'route-map-arrow'+(busConnector?' route-map-arrow--bus':''),html:'<span style="transform:rotate(' + angle + 'deg)">➜</span>',iconSize:[25,25],iconAnchor:[12,12]})}).addTo(map);
      if(busConnector) L.marker([middle[0]+(i%2===0?0.0012:-0.0012),middle[1]],{interactive:false,icon:L.divIcon({className:'route-map-bus-label',html:'🚌 '+esc(leg.buses||'버스')+' · 약 '+(leg.busDistanceMetersApprox/1000).toFixed(1)+'km',iconSize:[108,24],iconAnchor:[54,12]})}).addTo(map);
    }
    map.fitBounds(bounds,{padding:[35,35],maxZoom:15});
    setTimeout(() => { if (state.resultMap === map) map.invalidateSize(); },50);
  }
  async function confirmedWalk(a,b) {
    const leg=(await getRoute('walk',a,b))[0];
    return {...leg,points:leg.points || []};
  }
  async function reverseSelectedRoute() {
    const r=state.route, chosen=r.results[r.selected], original=r.baseResults[r.selected];
    if (!chosen || !original) return;
    if (chosen.reversed) {
      try {
        const restored=await keepFixedRouteMeals(original,chosen.chosenMeals || []);
        if(!restored) return toast('선택한 식사 시각을 지키면서 원래 방향으로 돌아갈 수 없습니다.');
        r.results[r.selected]={...restored,mealBase:original,skippedMeals:chosen.skippedMeals};showRouteResults();
      } catch { toast('원래 방향의 식사 경로를 다시 확인하지 못했습니다.'); }
      return;
    }
    const button=$('#reverse-route'); button.disabled=true; button.textContent='방향 계산 중…';
    try {
      const reversed=await routeEngine.reverseRoundTrip({route:original,places:state.places,origin:original.originPoint,date:r.date,
        requiredPlaceId:r.must && !r.mustOptional ? r.must : '',
        routeProvider:confirmedWalk,
        validate:(place,minute,duration,date) => evaluate({placeId:place.id,duration},minute,date)});
      if (!reversed) return toast('반대 방향은 운영시간·도보 거리·도착 시각을 함께 맞추지 못했습니다.');
      const withMeals=await keepFixedRouteMeals(reversed,chosen.chosenMeals || []);
      if(!withMeals) return toast('선택한 식사 시각을 지키는 반대 방향 코스를 찾지 못해 현재 코스를 유지합니다.');
      r.results[r.selected]={...withMeals,mealBase:reversed,skippedMeals:chosen.skippedMeals};showRouteResults();
    } catch { toast('반대 방향 계산에 실패했습니다. 다시 시도해 주세요.'); }
    finally { if (button.isConnected) { button.disabled=false; button.textContent='↶ 반대 방향'; } }
  }
  async function keepFixedRouteMeals(route,meals) {
    if(!meals.length) return route;
    const context={places:state.places,origin:route.originPoint,destination:route.destinationPoint,
      date:state.route.date,requiredPlaceId:state.route.must && !state.route.mustOptional ? state.route.must : '',
      validate:(p,minute,duration,date)=>evaluate({placeId:p.id,duration},minute,date)};
    const restored=routeEngine.restoreFixedMeals(route,meals,context);
    return restored ? routeEngine.verifyEditedRoute(restored,{...context,theme:route.theme,routeProvider:confirmedWalk}) : null;
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
        destination:chosen.destinationPoint,date:r.date,validate:validateRoute,requiredPlaceId:r.must && !r.mustOptional ? r.must : '',kind,
        candidateFilter:r.solo && r.mode !== 'theme' ? soloTravel.canEat : undefined,
        mealDuration:r.solo && r.mode !== 'theme' && kind === 'cafe' ? 60 : undefined}));
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
      const place=getPlace(choice.placeId);
      const soloNote=place?.soloResearch ? soloTravel.evidenceLevel(place) + ' · 현행 주문 조건 방문 전 확인' : choice.kind === 'cafe' ? '식사 메뉴·주문 가능 시간 방문 전 확인' :
        place?.soloVerdict === 'specific_menu' && place.soloMenu ? '1인 메뉴: ' + place.soloMenu + ' · 방문 전 확인' : '1인 주문 가능 여부 방문 전 확인';
      return '<form class="route-meal-option" data-meal-index="' + i + '"><div class="route-meal-title"><strong>' + esc(choice.placeName) +
        '</strong><span class="route-meal-type">' + (choice.kind === 'cafe' ? '카페' : '음식점') + '</span></div>' +
        '<p class="route-meal-time-label">추천 시각 <strong>' + esc(hhmm(slot.minute)) + '</strong>' +
          (slot.replaceName || slot.preview.droppedVisits ? ' · 방문 변경' : ' · 기존 방문 유지') + '</p>' +
        (r.solo && r.mode !== 'theme' ? '<small>' + esc(soloNote) + '</small>' : '') +
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
      const selectedIndex=r.selected;
      const apply=async () => {
        const button=$('#confirm-route-meal') || form.querySelector('button[type="submit"]');
        const label=button?.textContent;
        if(button) {button.disabled=true;button.textContent='이동 확인 중…';}
        const updated=routeEngine.addMeal(chosen,option);
        updated.chosenMeals=updated.chosenMeals.map((meal,i) => i === updated.chosenMeals.length-1 ? {...meal,period:period.id} : meal);
        try {
          const checked=await routeEngine.verifyEditedRoute(updated,{places:state.places,origin:chosen.originPoint,
            destination:chosen.destinationPoint,date:r.date,theme:chosen.theme,
            requiredPlaceId:r.must && !r.mustOptional ? r.must : '',
            validate:(p,minute,duration,date)=>evaluate({placeId:p.id,duration},minute,date),routeProvider:confirmedWalk});
          if(r.results[selectedIndex]!==chosen) return;
          closeModal();
          if(!checked) return toast('선택한 식사 시각과 실제 이동 경로를 함께 맞추지 못했습니다. 현재 코스를 유지합니다.');
          r.results[selectedIndex]={...checked,mealBase:chosen.mealBase || chosen};showRouteResults();
        } catch {closeModal();toast('식사 장소까지의 실제 이동 경로를 확인하지 못해 현재 코스를 유지합니다.');}
        finally {if(button?.isConnected) {button.disabled=false;button.textContent=label;}}
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
      const minute=row.minute, entry={placeId:row.placeId,duration:row.duration,memo:row.mode==='bus' ? routeLegText(row) : row.kind === 'meal' ? '추천 코스의 식사' : row.kind === 'snack' ? '추천 코스의 간식' : row.kind === 'cafe' ? '추천 코스의 카페 휴식' : ''};
    const d=state.draft, end=routeEngine.minutes(d.end || '24:00');
    const conflict=planConflict(minute,entry), outside=minute < toMin(d.start) || minute+entry.duration > end, otherDate=d.date !== state.route.date;
    if (conflict || outside || otherDate) {
      const reason=conflict ? esc(hhmm(Number(conflict[0]))) + '에 ' + esc(entryLabel(conflict[1])) + ' 일정이 있습니다.' : otherDate ? '현재 계획표와 추천 코스의 날짜가 다릅니다.' : '추천 시각이 현재 계획표의 시작·종료 범위 밖입니다.';
      openModal('<h2>보류 상태로 둘까요?</h2><p><strong>' + esc(entryLabel(entry)) + '</strong> · 추천 ' + esc(hhmm(minute)) + '</p><p>' + reason + ' 기존 계획은 유지하고, 보류 목록에서 빈 시각을 정할 수 있습니다.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="hold-route-stop">보류에 담기</button></div>', () => { $('#hold-route-stop').onclick=() => holdRouteStop(minute,entry,state.route.date); });
      return;
    }
    confirmPlaceReservation([getPlace(entry.placeId)], () => { d.entries[minute]=entry; persistDraft(); toast(entryLabel(entry) + '을(를) ' + hhmm(minute) + ' 계획표에 넣었습니다.'); });
  }
  function applyPending(index) {
    const d=state.draft, item=d.pending?.[index]; if (!item) return;
    const value=document.querySelector('[data-pending-time="' + index + '"]')?.value;
    if (!value) return toast('넣을 시각을 선택해 주세요.');
    const minute=toMin(value), end=routeEngine.minutes(d.end || '24:00');
    if (minute < toMin(d.start) || minute+item.entry.duration > end) return toast('계획표의 시작·종료 시각 안으로 정해 주세요.');
    if (planConflict(minute,item.entry)) return toast('기존 일정과 시간이 겹칩니다. 빈 시각을 선택해 주세요.');
    if (evaluate(item.entry,minute,d.date).kind === 'bad') return toast('선택한 날짜·시각에는 방문이 어려운 장소입니다. 다른 시각을 골라 주세요.');
    confirmPlaceReservation([getPlace(item.entry.placeId)], () => { d.entries[minute]=item.entry; d.pending.splice(index,1); persistDraft(); renderPlan(); toast('보류 장소를 계획표에 넣었습니다.'); });
  }
    function importThemeRoutePlan(route) {
      const places=route.stops.map(stop=>getPlace(stop.placeId));
      if(!places.length || places.some(place=>!place))return toast('계획표에 넣을 장소 정보를 확인하지 못했습니다.');
      const entries={};let next=toMin(route.start||'10:00');
      for(const [index,stop] of route.stops.entries()) {
        const leg=route.legs[index-1];
        if(index)next+=leg?.mode==='bus' ? Math.max(35,Number(leg.busRideMinutes)||35) : Math.max(10,Number(leg?.minutes)||15);
        if(stop.mealRole==='lunch')next=Math.max(next,11*60+30);
        if(stop.mealRole==='dinner')next=Math.max(next,17*60);
        const duration=stop.category==='food'?45:stop.category==='cafe'?30:35;
        if(next+duration>1440)return toast('기본 방문 시각이 자정을 넘습니다. 루트의 장소 수와 시간을 확인해 주세요.');
        entries[next]={placeId:stop.placeId,duration,memo:'테마 루트 기본 시각 · 방문 전 운영·이동 확인'};
        next+=duration;
      }
      openModal('<h2>내 계획표에 넣을까요?</h2><p>'+esc(route.title)+' · '+places.length+'곳</p><p>현재 편집 중인 계획은 이 테마 루트로 바뀝니다. 기본 방문 시각과 체류시간은 계획표에서 수정할 수 있습니다. 선택한 날짜의 운영·교통은 방문 전 확인해 주세요.</p><div class="modal-actions"><button type="button" class="btn btn-outline" data-close>취소</button><button type="button" class="btn btn-primary" id="confirm-theme-import">넣기</button></div>',()=>{
        $('#confirm-theme-import').onclick=()=>confirmPlaceReservation(places,()=>{
          state.draft={id:null,title:route.title,date:state.route.date,start:hhmm(Number(Object.keys(entries)[0])),end:'24:00',origin:null,theme:route.themeId,mealTimes:[],solo:false,entries,pending:[]};
          persistDraft();closeModal();nav('plan');
        });
      });
    }
    function importRoute() {
    const chosen = state.route.results[state.route.selected]; if (!chosen) return;
    openModal('<h2>시간계획표에 넣으시겠습니까?</h2><p>' + esc(chosen.title) + '</p><p>현재 편집 중인 계획은 새 코스로 바뀝니다. 저장이 필요하면 먼저 계획 화면에서 저장해 주세요.</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-primary" id="confirm-import">넣기</button></div>', () => {
      $('#confirm-import').onclick = () => confirmPlaceReservation(chosen.rows.map(x=>getPlace(x.placeId)), () => { const entries = {}; chosen.rows.forEach((x) => { entries[x.minute] = {placeId:x.placeId,duration:x.duration,memo:x.mode==='bus' ? routeLegText(x) : x.kind === 'meal' ? (chosen.autoSchedule ? '자동 배치한 식사' : '선택한 식사시간') : x.kind === 'snack' ? '추천 코스의 간식' : x.kind === 'cafe' ? '선택한 카페 휴식' : ''}; }); if(chosen.endWalk.mode==='bus') { const last=entries[chosen.rows.at(-1).minute]; last.memo=[last.memo,'방문 후 도착지로 '+routeLegText(chosen.endWalk)].filter(Boolean).join(' · '); } state.draft = {id:null,title:chosen.title,date:state.route.date,start:chosen.autoSchedule ? hhmm(chosen.start) : state.route.start,end:chosen.autoSchedule ? hhmm(chosen.end) : state.route.end,origin:chosen.originId,destination:chosen.destinationId,currentOrigin:chosen.originId === 'current' ? chosen.originPoint : null,customOrigin:(chosen.originId === 'custom' || chosen.originId?.startsWith('lodging-')) ? chosen.originPoint : null,customDestination:(chosen.destinationId === 'custom' || chosen.destinationId?.startsWith('lodging-')) ? chosen.destinationPoint : null,theme:chosen.theme,mealTimes:(chosen.autoSchedule ? chosen.plannedMeals.map(hhmm) : chosen.rows.filter((row) => row.kind === 'meal').map((row) => hhmm(row.minute))),entries,pending:[]}; persistDraft(); closeModal(); nav('plan'); });
    });
  }
  function showJourney(minute) {
    const entry = state.draft.entries[minute]; if (!entry) return;
    const earlier = Object.entries(state.draft.entries).map(([m,e]) => [Number(m),e]).filter(([m]) => m < minute).sort((a,b) => b[0]-a[0])[0];
    const origin = earlier ? entryCoord(earlier[1]) : (state.draft.origin === 'current' ? (state.draft.currentOrigin || STATION) : state.draft.origin === 'custom' ? (state.draft.customOrigin || STATION) : (state.draft.customOrigin?.id === state.draft.origin ? state.draft.customOrigin : getPlace(state.draft.origin) || STATION));
    const target = entryCoord(entry);
    const now = new Date(); const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const direct = km(origin,target); const walk = direct == null ? null : Math.max(10,Math.ceil(direct*1.4/4*60/5)*5);
    const arrival = nowMinutes + (walk || 0);
    state.journey = {minute, origin, target, walk, direct, arrival, result:evaluate(entry,arrival,today()), mode:'walk', route:null, savedBus:null, loading:false, error:''};
    nav('routeMap');
    loadJourneyRoute(state.journey);
  }
  async function loadJourneyRoute(j) {
    if (!coord(j.origin) || !coord(j.target)) return;
    j.loading = true; j.error = ''; j.route = null; j.savedBus = null;
    if (state.view === 'routeMap' && state.journey === j) renderRouteMap();
    try {
      const routes=await getRoute(j.mode,j.origin,j.target);
      j.route=routes[0];
      if(j.mode==='transit' && j.route?.savedBusId)
        j.savedBus=savedBusLegs?.select(j.origin,j.target,j.route.savedBusId) || null;
      j.arrival=j.route.busAccessUnknown ? null : new Date().getHours()*60+new Date().getMinutes()+j.route.minutes;
      j.result=j.arrival===null ? null : evaluate(state.draft.entries[j.minute],j.arrival,today());
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
        if (!isLodgingPoint(j.origin)) new kakao.maps.Marker({position:kakaoPoint(j.origin.lat,j.origin.lon),map});
        if (!isLodgingPoint(j.target)) new kakao.maps.Marker({position:kakaoPoint(j.target.lat,j.target.lon),map});
        for (const [label,stop] of (j.savedBus || j.route?.busStops) ? [['승차',j.savedBus?.boardingStop || j.route.busStops.boarding],['하차',j.savedBus?.alightingStop || j.route.busStops.alighting]] : [])
          new kakao.maps.Marker({position:kakaoPoint(stop.lat,stop.lon),map,title:label+' · '+stop.name});
        const line = j.savedBus?.busPoints?.length > 1 ? j.savedBus.busPoints : j.route?.points?.length > 1 ? j.route.points : null;
        if (line || !j.savedBus) {
          const routePoints = line ? line.map(([lon,lat]) => kakaoPoint(lat,lon)) : [kakaoPoint(j.origin.lat,j.origin.lon),kakaoPoint(j.target.lat,j.target.lon)];
          new kakao.maps.Polyline({map,path:routePoints,strokeWeight:4,strokeColor:line ? '#0c8f71' : '#718b94',strokeOpacity:.9,strokeStyle:line ? 'solid' : 'dash'});
        }
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(kakaoPoint(j.origin.lat,j.origin.lon)); bounds.extend(kakaoPoint(j.target.lat,j.target.lon));
        if (j.savedBus) for (const stop of [j.savedBus.boardingStop,j.savedBus.alightingStop]) bounds.extend(kakaoPoint(stop.lat,stop.lon));
        map.setBounds(bounds);
        setTimeout(() => map.relayout(),50);
        return;
      } catch { toast('카카오맵 연결에 실패해 기존 지도를 표시합니다.'); }
    }
    const map = L.map('journey-map').setView([(j.origin.lat+j.target.lat)/2,(j.origin.lon+j.target.lon)/2],14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    if (!isLodgingPoint(j.origin)) L.circleMarker([j.origin.lat,j.origin.lon],{radius:8,color:'#155170'}).addTo(map).bindTooltip('출발');
    if (!isLodgingPoint(j.target)) L.circleMarker([j.target.lat,j.target.lon],{radius:8,color:'#0c8f71'}).addTo(map).bindTooltip('도착');
    for (const [label,stop] of (j.savedBus || j.route?.busStops) ? [['승차',j.savedBus?.boardingStop || j.route.busStops.boarding],['하차',j.savedBus?.alightingStop || j.route.busStops.alighting]] : [])
      L.circleMarker([stop.lat,stop.lon],{radius:8,color:'#c36b2e'}).addTo(map).bindTooltip(label+' · '+stop.name);
    const line=j.savedBus?.busPoints?.length > 1 ? j.savedBus.busPoints : j.route?.points?.length > 1 ? j.route.points : null;
    if (line || !j.savedBus) L.polyline(line ? line.map(([lon,lat]) => [lat,lon]) : [[j.origin.lat,j.origin.lon],[j.target.lat,j.target.lon]],{color:line ? '#0c8f71' : '#718b94',dashArray:line ? undefined : '5,9'}).addTo(map);
    const bounds=[[j.origin.lat,j.origin.lon],[j.target.lat,j.target.lon]];
    if (j.savedBus) bounds.push([j.savedBus.boardingStop.lat,j.savedBus.boardingStop.lon],[j.savedBus.alightingStop.lat,j.savedBus.alightingStop.lon]);
    map.fitBounds(bounds,{padding:[40,40],maxZoom:15});
    setTimeout(() => map.invalidateSize(),50);
  }
  function renderRouteMap() {
    const j = state.journey; if (!j) { nav('plan'); return; }
    const dest = entryLabel(state.draft.entries[j.minute]);
    const canMap = navigator.onLine && window.L && coord(j.origin) && coord(j.target);
    const savedBusLinks=j.savedBus ? [['공식 시간표',j.savedBus.timetable],['운행 공지',j.savedBus.serviceNotice]].filter(([,item])=>item).map(([kind,item])=>'<p class="small">'+kind+' <a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">'+esc(item.label)+'</a> · '+esc(item.checkedOn)+' 확인'+(item.sourceNote?' · '+esc(item.sourceNote):'')+'</p>').join('') : '';
    const savedBusInfo=j.savedBus ? '<p><strong>'+esc(j.savedBus.routeNumber)+'번 버스 · 탑승 평균 약 '+esc(j.savedBus.averageBusRideMinutes)+'분</strong></p><p class="small">'+(j.route ? '정류장 도보를 더한 계획상 이동 약 '+esc(j.route.minutes)+'분입니다. 배차 대기는 더하지 않았으므로 실제 도착은 달라질 수 있습니다.' : '정류장까지 걷기·배차 대기는 포함하지 않습니다. 총 이동시간과 예상 도착 시각은 미확인입니다.')+'</p>'+savedBusLinks+j.savedBus.evidence.map(e=>'<p class="small">조사 근거 <a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">'+esc(e.label)+'</a> · '+esc(e.checkedOn)+' 확인</p>').join('') : '';
    const busVarianceInfo=j.mode==='transit' && j.route ? j.route.currentUnavailable
      ? '<p class="small">현재 버스 정보를 다시 확인하지 못해 저장된 평균으로 표시합니다. 실제 소요시간은 달라질 수 있습니다.</p>'
      : j.route.busCacheStatus==='longer'
      ? '<p class="small">저장 기준 탑승 약 '+esc(Math.round(j.route.baselineBusRideSeconds/60))+'분보다 이번 조회가 약 '+esc(Math.round(j.route.rideDifferenceSeconds/60))+'분 길어, 이번 조회의 탑승 약 '+esc(Math.round(j.route.currentBusRideSeconds/60))+'분으로 계산했습니다. 지연 원인은 확인되지 않았습니다.</p>'
      : j.route.busCacheStatus==='reused'
      ? '<p class="small">이번 조회와 저장 기준의 차이가 5분·20% 기준에 못 미쳐 저장한 탑승시간으로 계산했습니다. 배차 대기는 포함하지 않았습니다.</p>'
      : j.route.busCacheStatus==='new'
      ? '<p class="small">이 구간의 첫 버스 탑승시간을 저장했습니다. 이후 조회로 기준값을 다듬습니다.</p>' : '' : '';
    const routeInfo = j.loading ? '<p>이동 경로 확인 중…</p>' : j.savedBus ? savedBusInfo : j.route?.busAccessUnknown ? '<p><strong>버스 탑승 약 '+esc(j.route.busRideMinutes)+'분</strong></p><p class="small">정류장 도보를 확인하지 못해 총 이동시간과 예상 도착 시각은 계산하지 않았습니다.</p>' : j.route ? '<p><strong>' + (j.mode === 'walk' ? '도보' : '대중교통') + ' 약 ' + j.route.minutes + '분 · ' + (j.route.meters / 1000).toFixed(1) + 'km (' + (j.route.savedPathId ? '미리 저장한 길' : '카카오 경로') + ')</strong>' + (j.mode === 'walk' ? ' · 예상 도착 ' + esc(hhmm(j.arrival)) : ' · 실제 버스 출발·도착 시각은 별도 확인') + '</p>' + (j.route.source ? '<p class="small">길선 자료 <a href="'+esc(j.route.source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(j.route.source.label)+'</a></p>' : '') : '<p>실제 경로를 표시할 수 없습니다. 직선거리 기준 도보 약 ' + (j.walk ?? '?') + '분 추정입니다.</p><p class="small">' + esc(j.error) + '</p>';
    const pathOptions=j.mode==='walk' && coord(j.origin) && coord(j.target) ? savedWalkOptions(j.origin,j.target) : [];
    const pathPicker=pathOptions.length>1 ? '<div class="route-path-choice"><small>이 구간의 길 선택</small><div class="route-tabs">'+pathOptions.map(v=>'<button type="button" class="filter-chip '+(v.id===j.route?.savedPathId?'active':'')+'" data-journey-path="'+esc(v.id)+'" aria-pressed="'+(v.id===j.route?.savedPathId)+'">'+esc(v.label)+' · '+(v.meters/1000).toFixed(2)+'km</button>').join('')+'</div></div>' : '';
    const steps = j.savedBus ? '<div class="route-steps"><div class="route-step"><strong>승차 · '+esc(j.savedBus.boardingStop.name)+'</strong><span>정류장 ID '+esc(j.savedBus.boardingStop.id)+'</span></div><div class="route-step"><strong>하차 · '+esc(j.savedBus.alightingStop.name)+'</strong><span>정류장 ID '+esc(j.savedBus.alightingStop.id)+'</span></div></div>' : j.mode === 'transit' && j.route?.steps?.length ? '<div class="route-steps">' + j.route.steps.map((step) => '<div class="route-step"><strong>' + esc(step.vehicle || (step.type === 'WALKING' ? '도보' : step.type)) + '</strong><span>' + esc(step.guidance) + (step.stops?.length ? ' · '+esc(step.stops[0])+' → '+esc(step.stops.at(-1)) : '') + ' · 약 ' + esc(step.minutes) + '분</span></div>').join('') + '</div>' : '';
    $('#main').innerHTML = '<section class="page"><button class="back" id="journey-back">← 시간계획표</button><div class="page-head"><div><div class="eyebrow">지금 이동하기</div><h1>' + esc(dest) + '</h1><p>'+(j.savedBus?'저장된 버스 노선과 정류장 정보입니다.':'현재 시각을 기준으로 운영시간을 다시 확인했습니다.')+'</p></div></div><div class="card"><div class="toolbar"><strong>' + esc(j.origin?.name || '이전 장소') + ' → ' + esc(dest) + '</strong>' + (j.result ? pillFor(j.result) : '') + '</div>' + (j.result ? '<p>'+esc(j.result.detail)+'</p>' : '') + '<div class="route-tabs"><button class="filter-chip ' + (j.mode === 'walk' ? 'active' : '') + '" data-journey-mode="walk">도보</button><button class="filter-chip ' + (j.mode === 'transit' ? 'active' : '') + '" data-journey-mode="transit">대중교통</button></div>' + routeInfo + busVarianceInfo + pathPicker + steps + '<p class="small">대중교통 경로는 지정한 날짜·출발 시각의 실제 운행을 보증하지 않습니다. 버스 시각과 출입구는 출발 전 확인하세요.</p></div><div class="map-frame journey-map" style="margin-top:16px"><div id="journey-map">' + (canMap ? '' : '<div class="empty-state">지도는 온라인이고 두 장소의 위치가 있을 때 볼 수 있습니다.</div>') + '</div></div><div class="top-actions" style="margin-top:16px">' + (coord(j.origin) && coord(j.target) ? '<a id="open-walk" class="btn btn-primary" target="_blank" rel="noopener noreferrer">카카오맵에서 길찾기</a>' : '') + '<button class="btn btn-outline" id="journey-refresh">지금 다시 확인</button></div></section>';
    $('#main .card')?.insertAdjacentHTML('afterbegin', turtlePose(j.mode === 'walk' ? 'walk' : 'bus', j.mode === 'walk' ? '걷는 거북이' : '버스를 기다리는 거북이', 'turtle-journey'));
    $('#journey-back').onclick = () => nav('plan'); $('#journey-refresh').onclick = () => {
      for(const [key,entry] of routeCache) if(!entry.persistent) routeCache.delete(key);
      loadJourneyRoute(j);
    };
    document.querySelectorAll('[data-journey-mode]').forEach((button) => button.onclick = () => { if (j.mode === button.dataset.journeyMode) return; j.mode = button.dataset.journeyMode; loadJourneyRoute(j); });
    document.querySelectorAll('[data-journey-path]').forEach(button=>button.onclick=()=>{
      walkPathChoices.set(savedWalkPaths.choiceKey(j.origin,j.target),button.dataset.journeyPath);
      save(STORAGE_WALK_PATH_CHOICES,Object.fromEntries(walkPathChoices));
      loadJourneyRoute(j);
    });
    if ($('#open-walk')) $('#open-walk').href = j.route?.url?.startsWith('https://map.kakao.com/') ? j.route.url : 'https://map.kakao.com/link/to/' + encodeURIComponent(dest) + ',' + j.target.lat + ',' + j.target.lon;
    if (canMap) initJourneyMap(j);
  }
  function renderSaved() {
    $('#main').innerHTML = '<section class="page"><button class="back" id="saved-back">← 여행지 지도</button><div class="page-head"><div><div class="eyebrow">이 기기에 보관</div><h1>저장한 계획</h1><p>인터넷이 없어도 장소와 메모를 글로 볼 수 있습니다.</p></div><div class="top-actions"><button class="btn btn-outline" id="export-plans">파일로 내보내기</button><button class="btn btn-outline" id="import-plans">파일 가져오기</button><button class="btn btn-outline" id="import-theme-plans">검토용 테마 계획 갱신</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></div><div class="saved-list">' + (state.saved.length ? state.saved.map((p) => '<div class="card saved-card"><div><div class="eyebrow">' + esc(p.date || '') + '</div><h3>' + esc(p.title || '이름 없는 계획') + '</h3><p>' + Object.keys(p.entries || {}).length + '개 장소 · ' + esc(p.start || '') + ' 시작</p></div><div class="top-actions"><button class="btn btn-primary btn-sm" data-open-saved="' + esc(p.id) + '">열기</button><button class="btn btn-outline btn-sm" data-text-saved="' + esc(p.id) + '">글로 보기</button><button class="btn btn-danger btn-sm" data-delete-saved="' + esc(p.id) + '">삭제</button></div></div>').join('') : '<div class="card empty-state">저장한 계획이 없습니다. 계획표에서 저장해 주세요.</div>') + '</div><div class="notice" style="margin-top:16px">계획은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라질 수 있으니 파일로 내보내 두세요.</div></section>';
    if (!state.saved.length) $('.saved-list .empty-state')?.insertAdjacentHTML('afterbegin', turtlePose('rest', '잠시 쉬는 거북이', 'turtle-empty'));
    $('#saved-back').onclick = () => nav('home');
    document.querySelectorAll('[data-open-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.openSaved); if (p) { state.draft = JSON.parse(JSON.stringify(p)); persistDraft(); nav('plan'); } });
    document.querySelectorAll('[data-text-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.textSaved); if (!p) return; const lines = Object.entries(p.entries || {}).sort((a,b) => Number(a[0])-Number(b[0])).map(([m,e]) => '<div class="place-row"><strong>' + esc(hhmm(Number(m))) + ' · ' + esc(entryLabel(e)) + '</strong><small>' + esc(e.locationText || entryPlace(e)?.locationText || '') + (e.memo ? ' · ' + esc(e.memo) : '') + '</small></div>').join(''); openModal('<h2>' + esc(p.title) + '</h2><p>' + esc(p.date) + ' · ' + esc(p.start) + ' 시작</p><div class="saved-text">' + (lines || '<p>등록한 장소가 없습니다.</p>') + '</div><div class="modal-actions"><button class="btn btn-primary" data-close>닫기</button></div>'); });
    document.querySelectorAll('[data-delete-saved]').forEach((b) => b.onclick = () => { const p = state.saved.find((x) => x.id === b.dataset.deleteSaved); openModal('<h2>저장한 계획을 삭제할까요?</h2><p>' + esc(p?.title || '') + '</p><div class="modal-actions"><button class="btn btn-outline" data-close>취소</button><button class="btn btn-danger" id="confirm-delete-saved">삭제</button></div>', () => { $('#confirm-delete-saved').onclick = () => { state.saved = state.saved.filter((x) => x.id !== b.dataset.deleteSaved); save(STORAGE_SAVED,state.saved); closeModal(); renderSaved(); }; }); });
    $('#export-plans').onclick = () => { const blob = new Blob([JSON.stringify({app:'hangeoreum-'+activeRegion.id,version:1,plans:state.saved},null,2)],{type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = activeRegion.id+'-plans.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000); };
    $('#import-plans').onclick = () => $('#import-file').click();
    $('#import-file').onchange = async (e) => { try { const data = JSON.parse(await e.target.files[0].text()); if (data.app !== 'hangeoreum-'+activeRegion.id || !Array.isArray(data.plans)) throw Error(); const incoming = data.plans.filter((p) => p && typeof p.id === 'string' && p.entries && typeof p.entries === 'object'); if (!incoming.length) throw Error(); const ids = new Set(state.saved.map((p) => p.id)); state.saved = [...state.saved,...incoming.filter((p) => !ids.has(p.id))]; save(STORAGE_SAVED,state.saved); renderSaved(); toast('계획 파일을 가져왔습니다.'); } catch { toast('이 앱에서 내보낸 계획 파일인지 확인해 주세요.'); } };
  }
  document.addEventListener('error',event=>{const img=event.target;if(img.tagName!=='IMG'||!img.closest('.place-visual'))return;const visual=img.closest('.place-visual');img.remove();visual.dataset.kind='decoration';const caption=visual.querySelector('.media-caption');if(caption)caption.textContent='유형 이미지';},true);
  document.addEventListener('keydown',event=>{const current=event.target.closest?.('[role="tab"]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const group=current.closest('[role="tablist"]');const tabs=[...group.querySelectorAll('[role="tab"]')];const i=tabs.indexOf(current);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;event.preventDefault();const label=group.getAttribute('aria-label');tabs[next].click();document.querySelector('[role="tablist"][aria-label="'+CSS.escape(label)+'"] [aria-selected="true"]')?.focus();});
  document.querySelectorAll('[data-nav]').forEach(b=>{b.querySelector('span').innerHTML=uiIcon(b.dataset.nav==='region'?'map':b.dataset.nav);b.onclick=()=>nav(b.dataset.nav);});
  window.addEventListener('online', () => { statusConnection(); render(); });
  window.addEventListener('offline', () => { statusConnection(); render(); });
  Promise.allSettled([
    fetch(activeRegion.placesFile, {cache:'no-store'}).then((r) => { if (!r.ok) throw Error(); return r.json(); }),
    activeRegion.lodgingsFile ? fetch(activeRegion.lodgingsFile, {cache:'no-store'}).then((r) => { if (!r.ok) throw Error(); return r.json(); }) : Promise.resolve({lodgings:[]})
  ]).then(([placesResult,lodgingsResult]) => {
    state.places = placesResult.status === 'fulfilled' ? placesResult.value.places || [] : [];
    state.lodgings = lodgingsResult.status === 'fulfilled' ? (lodgingsResult.value.lodgings || []).map((place) => {
      const pin = lodgingPins[place.id];
      return pin?.address === place.address && Number.isFinite(pin.lat) && Number.isFinite(pin.lon) ? {...place,lat:pin.lat,lon:pin.lon} : place;
    }) : [];
    render();
    loadSavedBusLegs().then(()=>{ if(state.view==='routes' && state.route.results?.length) showRouteResults(); });
    if (placesResult.status !== 'fulfilled') toast('장소 자료를 불러오지 못했습니다. 저장한 계획은 볼 수 있습니다.');
    else if (lodgingsResult.status !== 'fulfilled') toast('숙소 목록을 불러오지 못했습니다. 온라인 장소 검색은 사용할 수 있습니다.');
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
})();
