/* 목포 도보 루트 계산. 브라우저와 Node 검증에서 같은 규칙을 사용한다. */
(() => {
  'use strict';
  const SHOP_IDS = new Set(['p113','p117','p118','p123','p124','p125','p126','p127','p128','p129','p130']);
  const HISTORY_IDS = new Set(['p2','p8','p9','p12','p13','p20','p22','p29','p30','p31','p40']);
  const SEA_IDS = new Set(['p3','p4','p5','p6','p7','p14','p19','p24','p25','p32','p34','p36','p37']);
  const NIGHT_OUTDOOR_IDS = new Set(['p14']);
  const EXCLUDED_IDS = new Set(['p3','p4','p5','p24','p35','p41','p44','p45','p51']);
  const THEMES = [
    {id:'balanced', name:'목포 기본 코스'},
    {id:'first', name:'처음 가는 목포'},
    {id:'history', name:'역사·골목'},
    {id:'sea', name:'바다·풍경'},
    {id:'shops', name:'소품샵·책방'},
    {id:'food', name:'목포 먹거리'},
    {id:'cafe', name:'카페·여유'}
  ];
  const THEME_PRESETS = {
    first:{originId:'station',destinationId:'station',description:'목포역에서 역사거리와 골목, 점심을 함께 즐기는 첫 방문 코스'},
    history:{originId:'station',destinationId:'station',description:'목포역에서 근대역사거리와 원도심 골목을 걷는 코스'},
    sea:{originId:'p7',destinationId:'p14',description:'갓바위에서 출발해 박물관권을 거쳐 평화광장으로 걷는 코스'},
    shops:{originId:'station',destinationId:'station',description:'목포역 근처의 책방과 소품샵을 잇는 코스'},
    food:{originId:'station',destinationId:'station',description:'식사는 최대 두 번, 그 사이에는 원도심 구경과 산책'},
    cafe:{originId:'station',destinationId:'station',description:'카페는 최대 두 곳, 책방과 골목을 함께 걷는 여유 코스'}
  };
  const minutes = (value) => value === '24:00' ? 1440 : Number(value.slice(0,2)) * 60 + Number(value.slice(3,5));
  const round5 = (value) => Math.ceil(value / 5) * 5;
  const distanceKm = (a,b) => {
    const r = Math.PI / 180;
    return 111.2 * Math.hypot(b.lat-a.lat, (b.lon-a.lon) * Math.cos((a.lat+b.lat)/2*r));
  };
  function routeProgress(origin,destination,p) {
    const latScale=111.2, lonScale=111.2*Math.cos(origin.lat*Math.PI/180);
    const dx=(destination.lon-origin.lon)*lonScale, dy=(destination.lat-origin.lat)*latScale;
    const px=(p.lon-origin.lon)*lonScale, py=(p.lat-origin.lat)*latScale;
    const length=dx*dx+dy*dy;
    if (length < .01) return {along:0,off:0};
    const along=(px*dx+py*dy)/length;
    return {along,off:Math.hypot(px-along*dx,py-along*dy)};
  }
  const hasCoord = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
  const routeCategory = (p) => ['outdoors','culture','experience'].includes(p.category) ? 'spot' :
    ['market','books'].includes(p.category) ? 'shop' : p.category;
  const busRideMinutes=route=>{
    const value=Number.isFinite(route.busRideSeconds) && route.busRideSeconds>0 ? route.busRideSeconds/60 :
      Number.isFinite(route.busRideMinutes) && route.busRideMinutes>0 ? route.busRideMinutes :
      route.steps?.filter(step=>step.type==='BUS').reduce((sum,step)=>sum+(step.minutes || 0),0);
    return value>0 ? value : null;
  };
  function datedHours(p,date) {
    // 운영자 사이트와 충돌하는 포도책방의 지도 주간표는 판정에 사용하지 않는다.
    if (p.id === 'p127') return null;
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
    if (p.shortScenicWalk) return p.shortScenicWalk.minutes;
    if (p.category === 'food') return 45;
    if (p.category === 'cafe') return 40;
    if (routeCategory(p) === 'shop') return 30;
    if (['p3','p4','p5'].includes(p.id)) return 45;
    if (['p6','p10','p19'].includes(p.id)) return 60;
    return 45;
  }
  function themeScore(p, theme, variant) {
    const shop = SHOP_IDS.has(p.id), history = HISTORY_IDS.has(p.id), sea = SEA_IDS.has(p.id);
    const category = routeCategory(p);
    const base = {spot:7,food:4,cafe:5,shop:5}[category] || 0;
    const focused = {
      balanced: (history ? 3 : 0) + (sea ? 2 : 0) + (shop ? 1 : 0),
      history: history ? 13 : category === 'spot' ? 5 : 0,
      sea: sea ? 15 : category === 'spot' ? 2 : 0,
      shops: shop ? 17 : category === 'shop' ? -4 : 0,
      food: p.category === 'food' ? 15 : p.category === 'cafe' ? 5 : 0,
      cafe: p.category === 'cafe' ? 16 : shop ? 2 : 0
    }[theme] || 0;
    const variantBoost = variant === 1 ? (category === 'shop' ? 3 : p.category === 'cafe' ? 2 : 0) :
      variant === 2 ? (sea ? 4 : p.category === 'food' ? 2 : 0) : 0;
    return base + focused + variantBoost;
  }
  function allowedAt(p, minute, meal, date) {
    if (EXCLUDED_IDS.has(p.id)) return false;
    if (p.unrestrictedAccess && !meal) return true;
    const category = routeCategory(p);
    const knownHours = p.hours || datedHours(p,date)?.open;
    if (minute >= 19*60 && !knownHours && ['shop','food','cafe'].includes(category)) return false;
    if (meal) return p.category === 'food' || p.category === 'cafe';
    if (category === 'spot') {
      if (minute >= 17*60 && !NIGHT_OUTDOOR_IDS.has(p.id) && !knownHours) return false;
      if (minute >= 19*60) return NIGHT_OUTDOOR_IDS.has(p.id) || !!knownHours;
      if (minute < 7*60 && !NIGHT_OUTDOOR_IDS.has(p.id)) return false;
      if (p.id === 'p6' && (minute < 9*60 || minute >= 17*60)) return false;
    }
    return true;
  }
  async function generate(input) {
    const {places,origin,destination,theme='balanced',mealTimes=[],date,routeProvider,validate,requiredPlaceId='',preferredPlaceId='',routeFocus=''} = input;
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
          if (routed?.meters > 0 && routed?.minutes > 0) value = {...routed,actual:true,points:routed.points || []};
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
        const thematicCount=rows.filter((row) => {
          const place=places.find((item) => item.id === row.placeId);
          return theme === 'shops' ? SHOP_IDS.has(row.placeId) : theme === 'history' ? HISTORY_IDS.has(row.placeId) :
            theme === 'sea' ? SEA_IDS.has(row.placeId) : theme === 'food' ? place?.category === 'food' :
            theme === 'cafe' ? place?.category === 'cafe' : false;
        }).length;
        const isThematic=(p) => theme === 'shops' ? SHOP_IDS.has(p.id) : theme === 'history' ? HISTORY_IDS.has(p.id) :
          theme === 'sea' ? SEA_IDS.has(p.id) : theme === 'food' ? p.category === 'food' : theme === 'cafe' ? p.category === 'cafe' : true;
        const candidates = pool.filter((p) => !used.has(p.id) && (mealDue || theme === 'food' || theme === 'cafe' || !['food','cafe'].includes(p.category) || p.id === requiredPlaceId || p.id === preferredPlaceId) && allowedAt(p,mealDue ? nextMeal : now,mealDue,date) &&
          distanceKm(prior,p) <= 1.3 && distanceKm(p,destination) <= (routeFocus ? Math.max(1.3,distanceKm(prior,destination)+.1) : 1.3) &&
          (p.id === requiredPlaceId || routeFocus !== 'through' || origin.id === destination.id || (() => { const path=routeProgress(origin,destination,p); return path.along >= -.12 && path.along <= 1.12 && path.off <= .65 && path.along >= routeProgress(origin,destination,prior).along-.12; })()))
          .map((p) => ({p,direct:distanceKm(prior,p)}))
          .sort((a,b) => a.direct-b.direct);
        if (mealDue) candidates.sort((a,b) => (a.p.category === 'food' ? -1 : 0) - (b.p.category === 'food' ? -1 : 0) || a.direct-b.direct);
        if (!rows.length && variant > 0) candidates.sort((a,b) => Number(usedFirst.has(a.p.id))-Number(usedFirst.has(b.p.id)) || a.direct-b.direct);
        if (!mealDue && theme !== 'balanced' && thematicCount < 2) candidates.sort((a,b) => Number(!isThematic(a.p))-Number(!isThematic(b.p)) || a.direct-b.direct);
        if (requiredPlaceId && !used.has(requiredPlaceId) && rows.length >= 7) candidates.sort((a,b) => Number(b.p.id === requiredPlaceId)-Number(a.p.id === requiredPlaceId) || a.direct-b.direct);
        let choice=null;
        for (const {p} of candidates) {
          if (p.shortScenicWalk && distanceKm(prior,p) > .25) continue;
          // 이미 지나온 블록으로 되돌아가지 않는다. 현재 방문지 주변을 연달아 걷는 것은 허용한다.
          if (p.id !== requiredPlaceId && rows.slice(0,-2).some((row) => {
            const visited=places.find((item) => item.id === row.placeId);
            return visited && distanceKm(prior,visited) > .35 && distanceKm(p,visited) < .12;
          })) continue;
          if (p.id !== requiredPlaceId && rows.length >= 3 && origin.id !== destination.id && distanceKm(p,destination) > distanceKm(prior,destination)+.25) continue;
          const walk = await leg(prior,p);
          if (walk.meters > 1600 || walk.minutes > 30 || walked+walk.meters > 8000) continue;
          const arrival = round5(now+walk.minutes+3);
          const visit = mealDue ? nextMeal : arrival;
          const duration = stay(p,mealDue);
          if (!allowedAt(p,visit,mealDue,date)) continue;
          if (visit < arrival || visit+duration > end) continue;
          if (!mealDue && nextMeal !== undefined && visit+duration > nextMeal-30) continue;
          const back = estimate(p,destination);
          if ((!routeFocus && back.meters > 2015) || visit+duration+back.minutes+5 > end || walked+walk.meters+back.meters > 8000) continue;
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
        rows.push({minute:visit,placeId:p.id,duration,walkEstimate:walk.minutes,walkMeters:walk.meters,actual:walk.actual,walkPoints:walk.points || [],savedPathId:walk.savedPathId,savedPathLabel:walk.savedPathLabel,source:walk.source,result,kind:mealDue?'meal':'visit'});
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
      if (missed.length || rows.length < 2 || (requiredPlaceId && !used.has(requiredPlaceId) && origin.id !== requiredPlaceId && destination.id !== requiredPlaceId) || (theme !== 'balanced' && (thematicRows < 1 || themeCount < (end-start >= 240 ? 2 : 1)))) continue;
      const finalLeg=await leg(prior,destination);
      if (finalLeg.meters > 1600 || finalLeg.minutes > 30 || walked+finalLeg.meters > 8000 || now+finalLeg.minutes > end) continue;
      const signature=rows.map((x) => x.placeId).join(',');
      if (routes.some((x) => x.signature === signature)) continue;
      const label = variant === 0 ? '가까운 길부터' : variant === 1 ? '다른 출발 순서' : '다른 길로';
      routes.push({id:'route-'+variant,title:label,theme,rows,walkMeters:walked+finalLeg.meters,
        endWalk:finalLeg,endArrival:now+finalLeg.minutes,originName:origin.name,destinationName:destination.name,
        start,end,signature});
    }
    return routes;
  }
  const validResult = (result) => result.kind !== 'bad' &&
    !(result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(result.title));
  const validLeg = (walk) => walk.meters <= 1600 && (walk.mode==='bus' ? walk.actual && walk.walkMinutes<=30 && walk.minutes<=90 : walk.minutes <= 30);
  const pointLeg = (a,b) => distanceKm(a,b) < .015 ? {meters:0,minutes:0,actual:true,points:[]} : estimate(a,b);
  const samePoint=(a,b)=>a && b && a.lat===b.lat && a.lon===b.lon;
  const inputLeg=(a,b,input)=>input.busConnection && samePoint(a,input.busConnection.from) && samePoint(b,input.busConnection.to) ? input.busConnection.leg : pointLeg(a,b);
  const themedPlace=(p,theme)=>theme==='first' ? HISTORY_IDS.has(p.id) : theme==='history' ? HISTORY_IDS.has(p.id) : theme==='sea' ? SEA_IDS.has(p.id) : theme==='shops' ? SHOP_IDS.has(p.id) : theme==='food' ? p.category==='food' : theme==='cafe' ? p.category==='cafe' : false;

  // 초기 탐색·대체 탐색·최종 API 확인에 동일한 시간표 규칙을 적용한다.
  function scheduleVisits(order,input,walks) {
    const {origin,destination,date,validate,requiredPlaceId=''}=input;
    const start=minutes(input.start), end=minutes(input.end);
    const rows=[];
    let prior=origin, now=start, walked=0;
    for (let i=0;i<order.length;i++) {
      const p=order[i], template=input.scheduledRows?.[i], walk=walks ? walks[i] : inputLeg(prior,p,input);
      const kind=template?.kind || (input.theme!=='balanced' && p.category==='food' ? 'meal' : input.theme!=='balanced' && p.category==='cafe' ? 'cafe' : 'visit');
      const duration=template?.duration || stay(p,kind==='meal');
      if (!validLeg(walk)) return null;
      let minute=round5(now+walk.minutes+3), result;
      let fixed=input.fixedMeals && template && ['meal','cafe'].includes(kind) ? template.minute : null;
      if(input.flexibleMeals && fixed!=null && minute>fixed && minute<=fixed+30 && minute<15*60) fixed=minute;
      if(fixed!=null && minute>fixed) return null;
      if(fixed!=null) minute=fixed;
      if(fixed==null && kind==='meal') minute=Math.max(minute,11*60);
      const priorMeal=rows.filter(row=>row.kind===kind).at(-1);
      if(fixed==null && priorMeal && ['meal','cafe'].includes(kind)) minute=Math.max(minute,priorMeal.minute+(kind==='meal'?180:100));
      // 개점 전에는 최대 90분의 여유를 허용한다. 빈 시간은 화면에 표시한다.
      const latest=Math.min(fixed ?? minute+90,end-duration);
      for (;minute<=latest;minute+=5) {
        result=validate(p,minute,duration,date);
        if (allowedAt(p,minute,kind==='meal',date) && validResult(result)) break;
      }
      if (minute>latest) return null;
      rows.push({placeId:p.id,minute,duration,walkEstimate:walk.minutes,walkMeters:walk.meters,
        actual:walk.actual,walkPoints:walk.points || [],savedPathId:walk.savedPathId,savedPathLabel:walk.savedPathLabel,source:walk.source,result,kind,mode:walk.mode || 'walk',busLeg:walk.mode==='bus'?walk:null});
      now=minute+duration; walked+=walk.meters; prior=p;
    }
    const endWalk=walks ? walks[order.length] : inputLeg(prior,destination,input);
    if (!validLeg(endWalk) || now+endWalk.minutes>end || walked+endWalk.meters>8000) return null;
    if (requiredPlaceId && ![origin.id,destination.id,...order.map(p=>p.id)].includes(requiredPlaceId)) return null;
    return {theme:input.theme || 'balanced',rows,start,end,walkMeters:walked+endWalk.meters,
      endWalk,endArrival:now+endWalk.minutes,originName:origin.name,destinationName:destination.name,
      transport:rows.some(row=>row.mode==='bus') || endWalk.mode==='bus' ? 'walk-bus' : 'walk',
      signature:order.map(p=>p.id).join(',')};
  }
  // 가까운 방문지를 지나쳤다가 먼 곳에서 되돌아오는 순서를 감점한다.
  // 한 블록 안의 짧은 출입·왕복은 걸어온 거리 조건으로 감점하지 않는다.
  function routeDetourPenalty(order,origin) {
    const points=[origin,...order];
    let penalty=0;
    for(let i=0;i<points.length-2;i++) {
      const a=points[i],b=points[i+1],c=points[i+2];
      const ab=distanceKm(a,b),ac=distanceKm(a,c),bc=distanceKm(b,c);
      if(ac<=.22 && ab>=.30 && bc>=.30) penalty+=550;
      else if(ac<=.30 && ab>=ac+.14 && bc>=.25) penalty+=350;
    }
    for(let i=3;i<points.length;i++) {
      const current=points[i];
      if(points.slice(1,i-2).some((earlier)=>distanceKm(earlier,current)<=.12 &&
        distanceKm(points[i-1],earlier)>=.30)) penalty+=400;
    }
    return penalty;
  }
  const routeQuality=(route,order,origin)=>route.walkMeters+routeDetourPenalty(order,origin);
  const routePreference=(route,origin,places,theme)=>routeQuality(route,route.rows.map(row=>places.find(p=>p.id===row.placeId)),origin)
    -400*route.rows.length-250*route.rows.filter(row=>themedPlace(places.find(p=>p.id===row.placeId),theme)).length;
  // 같은 방문지를 유지하면서 실제 도보 구간과 방문 가능한 시각을 다시 확인한다.
  async function improveRoute(route,input,cache) {
    if(route.transport==='walk-bus' || route.chosenMeals?.length || route.rows.length<3) return route;
    const byId=new Map(input.places.map(p=>[p.id,p]));
    const templates=new Map(route.rows.map(row=>[row.placeId,row]));
    const leg=(a,b)=>cache.get([a.id,a.lat,a.lon,b.id,b.lat,b.lon].join(':')) || pointLeg(a,b);
    const attempted=new Set([route.signature]);
    let best=route, confirmations=0;
    const estimatedCount=(candidate)=>candidate.rows.filter(row=>!row.actual).length+Number(!candidate.endWalk.actual);
    for(let pass=0;pass<2;pass++) {
      const order=best.rows.map(row=>byId.get(row.placeId));
      const candidates=[];
      const add=(candidate)=>{
        const signature=candidate.map(p=>p.id).join(',');
        if(attempted.has(signature)) return;
        const walks=[input.origin,...candidate].map((p,i)=>leg(p,candidate[i] || input.destination));
        const scheduled=scheduleVisits(candidate,{...input,scheduledRows:candidate.map(p=>templates.get(p.id))},walks);
        if(scheduled && routeQuality(scheduled,candidate,input.origin)<routeQuality(best,order,input.origin)-50)
          candidates.push({scheduled,candidate,score:routeQuality(scheduled,candidate,input.origin)});
      };
      for(let i=0;i<order.length;i++) for(let j=0;j<order.length;j++) {
        if(i===j) continue;
        const moved=[...order], [place]=moved.splice(i,1);moved.splice(j,0,place);add(moved);
        if(i<j) add([...order.slice(0,i),...order.slice(i,j+1).reverse(),...order.slice(j+1)]);
      }
      candidates.sort((a,b)=>a.score-b.score || a.scheduled.walkMeters-b.scheduled.walkMeters);
      let improved=false;
      for(const {scheduled,candidate} of candidates) {
        if(confirmations>=10) return best;
        if(attempted.has(scheduled.signature)) continue;
        attempted.add(scheduled.signature);confirmations++;
        const checked=await confirmRoute({...best,...scheduled},input,cache);
        if(!checked) continue;
        if(estimatedCount(checked)>estimatedCount(best)) continue;
        if(routeQuality(checked,candidate,input.origin)<routeQuality(best,order,input.origin)-50) {
          best={...checked,routeQualityAdjusted:true};improved=true;break;
        }
      }
      if(!improved) break;
    }
    return best;
  }
  function shortestConnection(from,to,pool,blocked=new Set(),input={}) {
    const nodes=[from,...pool.filter(p=>p.id!==from.id && p.id!==to.id && !blocked.has(p.id)),to];
    const target=nodes.length-1, costs=nodes.map(()=>Infinity), previous=[], done=new Set();
    costs[0]=0;
    for (let step=0;step<nodes.length;step++) {
      let current=-1;
      for (let i=0;i<nodes.length;i++) if (!done.has(i) && (current<0 || costs[i]<costs[current])) current=i;
      if (current<0 || !Number.isFinite(costs[current])) return null;
      if (current===target) {
        const path=[];
        for (let i=target;i!==0;i=previous[i]) path.unshift(nodes[i]);
        return path;
      }
      done.add(current);
      for (let i=1;i<nodes.length;i++) {
        if (done.has(i)) continue;
        const walk=inputLeg(nodes[current],nodes[i],input);
        if (!validLeg(walk)) continue;
        // 거리가 같으면 불필요한 중간 방문을 늘리지 않는다.
        const cost=costs[current]+walk.meters+5;
        if (cost<costs[i]) {costs[i]=cost;previous[i]=current;}
      }
    }
    return null;
  }
  function makeGeographicRoutes(input,focus) {
    const {origin,destination,places,requiredPlaceId=''}=input;
    const span=distanceKm(origin,destination), close=span<.2;
    const pool=places.filter(p=>{
      if (!hasCoord(p) || EXCLUDED_IDS.has(p.id) || p.id===origin.id || p.id===destination.id) return false;
      if (p.id===requiredPlaceId || p.id===input.preferredPlaceId) return true;
      if(input.busConnection && [input.busConnection.from.id,input.busConnection.to.id].includes(p.id)) return true;
      if (['food','cafe'].includes(p.category) && !themedPlace(p,input.theme) && !input.allowRestStops) return false;
      if (close) return distanceKm(origin,p)<=1.3;
      if (focus==='start') return distanceKm(origin,p)<=1.3;
      if (focus==='end') return distanceKm(destination,p)<=1.3;
      const progress=routeProgress(origin,destination,p);
      return progress.off<=.65 && progress.along*span>=-.18 && progress.along*span<=span+.18;
    });
    // 날짜 전체에 방문할 수 없는 장소는 연결점으로도 사용하지 않는다.
    const available=pool.filter(p=>{
      const duration=stay(p,false);
      for(let m=round5(minutes(input.start));m+duration<=minutes(input.end);m+=5)
        if(allowedAt(p,m,false,input.date) && validResult(input.validate(p,m,duration,input.date))) return true;
      return false;
    });
    const required=available.find(p=>p.id===requiredPlaceId);
    if(requiredPlaceId && !required && ![origin.id,destination.id].includes(requiredPlaceId)) return [];
    const endpoints=required ? [origin,required,destination] : [origin,destination];
    let skeleton=[], prior=origin;
    for(const endpoint of endpoints.slice(1)) {
      const connectors=available.filter(p=>!p.shortScenicWalk || p.id===requiredPlaceId);
      const connection=shortestConnection(prior,endpoint,connectors,new Set(skeleton.map(p=>p.id)),input);
      if(!connection) return [];
      skeleton.push(...connection);prior=endpoint;
    }
    skeleton=skeleton.filter(p=>p.id!==destination.id);
    let initial=scheduleVisits(skeleton,input);
    if(!initial) return [];
    const results=[], variants=input.variants || 3, firstChoices=new Set();
    for(let variant=0;variant<variants;variant++) {
      let order=[...skeleton], route=initial;
      for(let step=order.length;step<(input.maxStops || 14);step++) {
        const points=[origin,...order,destination], options=[];
        for(const p of available) {
          if(order.some(x=>x.id===p.id)) continue;
          if(['food','cafe'].includes(p.category) && order.filter(x=>x.category===p.category).length >= (input.theme===p.category ? 2 : 1)) continue;
          for(let i=0;i<points.length-1;i++) {
            const extra=distanceKm(points[i],p)+distanceKm(p,points[i+1])-distanceKm(points[i],points[i+1]);
            if(p.shortScenicWalk && extra>.25) continue;
            options.push({p,i,extra,near:distanceKm(focus==='end'?destination:origin,p)});
          }
        }
        options.sort((a,b)=>
          (step===skeleton.length && variant>0 ? Number(firstChoices.has(a.p.id))-Number(firstChoices.has(b.p.id)) : 0) ||
          Number(b.p.id===input.preferredPlaceId)-Number(a.p.id===input.preferredPlaceId) ||
          (input.theme==='first' && order.filter(p=>themedPlace(p,'first')).length>=3 ? 0 : Number(themedPlace(b.p,input.theme))-Number(themedPlace(a.p,input.theme))) ||
          (focus==='through' || close ? a.extra-b.extra : a.near-b.near) ||
          a.extra-b.extra || a.near-b.near || a.p.id.localeCompare(b.p.id));
        let next=null;
        for(const option of options) {
          const candidate=[...order];candidate.splice(option.i,0,option.p);
          const scheduled=scheduleVisits(candidate,input);
          if(!scheduled) continue;
          next={candidate,scheduled,place:option.p};break;
        }
        if(!next) break;
        if(step===skeleton.length) firstChoices.add(next.place.id);
        order=next.candidate;route=next.scheduled;
      }
      // 같은 장소를 유지한 채 순서를 뒤집어 거리 감소가 가능한 경우만 적용한다.
      for(let pass=0;pass<4;pass++) {
        let improved=false;
        for(let i=0;i<order.length-1 && !improved;i++) for(let j=i+1;j<order.length;j++) {
          const candidate=[...order.slice(0,i),...order.slice(i,j+1).reverse(),...order.slice(j+1)];
          const scheduled=scheduleVisits(candidate,input);
          if(scheduled && scheduled.walkMeters+25<route.walkMeters) {order=candidate;route=scheduled;improved=true;break;}
        }
        if(!improved) break;
      }
      if(route.rows.length<(input.theme==='balanced'?1:2) || results.some(r=>r.signature===route.signature)) continue;
      results.push({...route,id:'route-'+focus+'-'+variant,title:variant===0?'가까운 길부터':variant===1?'다른 출발 순서':'다른 길로',routeFocus:focus});
    }
    return results;
  }
  async function confirmRoute(route,input,cache=new Map()) {
    if(!input.routeProvider) return null;
    const order=route.rows.map(row=>input.places.find(p=>p.id===row.placeId));
    const points=[input.origin,...order,input.destination], walks=[];
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1],key=[a.id,a.lat,a.lon,b.id,b.lat,b.lon].join(':');
      const existing=i<route.rows.length ? route.rows[i].busLeg : route.endWalk.mode==='bus' ? route.endWalk : null;
      if(existing) {walks.push(existing);continue;}
      if(!cache.has(key)) {
        let walk=pointLeg(a,b);
        if(walk.meters) try {
          const actual=await input.routeProvider(a,b);
          if(actual?.meters>0 && actual?.minutes>0) walk={...actual,actual:true};
        } catch { /* API 연결 실패는 추정 구간으로 표시한다. */ }
        cache.set(key,walk);
      }
      walks.push(cache.get(key));
    }
    if(walks.some(walk=>!walk.actual)) return null;
    const scheduled=scheduleVisits(order,{...input,scheduledRows:route.rows,fixedMeals:!!route.chosenMeals?.length},walks);
    return scheduled ? {...route,...scheduled,chosenMeals:(route.chosenMeals || []).map(meal=>({...meal,minute:scheduled.rows.find(row=>row.placeId===meal.placeId)?.minute ?? meal.minute}))} : null;
  }
  async function verifyEditedRoute(route,input) {
    const time=(minute)=>minute===1440 ? '24:00' : String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
    return confirmRoute(route,{...input,start:time(route.start),end:time(route.end)},new Map());
  }
  // 실제 경로 확인으로 일정이 밀려도 전체 코스를 즉시 버리지 않는다.
  // 같은 방문지의 순서를 먼저 탐색하고, 실패한 경우에만 선택 방문지를 줄인다.
  async function confirmOrRepairRoute(route,input,cache) {
    const confirmed=await confirmRoute(route,input,cache);
    if(confirmed) return improveRoute(confirmed,input,cache);
    // 사용자가 고정한 식사와 버스 연결은 별도 편집 규칙을 유지한다.
    if(route.chosenMeals?.length || route.transport==='walk-bus') return null;
    const original=route.rows.map(row=>input.places.find(p=>p.id===row.placeId));
    const templates=new Map(route.rows.map(row=>[row.placeId,row]));
    const leg=(a,b)=>cache.get([a.id,a.lat,a.lon,b.id,b.lat,b.lon].join(':')) || pointLeg(a,b);
    const schedule=order=>scheduleVisits(order,{...input,scheduledRows:order.map(p=>templates.get(p.id))},
      [input.origin,...order].map((p,i)=>leg(p,order[i] || input.destination)));
    const distance=order=>[input.origin,...order].reduce((sum,p,i)=>sum+leg(p,order[i] || input.destination).meters,0);
    const attempted=new Set();
    let sets=[original], confirmations=0;
    for(let count=original.length;count>=2 && sets.length;count--) {
      const orders=new Map();
      const add=order=>orders.set(order.map(p=>p.id).join(','),order);
      for(const order of sets) {
        add(order);
        for(let i=0;i<order.length;i++) for(let j=0;j<order.length;j++) {
          if(i===j) continue;
          const moved=[...order], [p]=moved.splice(i,1);moved.splice(j,0,p);add(moved);
          if(i<j) add([...order.slice(0,i),...order.slice(i,j+1).reverse(),...order.slice(j+1)]);
        }
      }
      // 재조회가 알려 준 이동시간으로 남은 후보도 다시 검사한다.
      for(let attempt=0;attempt<8 && confirmations<24;attempt++) {
        const candidates=[];
        for(const [signature,order] of orders) {
          if(attempted.has(signature)) continue;
          const scheduled=schedule(order);
          if(scheduled) candidates.push({order,scheduled});
        }
        candidates.sort((a,b)=>a.scheduled.walkMeters-b.scheduled.walkMeters || a.scheduled.endArrival-b.scheduled.endArrival);
        if(!candidates.length) break;
        const {order,scheduled}=candidates[0];
        attempted.add(scheduled.signature);confirmations++;
        const repaired=await confirmRoute({...route,...scheduled},input,cache);
        if(repaired) return improveRoute({...repaired,actualTimeAdjusted:true,
          adjustedDroppedNames:original.filter(p=>!order.some(x=>x.id===p.id)).map(p=>p.name)},input,cache);
      }
      if(confirmations>=24) return null;
      const reduced=new Map();
      for(const order of sets) for(let i=0;i<order.length;i++) {
        if(order[i].id===input.requiredPlaceId) continue;
        const candidate=order.filter((_,j)=>j!==i), key=candidate.map(p=>p.id).sort().join(',');
        if(!reduced.has(key)) reduced.set(key,candidate);
      }
      // 탐색·API 비용을 제한한다. 전역 최적해나 모든 가능한 순서를 보장하지 않는다.
      sets=[...reduced.values()].sort((a,b)=>
        Number(b.some(p=>p.id===input.preferredPlaceId))-Number(a.some(p=>p.id===input.preferredPlaceId)) ||
        b.filter(p=>themedPlace(p,input.theme)).length-a.filter(p=>themedPlace(p,input.theme)).length || distance(a)-distance(b)).slice(0,24);
    }
    return null;
  }
  async function busFallback(input,cache=new Map()) {
    if(!input.busProvider || distanceKm(input.origin,input.destination)<.2) return [];
    const pool=input.places.filter(p=>hasCoord(p)&&!EXCLUDED_IDS.has(p.id)&&!['food','cafe'].includes(p.category));
    const nearby=point=>[point,...pool.filter(p=>p.id!==point.id&&distanceKm(point,p)<1)
      .sort((a,b)=>distanceKm(point,a)-distanceKm(point,b)).slice(0,2)];
    const pairs=nearby(input.origin).flatMap(from=>nearby(input.destination).map(to=>({from,to})))
      .filter(pair=>distanceKm(pair.from,pair.to)>1 && !(samePoint(pair.from,input.origin)&&samePoint(pair.to,input.destination)))
      .sort((a,b)=>(distanceKm(input.origin,a.from)+distanceKm(a.to,input.destination))-(distanceKm(input.origin,b.from)+distanceKm(b.to,input.destination)));
    for(const pair of pairs) {
      let options;
      try {options=await input.busProvider(pair.from,pair.to);} catch {return [];}
      for(const bus of options || []) {
        if(!bus.steps?.some(s=>s.type==='BUS') || bus.steps.some(s=>!['BUS','WALK','WALKING'].includes(s.type))) continue;
        const riding=busRideMinutes(bus);
        if(riding==null || riding>=60) continue;
        if(!Number.isFinite(bus.walkMeters)||!Number.isFinite(bus.walkMinutes)||!(bus.minutes>0)) continue;
        const leg={mode:'bus',actual:true,meters:bus.walkMeters,walkMinutes:bus.walkMinutes,minutes:bus.minutes,
          travelMeters:bus.meters,points:bus.points || [],steps:bus.steps,busRideMinutes:riding,
          savedBusId:bus.savedBusId,busStops:bus.busStops,busPoints:bus.busPoints,
          timetable:bus.timetable,serviceNotice:bus.serviceNotice,estimated:bus.estimated};
        if(!validLeg(leg)) continue;
        const connected={...input,busConnection:{...pair,leg}};
        for(const focus of ['through','start','end']) for(const proposed of makeGeographicRoutes(connected,focus)) {
          if(proposed.transport!=='walk-bus') continue;
          const checked=await confirmRoute(proposed,connected,cache);
          if(checked) return [{...checked,requestedFocus:input.routeFocus || 'through',fallbackFocus:focus!==(input.routeFocus || 'through')?focus:null,
            busFallback:true,title:'도보 + 버스 연결'}];
        }
      }
    }
    return [];
  }
  // 확정 코스가 없더라도 선택한 위치와 가까운 방문지를 지도에서 검토할 수 있게 잇는다.
  // 이 결과는 영업·도착·이동 가능 판정을 통과한 추천 코스가 아니다.
  async function generateReviewRoute(input) {
    const {places,origin,destination,requiredPlaceId='',date,validate,routeProvider,busProvider}=input;
    if(!hasCoord(origin) || !hasCoord(destination)) return null;
    const required=places.find(p=>p.id===requiredPlaceId && hasCoord(p));
    const anchors=[origin,...(required?[required]:[]),destination];
    const pool=places.filter(p=>hasCoord(p) && !EXCLUDED_IDS.has(p.id) &&
      p.id!==origin.id && p.id!==destination.id && p.id!==requiredPlaceId);
    const near=(p)=>Math.min(...anchors.map(anchor=>distanceKm(anchor,p)));
    pool.sort((a,b)=>near(a)-near(b));
    const themed=input.theme && input.theme!=='balanced' ? pool.filter(p=>themedPlace(p,input.theme)) : [];
    const selected=(themed.length ? themed : pool).slice(0,2);
    if(!themed.length) {
      const meal=pool.find(p=>['food','cafe'].includes(p.category) && !selected.some(q=>q.id===p.id));
      if(meal && selected.length===2 && near(meal)<=near(selected[1])+.35) selected[1]=meal;
    }
    let order=required && !samePoint(required,origin) && !samePoint(required,destination) ? [required] : [];
    for(const p of selected) {
      let best=null;
      for(let at=0;at<=order.length;at++) {
        const candidate=[...order];candidate.splice(at,0,p);
        const points=[origin,...candidate,destination];
        const score=points.slice(1).reduce((sum,point,i)=>sum+distanceKm(points[i],point)*1000,0)
          +routeDetourPenalty(candidate,origin);
        if(!best || score<best.score) best={candidate,score};
      }
      order=best.candidate;
    }
    const issues=[];
    if(requiredPlaceId && !required)
      issues.push('꼭 가고 싶은 장소의 위치를 확인하지 못해 지도에 연결하지 않았습니다.');
    if(input.theme && input.theme!=='balanced' && !themed.length)
      issues.push('선택한 테마에 맞는 등록 장소의 위치를 확인하지 못해 가까운 다른 장소를 표시했습니다.');
    const transitCache=new Map();
    async function transit(a,b) {
      const key=[a.id,a.lat,a.lon,b.id,b.lat,b.lon].join(':');
      if(!transitCache.has(key)) {
        let routes=[];
        if(busProvider) try { routes=await busProvider(a,b) || []; } catch { /* 미확인으로 남긴다. */ }
        transitCache.set(key,routes.filter(route=>route.steps?.some(step=>step.type==='BUS')));
      }
      return transitCache.get(key);
    }
    const relevant=pool.filter(p=>['food','cafe','outdoors','culture','experience'].includes(p.category));
    for(const anchor of anchors.filter((p,i)=>anchors.findIndex(q=>samePoint(p,q))===i)) {
      const closest=[...relevant].sort((a,b)=>distanceKm(anchor,a)-distanceKm(anchor,b))[0];
      if(!closest || distanceKm(anchor,closest)<=1.3) continue;
      const rides=await transit(anchor,closest);
      const known=rides.map(busRideMinutes).filter(Number.isFinite);
      if(known.length && Math.min(...known)>=60)
        issues.push(anchor.name+'에서 가까운 방문지까지 버스 탑승만 60분 이상이라 뚜벅이 여행 권역을 벗어납니다.');
      else if(!known.length) issues.push(anchor.name+'에서 주변 방문지까지의 버스 탑승시간을 확인하지 못했습니다.');
    }
    const points=[origin,...order,destination],legs=[];
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1],direct=distanceKm(a,b);
      if(direct<.015) {legs.push({meters:0,minutes:0,actual:true,points:[]});continue;}
      let walk=null;
      if(direct<=1.3 && routeProvider) try {
        const actual=await routeProvider(a,b);
        if(actual?.meters>0 && actual?.minutes>0) walk={...actual,actual:true};
      } catch { /* 아래에서 추정 이동으로 표시한다. */ }
      if(walk && walk.meters<=1600 && walk.minutes<=30) {legs.push(walk);continue;}
      const rides=direct>1.3 || walk?.meters>1600 || walk?.minutes>30 ? await transit(a,b) : [];
      const bus=rides.sort((x,y)=>x.minutes-y.minutes)[0];
      if(bus) {
        legs.push({mode:'bus',actual:true,meters:bus.walkMeters || 0,walkMinutes:bus.walkMinutes || 0,
          minutes:bus.minutes,points:bus.points || [],steps:bus.steps,busRideMinutes:busRideMinutes(bus),
          savedBusId:bus.savedBusId,busStops:bus.busStops,busPoints:bus.busPoints,
          timetable:bus.timetable,serviceNotice:bus.serviceNotice,estimated:bus.estimated});
      } else legs.push(walk || estimate(a,b));
    }
    let now=minutes(input.start),walked=0;
    const rows=order.map((p,i)=>{
      const leg=legs[i],duration=stay(p,false);
      now=round5(now+leg.minutes+3);
      const result=validate(p,Math.min(now,1435),duration,date);
      if(result.kind==='bad' || result.kind==='warn') issues.push(p.name+': '+result.title);
      else if(result.kind==='unknown') issues.push(p.name+': 운영시간 확인이 필요합니다.');
      if(leg.mode==='bus' && leg.busRideMinutes>=60) issues.push(p.name+' 이동: 버스 탑승만 약 '+Math.round(leg.busRideMinutes)+'분입니다.');
      if(leg.mode==='bus' && leg.busRideMinutes==null) issues.push(p.name+' 이동: 버스 탑승시간을 확인하지 못했습니다.');
      if(leg.mode!=='bus' && (leg.meters>1600 || leg.minutes>30)) issues.push(p.name+' 이동: 도보 한 구간 1.6km·30분 기준을 넘습니다.');
      if(!leg.actual) issues.push(p.name+' 이동: 실제 보행 경로를 확인하지 못했습니다.');
      walked+=leg.meters;
      const row={placeId:p.id,minute:now,duration,walkEstimate:leg.minutes,walkMeters:leg.meters,
        walkPoints:leg.points || [],actual:leg.actual,mode:leg.mode || 'walk',result,kind:'visit',busLeg:leg.mode==='bus'?leg:null};
      now+=duration;
      return row;
    });
    const endWalk=legs.at(-1),endArrival=now+endWalk.minutes;
    walked+=endWalk.meters;
    if(endWalk.mode==='bus' && endWalk.busRideMinutes>=60) issues.push('도착지 이동: 버스 탑승만 약 '+Math.round(endWalk.busRideMinutes)+'분입니다.');
    if(endWalk.mode==='bus' && endWalk.busRideMinutes==null) issues.push('도착지 이동: 버스 탑승시간을 확인하지 못했습니다.');
    if(endWalk.mode!=='bus' && (endWalk.meters>1600 || endWalk.minutes>30)) issues.push('도착지 이동: 도보 한 구간 1.6km·30분 기준을 넘습니다.');
    if(!endWalk.actual) issues.push('도착지 이동: 실제 보행 경로를 확인하지 못했습니다.');
    if(endArrival>minutes(input.end)) issues.push('예상 도착이 설정한 종료 시각을 넘습니다.');
    if(walked>8000) issues.push('예상 하루 도보가 8km 기준을 넘습니다.');
    if(!order.length) issues.push('연결할 주변 등록 장소를 찾지 못했습니다.');
    return {review:true,title:'검토용 루트',originName:origin.name,destinationName:destination.name,
      rows,endWalk,walkMeters:walked,start:minutes(input.start),end:minutes(input.end),endArrival,
      issues:[...new Set(issues)],busRideLimit:60};
  }
  async function generateAdaptive(input) {
    if (input.mealTimes?.length) return generate(input);
    if(!hasCoord(input.origin)||!hasCoord(input.destination) ||
      !(minutes(input.start)>=0 && minutes(input.end)<=1440 && minutes(input.start)<minutes(input.end))) return [];
    const requested=input.routeFocus || 'through';
    const focuses=[requested,...['start','end','through'].filter(f=>f!==requested)];
    const cache=new Map();
    for(const focus of focuses) {
      const proposed=makeGeographicRoutes(input,focus), checked=[];
      for(const route of proposed) {
        const result=await confirmOrRepairRoute(route,input,cache);
        if(!result || checked.some(other=>other.signature===result.signature)) continue;
        checked.push({...result,requestedFocus:requested,fallbackFocus:focus!==requested?focus:null});
      }
      if(checked.length) {
        checked.sort((a,b)=>routePreference(a,input.origin,input.places,input.theme)-routePreference(b,input.origin,input.places,input.theme));
        return checked.map((route,index)=>({...route,title:index===0?'가까운 길부터':index===1?'다른 출발 순서':'다른 길로'}));
      }
    }
    return busFallback(input,cache);
  }
  async function reverseRoundTrip({route,places,origin,date,validate,routeProvider,requiredPlaceId=''}) {
    if (!hasCoord(origin) || route.rows.length < 2) return null;
    const rows=[];
    let prior=origin, now=route.start, walked=0, dropped=0;
    for (const original of [...route.rows].reverse()) {
      const place=places.find((item) => item.id === original.placeId);
      if (!hasCoord(place)) { if (original.placeId === requiredPlaceId) return null; dropped++; continue; }
      let walk=estimate(prior,place);
      if (distanceKm(prior,place) < .015) walk={meters:0,minutes:0,actual:true,points:[]};
      else if (distanceKm(prior,place) <= 1.3 && routeProvider) {
        try { const actual=await routeProvider(prior,place); if (actual?.meters > 0 && actual?.minutes > 0) walk={meters:actual.meters,minutes:actual.minutes,actual:true,points:actual.points || []}; } catch { /* 추정 구간으로 표시 */ }
      }
      if (!walk.actual || walk.meters > 1600 || walk.minutes > 30 || walked+walk.meters > 8000) { if (original.placeId === requiredPlaceId) return null; dropped++; continue; }
      let minute=round5(now+walk.minutes+3);
      if(route.autoSchedule && ['meal','cafe'].includes(original.kind)) {
        const previous=rows.filter(row=>row.kind===original.kind).at(-1);
        if(original.kind==='meal') minute=Math.max(minute,660);
        if(previous) minute=Math.max(minute,previous.minute+(original.kind==='meal'?180:100));
      }
      if (minute+original.duration > route.end || !allowedAt(place,minute,original.kind === 'meal',date)) { if (original.placeId === requiredPlaceId) return null; dropped++; continue; }
      const result=validate(place,minute,original.duration,date);
      if (result.kind === 'bad' || (result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(result.title))) { if (original.placeId === requiredPlaceId) return null; dropped++; continue; }
      rows.push({...original,minute,walkEstimate:walk.minutes,walkMeters:walk.meters,walkPoints:walk.points || [],actual:walk.actual,result});
      walked+=walk.meters; now=minute+original.duration; prior=place;
    }
    let finalLeg;
    while (rows.length >= 2) {
      finalLeg=estimate(prior,origin);
      if (distanceKm(prior,origin) < .015) finalLeg={meters:0,minutes:0,actual:true,points:[]};
      else if (distanceKm(prior,origin) <= 1.3 && routeProvider) {
        try { const actual=await routeProvider(prior,origin); if (actual?.meters > 0 && actual?.minutes > 0) finalLeg={meters:actual.meters,minutes:actual.minutes,actual:true,points:actual.points || []}; } catch { /* 추정 구간으로 표시 */ }
      }
      if (finalLeg.actual && finalLeg.meters <= 1600 && finalLeg.minutes <= 30 && walked+finalLeg.meters <= 8000 && now+finalLeg.minutes <= route.end) break;
      const last=rows.pop(); if (last.placeId === requiredPlaceId) return null;
      walked-=last.walkMeters; dropped++; prior=rows.length ? places.find((item) => item.id === rows.at(-1).placeId) : origin;
      now=rows.length ? rows.at(-1).minute+rows.at(-1).duration : route.start;
    }
    if (rows.length < 2) return null;
    return {...route,id:route.id+'-reverse',title:route.title+' · 반대 방향',rows,walkMeters:walked+finalLeg.meters,
      endWalk:finalLeg,endArrival:now+finalLeg.minutes,signature:rows.map((row) => row.placeId).join(','),reversed:true,reverseDropped:dropped,chosenMeals:[],plannedMeals:rows.filter(row=>row.kind==='meal').map(row=>row.minute)};
  }
  function mealChoices({route,places,origin,destination,date,validate,requiredPlaceId='',kind='lunch',cuisineTags=[],candidateFilter=()=>true,mealDuration}) {
    const window=kind === 'dinner' ? [17*60,21*60] : kind === 'lunch' ? [11*60,15*60] : [route.start,route.end];
    const duration=mealDuration || (kind === 'cafe' ? 40 : 60);
    const restaurants=places.filter((p) => hasCoord(p) && p.category === (kind === 'cafe' ? 'cafe' : 'food') && !EXCLUDED_IDS.has(p.id) && candidateFilter(p) &&
      !route.rows.some((row) => row.placeId === p.id) &&
      (!cuisineTags.length || cuisineTags.some(tag => p.cuisineTags?.includes(tag))));
    const byPlace=new Map();
    function consider(insertAt,replaceIndex) {
      const previous=insertAt ? route.rows[insertAt-1] : null;
      const followingIndex=replaceIndex == null ? insertAt : insertAt+1;
      const following=route.rows[followingIndex];
      // 식사 추가로 확정 버스 구간의 양 끝 장소를 바꾸지 않는다.
      if(route.rows[insertAt]?.mode==='bus' || following?.mode==='bus' || (!following && route.endWalk.mode==='bus')) return;
      const from=previous ? places.find((p) => p.id === previous.placeId) : origin;
      const to=following ? places.find((p) => p.id === following.placeId) : destination;
      if (!from || !to) return;
      const earliest=previous ? previous.minute+previous.duration : route.start;
      for (const p of restaurants) {
        const incoming=estimate(from,p), outgoing=estimate(p,to);
        if (incoming.meters > 1600 || outgoing.meters > 1600 || incoming.minutes > 30 || outgoing.minutes > 30) continue;
        const oldMinute=replaceIndex == null ? earliest : route.rows[replaceIndex].minute;
        const first=round5(Math.max(earliest+incoming.minutes+3,window[0],oldMinute));
        const last=Math.min(window[1],route.end-duration);
        for (let minute=first; minute<=last; minute+=5) {
          if (!allowedAt(p,minute,true,date)) continue;
          const result=validate(p,minute,duration,date);
          if (result.kind === 'bad' || (result.kind === 'warn' && /체류 중 브레이크|폐관을 넘/.test(result.title))) continue;
          const option={kind,placeId:p.id,placeName:p.name,minute,duration,insertAt,replaceIndex,
            replaceName:replaceIndex == null ? '' : places.find((item) => item.id === route.rows[replaceIndex].placeId)?.name || '',
            incoming,outgoing,result};
          const preview=previewMeal(route,option,places,origin,destination,date,validate,requiredPlaceId);
          if (!preview) continue;
          option.preview=preview;
          option.score=(replaceIndex == null ? 0 : 2)+preview.droppedVisits*5+
            Math.max(0,preview.walkMeters-route.walkMeters)/500+(result.kind === 'unknown' ? 2 : 0);
          if (!byPlace.has(p.id)) byPlace.set(p.id,new Map());
          const times=byPlace.get(p.id), existing=times.get(minute);
          if (!existing || option.score < existing.score) times.set(minute,option);
        }
      }
    }
    for (let i=0; i<=route.rows.length; i++) {
      consider(i,null);
      if (i<route.rows.length && !['meal','cafe'].includes(route.rows[i].kind) && route.rows[i].placeId !== requiredPlaceId) consider(i,i);
    }
    const groupRanges=(slots) => {
      const ranges=[];
      for (const slot of slots) {
        const last=ranges.at(-1);
        if (last && slot.minute === last[1]+5) last[1]=slot.minute;
        else ranges.push([slot.minute,slot.minute]);
      }
      return ranges;
    };
    return [...byPlace.entries()].map(([placeId,times]) => {
      const slots=[...times.values()].sort((a,b) => a.minute-b.minute);
      const safe=slots.filter((slot) => !slot.replaceName && !slot.preview.droppedVisits);
      const best=(safe.length ? safe : slots).reduce((a,b) => b.score<a.score ? b : a);
      return {...best,placeId,slots,ranges:groupRanges(slots),safeRanges:groupRanges(safe),
        changeRanges:groupRanges(slots.filter((slot) => slot.replaceName || slot.preview.droppedVisits)),safeCount:safe.length};
    }).sort((a,b) => Number(b.safeCount>0)-Number(a.safeCount>0) || a.score-b.score || a.minute-b.minute || a.placeName.localeCompare(b.placeName,'ko'));
  }
  function previewMeal(route,choice,places,origin,destination,date,validate,requiredPlaceId) {
    const rows=route.rows.map((row) => ({...row}));
    const originalMinutes=new Map(route.rows.map(row=>[row.placeId,row.minute]));
    let droppedVisits=0;
    const droppedPlaceNames=[];
    if (choice.replaceIndex != null) rows.splice(choice.replaceIndex,1);
    rows.splice(choice.insertAt,0,{minute:choice.minute,placeId:choice.placeId,duration:choice.duration || 60,
      walkEstimate:choice.incoming.minutes,walkMeters:choice.incoming.meters,actual:false,
      result:choice.result,kind:choice.kind === 'cafe' ? 'cafe' : 'meal'});
    const following=rows[choice.insertAt+1];
    if (following) {
      following.walkEstimate=choice.outgoing.minutes;
      following.walkMeters=choice.outgoing.meters;
      following.actual=false;
      following.walkPoints=[];
      following.mode='walk';following.busLeg=null;
    }
    function releaseTimeBefore(index) {
      let remove=index-1;
      while(remove>choice.insertAt && (['meal','cafe'].includes(rows[remove].kind) || rows[remove].placeId===requiredPlaceId || rows[remove].mode==='bus' || rows[remove+1]?.mode==='bus' || (remove===rows.length-1 && route.endWalk.mode==='bus'))) remove--;
      if(remove<=choice.insertAt || droppedVisits>=2) return false;
      const removed=rows.splice(remove,1)[0];droppedVisits++;
      droppedPlaceNames.push(places.find(p=>p.id===removed.placeId)?.name || removed.placeId);
      const before=places.find(p=>p.id===rows[remove-1].placeId), after=places.find(p=>p.id===rows[remove].placeId);
      const walk=pointLeg(before,after);
      if(!validLeg(walk)) return false;
      Object.assign(rows[remove],{walkEstimate:walk.minutes,walkMeters:walk.meters,actual:walk.actual,walkPoints:[]});
      for(const reset of rows.slice(choice.insertAt+1)) reset.minute=originalMinutes.get(reset.placeId);
      return true;
    }
    for (let i=choice.insertAt+1; i<rows.length; i++) {
      const previous=rows[i-1], row=rows[i];
      const earliest=round5(previous.minute+previous.duration+row.walkEstimate+3);
      const locked=['meal','cafe'].includes(row.kind) || (route.chosenMeals || []).some(meal=>meal.placeId===row.placeId);
      if (locked && earliest>originalMinutes.get(row.placeId)) {
        // 확정된 식사 앞의 일반 방문을 줄일 수 있을 때만 다시 제안한다.
        if(!releaseTimeBefore(i)) return null;
        i=choice.insertAt;continue;
      }
      row.minute=locked ? row.minute : Math.max(row.minute,earliest);
      const p=places.find((item) => item.id === row.placeId);
      if (!p) return null;
      if (!allowedAt(p,row.minute,row.kind === 'meal',date)) {
        if(!releaseTimeBefore(i)) return null;
        i=choice.insertAt;continue;
      }
      if (row.kind === 'meal' || row.kind === 'cafe') {
        const previousMeal=(route.chosenMeals || []).find((item) => item.placeId === row.placeId);
        const mealWindow=previousMeal?.kind === 'dinner' ? [17*60,21*60] : previousMeal?.kind === 'lunch' ? [11*60,15*60] : [route.start,route.end];
        if (row.minute < mealWindow[0] || row.minute > mealWindow[1]) return null;
      }
      row.result=validate(p,row.minute,row.duration,date);
      if (!validResult(row.result)) {
        if(!releaseTimeBefore(i)) return null;
        i=choice.insertAt;continue;
      }
    }
    while (rows.length >= 2) {
      const last=rows.at(-1), lastPlace=places.find((p) => p.id === last.placeId);
      const finalLeg=last.placeId===route.rows.at(-1)?.placeId ? route.endWalk : last.placeId===choice.placeId ? choice.outgoing : pointLeg(lastPlace,destination);
      const endArrival=last.minute+last.duration+finalLeg.minutes;
      const walkMeters=rows.reduce((sum,row) => sum+row.walkMeters,0)+finalLeg.meters;
      if (last.minute+last.duration <= route.end && validLeg(finalLeg) &&
          endArrival <= route.end && walkMeters <= 8000) {
        const chosenMeals=[...(route.chosenMeals || []).map((item) => ({...item})),
          {kind:choice.kind,placeId:choice.placeId,minute:choice.minute}];
        return {...route,rows,walkMeters,endWalk:finalLeg,endArrival,droppedVisits,droppedPlaceNames,chosenMeals};
      }
      if (droppedVisits >= 2 || last.placeId === requiredPlaceId || ['meal','cafe'].includes(last.kind) || last.mode==='bus' || finalLeg.mode==='bus') break;
      rows.pop(); droppedVisits++;droppedPlaceNames.push(lastPlace.name);
    }
    return null;
  }
  function addMeal(route,choice) { return choice.preview; }
  function restoreFixedMeals(route,meals,context) {
    let current=route;
    for(const meal of [...meals].sort((a,b)=>a.minute-b.minute)) {
      const choice=mealChoices({...context,route:current,kind:meal.kind==='cafe'?'cafe':'meal'})
        .find(item=>item.placeId===meal.placeId)?.slots.find(slot=>slot.minute===meal.minute);
      if(!choice) return null;
      current=addMeal(current,choice);
      current.chosenMeals=current.chosenMeals.map(item=>item.placeId===meal.placeId ? {...item,period:meal.period} : item);
    }
    return current;
  }
  function recommendMealTimes(choices,{from,to,target}) {
    // 각 식사 시간대에서 음식점별 한 시각만 제안한다. 장소 수는 제한하지 않는다.
    return choices.flatMap(choice=>{
      const slots=choice.slots.filter(slot=>slot.minute>=from && slot.minute<to);
      slots.sort((a,b)=>Number(!!a.replaceName || !!a.preview.droppedVisits)-Number(!!b.replaceName || !!b.preview.droppedVisits) ||
        a.preview.droppedVisits-b.preview.droppedVisits || a.preview.walkMeters-b.preview.walkMeters ||
        Math.abs(a.minute-target)-Math.abs(b.minute-target) || a.minute-b.minute);
      return slots.length ? [{choice,slot:slots[0]}] : [];
    });
  }
  async function generateThemeDay(input) {
    const cache=new Map(), candidates=[];
    const themedCount=route=>route.rows.filter(row=>themedPlace(input.places.find(p=>p.id===row.placeId),input.theme)).length+(input.theme==='sea' && (themedPlace(input.origin,'sea') || themedPlace(input.destination,'sea')) ? 1 : 0);
    // 테마에 맞는 장소를 가까운 동선으로 묶고, 식사·휴식 여유를 남긴다.
    const plans=[{start:'10:00',end:'19:00'},{start:'11:00',end:'20:00'}];
    for(const plan of plans) {
      for(const allowRestStops of (input.theme==='sea' ? [false,true] : [false])) {
        const context={...input,...plan,maxStops:8,variants:2,allowRestStops,flexibleMeals:true};
        let found=false;
        for(const focus of ['through','start','end']) {
          const routes=makeGeographicRoutes(context,focus).filter(themedCount);
          if(routes.length) {candidates.push(...routes.map(route=>({route,context})));found=true;break;}
        }
        if(found) break;
      }
    }
    candidates.sort((a,b)=>routePreference(a.route,a.context.origin,a.context.places,a.context.theme)
      -routePreference(b.route,b.context.origin,b.context.places,b.context.theme));
    async function finish(route,context) {
      let checked=await confirmOrRepairRoute(route,context,cache);
      if(!checked || !themedCount(checked)) return null;
      // 실제 도보 시간으로 먼저 맞춘 뒤 식사를 넣어 뒤 일정의 밀림을 확인한다.
      if(!checked.rows.some(row=>row.kind==='meal')) {
        const options=recommendMealTimes(mealChoices({...context,route:checked,kind:'lunch'}),{from:660,to:900,target:750});
        options.sort((a,b)=>a.slot.preview.droppedVisits-b.slot.preview.droppedVisits || Math.abs(a.slot.minute-750)-Math.abs(b.slot.minute-750) || a.slot.preview.walkMeters-b.slot.preview.walkMeters);
        for(const item of options) {
          if(!themedCount(item.slot.preview)) continue;
          const withLunch=await confirmRoute(item.slot.preview,context,cache);
          if(withLunch) {checked=withLunch;break;}
        }
      }
      const first=checked.rows[0];
      const departure=first.minute-checked.start-first.walkEstimate>25 ? Math.max(checked.start,Math.floor((first.minute-first.walkEstimate-3)/5)*5) : checked.start;
      return {...checked,id:'theme-day',title:(THEMES.find(t=>t.id===input.theme)?.name || '테마')+' 하루 코스',
        start:departure,end:round5(checked.endArrival),autoSchedule:true,plannedMeals:checked.rows.filter(row=>row.kind==='meal').map(row=>row.minute)};
    }
    let best=null, evaluated=0;
    for(const {route,context} of candidates) {
      const result=await finish(route,context);
      if(!result) continue;
      evaluated++;
      if(!best || routePreference(result,context.origin,context.places,context.theme)<best.score)
        best={result,score:routePreference(result,context.origin,context.places,context.theme)};
      if(evaluated>=4) break;
    }
    if(best) return [best.result];
    // 모든 도보 후보가 불가능한 경우에만 실제 버스 연결을 조회한다.
    const context={...input,...plans[0],maxStops:8,variants:1};
    for(const route of await busFallback(context,cache)) {
      const result=await finish(route,context);
      if(result) return [result];
    }
    return [];
  }
  const api={THEMES,THEME_PRESETS,SHOP_IDS,EXCLUDED_IDS,minutes,distanceKm,estimate,themeScore,stay,datedHours,generate,generateAdaptive,generateReviewRoute,verifyEditedRoute,reverseRoundTrip,generateThemeDay,mealChoices,recommendMealTimes,restoreFixedMeals,addMeal};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumRouteEngine=api;
})();
