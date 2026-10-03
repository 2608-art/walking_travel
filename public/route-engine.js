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
          if (routed?.meters > 0 && routed?.minutes > 0) value = {meters:routed.meters,minutes:routed.minutes,actual:true,points:routed.points || []};
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
        rows.push({minute:visit,placeId:p.id,duration,walkEstimate:walk.minutes,walkMeters:walk.meters,actual:walk.actual,walkPoints:walk.points || [],result,kind:mealDue?'meal':'visit'});
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
        actual:walk.actual,walkPoints:walk.points || [],result,kind,mode:walk.mode || 'walk',busLeg:walk.mode==='bus'?walk:null});
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
      const connection=shortestConnection(prior,endpoint,available,new Set(skeleton.map(p=>p.id)),input);
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
      if(route.rows.length<2 || results.some(r=>r.signature===route.signature)) continue;
      results.push({...route,id:'route-'+focus+'-'+variant,title:variant===0?'가까운 길부터':variant===1?'다른 출발 순서':'다른 길로',routeFocus:focus});
    }
    return results;
  }
  async function confirmRoute(route,input,cache=new Map()) {
    if(!input.routeProvider) return route;
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
    const scheduled=scheduleVisits(order,{...input,scheduledRows:route.rows,fixedMeals:!!route.chosenMeals?.length},walks);
    return scheduled ? {...route,...scheduled,chosenMeals:(route.chosenMeals || []).map(meal=>({...meal,minute:scheduled.rows.find(row=>row.placeId===meal.placeId)?.minute ?? meal.minute}))} : null;
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
        if(!Number.isFinite(bus.walkMeters)||!Number.isFinite(bus.walkMinutes)||!(bus.minutes>0)) continue;
        const leg={mode:'bus',actual:true,meters:bus.walkMeters,walkMinutes:bus.walkMinutes,minutes:bus.minutes+10,
          travelMeters:bus.meters,points:bus.points || [],steps:bus.steps,waitBuffer:10};
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
        const result=await confirmRoute(route,input,cache);
        if(!result) continue;
        checked.push({...result,requestedFocus:requested,fallbackFocus:focus!==requested?focus:null});
      }
      if(checked.length) return checked;
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
      if (walk.meters > 1600 || walk.minutes > 30 || walked+walk.meters > 8000) { if (original.placeId === requiredPlaceId) return null; dropped++; continue; }
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
      if (finalLeg.meters <= 1600 && finalLeg.minutes <= 30 && walked+finalLeg.meters <= 8000 && now+finalLeg.minutes <= route.end) break;
      const last=rows.pop(); if (last.placeId === requiredPlaceId) return null;
      walked-=last.walkMeters; dropped++; prior=rows.length ? places.find((item) => item.id === rows.at(-1).placeId) : origin;
      now=rows.length ? rows.at(-1).minute+rows.at(-1).duration : route.start;
    }
    if (rows.length < 2) return null;
    return {...route,id:route.id+'-reverse',title:route.title+' · 반대 방향',rows,walkMeters:walked+finalLeg.meters,
      endWalk:finalLeg,endArrival:now+finalLeg.minutes,signature:rows.map((row) => row.placeId).join(','),reversed:true,reverseDropped:dropped,chosenMeals:[],plannedMeals:rows.filter(row=>row.kind==='meal').map(row=>row.minute)};
  }
  function mealChoices({route,places,origin,destination,date,validate,requiredPlaceId='',kind='lunch',cuisineTags=[]}) {
    const window=kind === 'dinner' ? [17*60,21*60] : kind === 'lunch' ? [11*60,15*60] : [route.start,route.end];
    const duration=kind === 'cafe' ? 40 : 60;
    const restaurants=places.filter((p) => hasCoord(p) && p.category === (kind === 'cafe' ? 'cafe' : 'food') && !EXCLUDED_IDS.has(p.id) &&
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
    candidates.sort((a,b)=>themedCount(b.route)-themedCount(a.route) || b.route.rows.length-a.route.rows.length || a.route.walkMeters-b.route.walkMeters);
    async function finish(route,context) {
      let checked=await confirmRoute(route,context,cache);
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
    for(const {route,context} of candidates) {
      const result=await finish(route,context);
      if(result) return [result];
    }
    // 모든 도보 후보가 불가능한 경우에만 실제 버스 연결을 조회한다.
    const context={...input,...plans[0],maxStops:8,variants:1};
    for(const route of await busFallback(context,cache)) {
      const result=await finish(route,context);
      if(result) return [result];
    }
    return [];
  }
  const api={THEMES,THEME_PRESETS,SHOP_IDS,EXCLUDED_IDS,minutes,distanceKm,estimate,themeScore,stay,datedHours,generate,generateAdaptive,reverseRoundTrip,generateThemeDay,mealChoices,recommendMealTimes,restoreFixedMeals,addMeal};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumRouteEngine=api;
})();
