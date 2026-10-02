/* 목포 도보 루트 계산. 브라우저와 Node 검증에서 같은 규칙을 사용한다. */
(() => {
  'use strict';
  const SHOP_IDS = new Set(['p113','p117','p118','p123','p124','p125','p126','p127','p128','p129','p130']);
  const HISTORY_IDS = new Set(['p2','p8','p9','p12','p13','p20','p22','p29','p30','p31','p40']);
  const SEA_IDS = new Set(['p3','p4','p5','p6','p7','p14','p19','p24','p25','p32','p34','p36','p37']);
  const NIGHT_OUTDOOR_IDS = new Set(['p14']);
  const EXCLUDED_IDS = new Set(['p3','p4','p5','p24','p41','p51']);
  const THEMES = [
    {id:'balanced', name:'목포 기본 코스'},
    {id:'history', name:'역사·골목'},
    {id:'sea', name:'바다·풍경'},
    {id:'shops', name:'소품샵·책방'},
    {id:'food', name:'음식'},
    {id:'cafe', name:'카페'}
  ];
  const THEME_PRESETS = {
    history:{originId:'station',destinationId:'station',description:'목포역에서 근대역사거리와 원도심 골목을 걷는 코스'},
    sea:{originId:'p7',destinationId:'p14',description:'갓바위에서 출발해 박물관권을 거쳐 평화광장으로 걷는 코스'},
    shops:{originId:'station',destinationId:'station',description:'목포역 근처의 책방과 소품샵을 잇는 코스'},
    food:{originId:'station',destinationId:'station',description:'원도심 음식점과 간식집을 엮는 코스'},
    cafe:{originId:'station',destinationId:'station',description:'원도심 카페와 쉬어 갈 곳을 엮는 코스'}
  };
  const minutes = (value) => value === '24:00' ? 1440 : Number(value.slice(0,2)) * 60 + Number(value.slice(3,5));
  const round5 = (value) => Math.ceil(value / 5) * 5;
  const distanceKm = (a,b) => {
    const r = Math.PI / 180;
    return 111.2 * Math.hypot(b.lat-a.lat, (b.lon-a.lon) * Math.cos((a.lat+b.lat)/2*r));
  };
  const hasCoord = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
  function datedHours(p,date) {
    if (date < '2026-10-03' || date > '2026-10-09') return null;
    const day=Number(date.slice(-2));
    const texts=[p.diningWeekText,p.mapWeekText].filter(Boolean);
    let openRule=null;
    for (const source of texts) {
      for (const segment of source.split(' · ')) {
        const match=segment.match(/^10\/(\d+)\([^)]+\)(?:~(?:10\/)?(\d+)\([^)]+\))?/);
        if (!match || day < Number(match[1]) || day > Number(match[2] || match[1])) continue;
        if (/휴무|휴관/.test(segment) && !/휴무 설명|휴관 안내/.test(segment)) return {closed:true};
        const hours=segment.match(/(\d{1,2}:\d{2})~(?:익일\s*)?(\d{1,2}:\d{2})/);
        if (!hours) continue;
        const breaks=[...segment.matchAll(/브레이크\s*(\d{1,2}:\d{2})~(\d{1,2}:\d{2})/g)].map((x) => [x[1],x[2]]);
        const deadline=segment.match(/(?:저녁\s*)?주문\s*(\d{1,2}:\d{2})까지/);
        openRule={open:hours[1],close:hours[2],breaks,lastOrder:deadline?.[1],dated:true};
      }
    }
    return openRule;
  }
  function estimate(a,b) {
    const direct = distanceKm(a,b);
    return {meters:Math.ceil(direct*1550), minutes:Math.max(1,Math.ceil(direct*1.55/3.5*60)), actual:false};
  }
  function stay(p, meal) {
    if (meal) return 60;
    if (p.category === 'food') return 45;
    if (p.category === 'cafe') return 40;
    if (p.category === 'shop') return 30;
    if (['p3','p4','p5'].includes(p.id)) return 45;
    if (['p6','p10','p19'].includes(p.id)) return 60;
    return 45;
  }
  function themeScore(p, theme, variant) {
    const shop = SHOP_IDS.has(p.id), history = HISTORY_IDS.has(p.id), sea = SEA_IDS.has(p.id);
    const base = {spot:7,food:4,cafe:5,shop:5}[p.category] || 0;
    const focused = {
      balanced: (history ? 3 : 0) + (sea ? 2 : 0) + (shop ? 1 : 0),
      history: history ? 13 : p.category === 'spot' ? 5 : 0,
      sea: sea ? 15 : p.category === 'spot' ? 2 : 0,
      shops: shop ? 17 : p.category === 'shop' ? -4 : 0,
      food: p.category === 'food' ? 15 : p.category === 'cafe' ? 5 : 0,
      cafe: p.category === 'cafe' ? 16 : shop ? 2 : 0
    }[theme] || 0;
    const variantBoost = variant === 1 ? (p.category === 'shop' ? 3 : p.category === 'cafe' ? 2 : 0) :
      variant === 2 ? (sea ? 4 : p.category === 'food' ? 2 : 0) : 0;
    return base + focused + variantBoost;
  }
  function allowedAt(p, minute, meal, date) {
    if (EXCLUDED_IDS.has(p.id)) return false;
    const knownHours = p.hours || datedHours(p,date)?.open;
    if (minute >= 19*60 && !knownHours && ['shop','food','cafe'].includes(p.category)) return false;
    if (meal) return p.category === 'food' || p.category === 'cafe';
    if (p.category === 'spot') {
      if (minute >= 17*60 && !NIGHT_OUTDOOR_IDS.has(p.id) && !knownHours) return false;
      if (minute >= 19*60) return NIGHT_OUTDOOR_IDS.has(p.id) || !!knownHours;
      if (minute < 7*60 && !NIGHT_OUTDOOR_IDS.has(p.id)) return false;
      if (p.id === 'p6' && (minute < 9*60 || minute >= 17*60)) return false;
    }
    return true;
  }
  async function generate(input) {
    const {places,origin,destination,theme='balanced',mealTimes=[],date,routeProvider,validate,requiredPlaceId=''} = input;
    const start = minutes(input.start), end = minutes(input.end);
    if (!hasCoord(origin) || !hasCoord(destination) || !(start >= 0 && end <= 1440 && end > start)) return [];
    const meals = [...new Set(mealTimes.filter(Boolean).map(minutes))].filter((m) => m >= start && m < end).sort((a,b) => a-b);
    const pool = places.filter((p) => hasCoord(p) && p.id !== origin.id && p.id !== destination.id);
    const legCache = new Map();
    async function leg(a,b) {
      if (a.id === b.id || distanceKm(a,b) < .015) return {meters:0,minutes:0,actual:true};
      const key = a.id + ':' + b.id;
      if (!legCache.has(key)) {
        const direct = distanceKm(a,b);
        let value = estimate(a,b);
        if (direct <= 1.3 && routeProvider) {
          try {
            const routed = await routeProvider(a,b);
            if (routed?.meters > 0 && routed?.minutes > 0) value = {meters:routed.meters,minutes:routed.minutes,actual:true};
          } catch { /* 추정 구간은 결과에 명시 */ }
        }
        legCache.set(key,value);
      }
      return legCache.get(key);
    }
    const routes = [], usedFirst = new Set();
    for (let variant=0; variant<(input.variants || 3); variant++) {
      const rows=[], used = new Set(), missed=[];
      let now=start, prior=origin, walked=0, mealIndex=0;
      for (let step=0; step<14 && now < end-25; step++) {
        const nextMeal = meals[mealIndex];
        const mealDue = nextMeal !== undefined && now >= nextMeal-80;
        const candidates = pool.filter((p) => !used.has(p.id) && (mealDue || theme === 'food' || p.category !== 'food') && allowedAt(p,mealDue ? nextMeal : now,mealDue,date) &&
          distanceKm(prior,p) <= 1.3 && distanceKm(p,destination) <= 1.3)
          .map((p) => ({p, direct:distanceKm(prior,p), score:themeScore(p,theme,variant) + (p.hours ? 4 : 0) + (distanceKm(prior,destination)-distanceKm(p,destination))*6 + (p.id === requiredPlaceId ? 100 : 0) - (rows.at(-1) && places.find((last) => last.id === rows.at(-1).placeId)?.category === p.category && theme !== 'shops' && theme !== 'food' && theme !== 'cafe' ? 6 : 0)}))
          .sort((a,b) => (b.score - a.score) + (a.direct-b.direct)*6)
          .slice(0,12);
        if (mealDue) candidates.sort((a,b) => (a.p.category === 'food' ? -1 : 0) - (b.p.category === 'food' ? -1 : 0) || a.direct-b.direct);
        if (!rows.length && variant > 0) candidates.sort((a,b) => Number(usedFirst.has(a.p.id))-Number(usedFirst.has(b.p.id)) || b.score-a.score || a.direct-b.direct);
        let choice=null;
        for (const {p} of candidates) {
          if (rows.length >= 3 && origin.id !== destination.id && distanceKm(p,destination) > distanceKm(prior,destination)+.25) continue;
          const walk = await leg(prior,p);
          if (walk.meters > 1600 || walk.minutes > 30 || walked+walk.meters > 8000) continue;
          const arrival = round5(now+walk.minutes+3);
          const visit = mealDue ? nextMeal : arrival;
          const duration = stay(p,mealDue);
          if (!allowedAt(p,visit,mealDue,date)) continue;
          if (visit < arrival || visit+duration > end) continue;
          if (!mealDue && nextMeal !== undefined && visit+duration > nextMeal-30) continue;
          const back = estimate(p,destination);
          if (back.meters > 2015 || visit+duration+back.minutes+5 > end || walked+walk.meters+back.meters > 8000) continue;
          const result = validate(p,visit,duration,date);
          if (result.kind === 'bad' || (result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(result.title))) continue;
          choice={p,walk,visit,duration,result}; break;
        }
        if (!choice) {
          if (mealDue) { missed.push(nextMeal); mealIndex++; now=Math.max(now,nextMeal+60); continue; }
          if (nextMeal !== undefined) { now=Math.max(now,nextMeal-80); continue; }
          break;
        }
        const {p,walk,visit,duration,result}=choice;
        rows.push({minute:visit,placeId:p.id,duration,walkEstimate:walk.minutes,walkMeters:walk.meters,actual:walk.actual,result,kind:mealDue?'meal':'visit'});
        if (rows.length === 1) usedFirst.add(p.id);
        used.add(p.id); walked+=walk.meters; prior=p; now=visit+duration;
        if (mealDue) mealIndex++;
      }
      for (; mealIndex<meals.length; mealIndex++) missed.push(meals[mealIndex]);
      const thematicRows=rows.filter((row) => {
        const p=places.find((item) => item.id === row.placeId);
        return theme === 'shops' ? SHOP_IDS.has(row.placeId) : theme === 'history' ? HISTORY_IDS.has(row.placeId) : theme === 'sea' ? SEA_IDS.has(row.placeId) : theme === 'food' ? p?.category === 'food' : theme === 'cafe' ? p?.category === 'cafe' : true;
      }).length;
      const themeCount=thematicRows + (theme === 'sea' ? Number(SEA_IDS.has(origin.id))+Number(SEA_IDS.has(destination.id) && origin.id !== destination.id) : 0);
      if (missed.length || rows.length < 2 || (requiredPlaceId && !used.has(requiredPlaceId)) || (theme !== 'balanced' && (thematicRows < 1 || themeCount < (end-start >= 240 ? 2 : 1)))) continue;
      const finalLeg=await leg(prior,destination);
      if (finalLeg.meters > 1600 || finalLeg.minutes > 30 || walked+finalLeg.meters > 8000 || now+finalLeg.minutes > end) continue;
      const signature=rows.map((x) => x.placeId).join(',');
      if (routes.some((x) => x.signature === signature)) continue;
      const label = variant === 0 ? '가까운 곳부터' : variant === 1 ? '골목과 쉼표' : '다른 순서로';
      routes.push({id:'route-'+variant,title:label,theme,rows,walkMeters:walked+finalLeg.meters,
        endWalk:finalLeg,endArrival:now+finalLeg.minutes,originName:origin.name,destinationName:destination.name,
        start,end,signature});
    }
    return routes;
  }
  async function generateAdaptive(input) {
    const direct=await generate(input);
    if (direct.length || input.theme !== 'balanced' || input.requiredPlaceId || input.origin.id === input.destination.id ||
        distanceKm(input.origin,input.destination) > 2.8) return direct;
    const anchors=input.places.filter((p) => hasCoord(p) && !EXCLUDED_IDS.has(p.id) &&
      p.id !== input.origin.id && p.id !== input.destination.id && p.category !== 'food' &&
      distanceKm(p,input.destination) <= 1.0 && distanceKm(input.origin,p) <= 2.8)
      .sort((a,b) => distanceKm(a,input.destination)-distanceKm(b,input.destination)).slice(0,8);
    for (const anchor of anchors) {
      const tail=estimate(anchor,input.destination);
      if (tail.meters > 1600 || tail.minutes > 30) continue;
      // 추가 후보 탐색은 API를 소모하지 않으며, 모든 구간을 추정으로 표시한다.
      const variants=await generate({...input,destination:anchor,routeProvider:null,variants:1});
      for (const route of variants) {
        const visit=round5(route.endArrival), duration=stay(anchor,false);
        const result=input.validate(anchor,visit,duration,input.date);
        if (result.kind === 'bad' || (result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(result.title))) continue;
        if (visit+duration+tail.minutes > route.end || route.walkMeters+tail.meters > 8000) continue;
        const row={minute:visit,placeId:anchor.id,duration,walkEstimate:route.endWalk.minutes,
          walkMeters:route.endWalk.meters,actual:route.endWalk.actual,result,kind:'visit'};
        return [{...route,rows:[...route.rows,row],walkMeters:route.walkMeters+tail.meters,
          endWalk:tail,endArrival:visit+duration+tail.minutes,destinationName:input.destination.name,
          signature:route.signature+','+anchor.id,title:'도착지로 이어 걷기'}];
      }
    }
    return direct;
  }
  const api={THEMES,THEME_PRESETS,SHOP_IDS,EXCLUDED_IDS,minutes,distanceKm,estimate,themeScore,stay,datedHours,generate,generateAdaptive};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumRouteEngine=api;
})();
