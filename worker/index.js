// 서버 등록 목록은 빌드 때 앱의 장소 데이터로 채운다. 외부 주소는 추가하지 않는다.
const registeredPoints = /* REGISTERED_POINTS */ {};
const inFlight = new Map();
const LIMIT = 200;
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const error = (message,status) => json({error:message},status);
const pairKey = c => ['start_x','start_y','end_x','end_y'].map(k=>c[k]).join('|');
function registered(c,start,end) {
  return registeredPoints[start]?.join('|')===[c.start_x,c.start_y].join('|') &&
    registeredPoints[end]?.join('|')===[c.end_x,c.end_y].join('|');
}
function database(env) { if(!env.DB) throw Error('DB unavailable'); return env.DB; }
async function reserve(env,kind) {
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const row=await database(env).prepare('INSERT INTO api_usage (day_kind,calls) VALUES (?,1) ON CONFLICT(day_kind) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls').bind(day+':'+kind,LIMIT).first();
  return !!row;
}
async function kakao(env,url,maxBytes) {
  const response=await fetch(url,{headers:{Authorization:'KakaoAK '+env.KAKAO_REST_API_KEY},signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw Error('Upstream failed');
  const raw=await response.text();
  if(new TextEncoder().encode(raw).length>maxBytes) throw Error('Response too large');
  return JSON.parse(raw);
}
function summarize(mode,data) {
  if(data.status!=='OK') return {status:data.status || 'NO_RESULTS',routes:[]};
  const source=mode==='walk' ? [data.route || {}] : (data.routes || []).slice(0,3);
  return {status:'OK',routes:source.map(route=>{
    const p=route.properties || {};
    const steps=mode==='transit' ? route.steps || [] : (route.legs || []).flatMap(leg=>leg.steps || []);
    const vehicles=steps.filter(step=>!['WALK','WALKING'].includes(step.properties?.type));
    const vehicleMeters=vehicles.reduce((sum,step)=>sum+(step.properties?.distance || 0),0);
    const vehicleSeconds=vehicles.reduce((sum,step)=>sum+(step.properties?.time || 0),0);
    const walking=steps.filter(step=>['WALK','WALKING'].includes(step.properties?.type));
    const walkingMeters=walking.reduce((sum,step)=>sum+(step.properties?.distance || 0),0);
    const walkingSeconds=walking.reduce((sum,step)=>sum+(step.properties?.time || 0),0);
    const busSeconds=steps.filter(step=>step.properties?.type==='BUS').reduce((sum,step)=>sum+(step.properties?.time || 0),0);
    return {minutes:Math.max(1,Math.round((mode==='transit' ? walkingSeconds+vehicleSeconds : p.totalTime || 0)/60)),meters:p.totalDistance || 0,
      walkMeters:mode==='transit' ? walkingMeters : p.totalDistance || 0,
      walkMinutes:mode==='transit' ? Math.max(0,Math.round(walkingSeconds/60)) : Math.max(1,Math.round((p.totalTime || 0)/60)),
      busRideSeconds:mode==='transit' ? (busSeconds>0 ? busSeconds : null) : 0,
      busRideMinutes:mode==='transit' ? (busSeconds>0 ? Math.round(busSeconds/60) : null) : 0,
      transitTimeBasis:mode==='transit' ? 'walking-and-vehicle-steps-excluding-wait' : undefined,
      transfers:p.transfers || 0,fare:p.fare?.value ?? null,
      points:steps.flatMap(step=>step.path?.points || []).filter(point=>Array.isArray(point)&&point.length===2).slice(0,5000),
      steps:mode==='transit' ? steps.map(step=>({
        type:step.properties?.type || '',
        guidance:step.properties?.guidance || '',
        minutes:Math.round((step.properties?.time || 0)/60),
        meters:step.properties?.distance || 0,
        vehicle:(step.properties?.vehicles || []).map(v=>v.name).filter(Boolean).join(', '),
        stops:(step.properties?.stops || []).map(stop=>stop.name).filter(Boolean),
        points:(step.path?.points || []).filter(point=>Array.isArray(point)&&point.length===2).slice(0,5000),
      })) : [],
      url:mode==='walk' ? p.landingUrl : data.properties?.landingURL};
  })};
}
// 한 번의 조회값은 평균이라고 부르지 않는다. 같은 방향·노선·승하차 구간의 정상 관측만 평균에 넣는다.
function busIdentity(route) {
  if(route.transfers>0 || (route.steps || []).some(step=>!['WALK','WALKING','BUS'].includes(step.type))) return '';
  const buses=(route.steps || []).filter(step=>step.type==='BUS');
  if(buses.length!==1 || !buses[0].vehicle || !Array.isArray(buses[0].stops) || buses[0].stops.length<2) return '';
  return [buses[0].vehicle,buses[0].stops[0],buses[0].stops.at(-1)].join(':');
}
async function compareAndSaveBusRoute(env,coords,route) {
  const identity=busIdentity(route);
  const seconds=route.busRideSeconds;
  if(!identity || !Number.isFinite(seconds) || seconds<=0) return route;
  const key='bus:'+pairKey(coords)+':'+identity;
  const db=database(env);
  const previous=await db.prepare('SELECT average_ride_seconds, sample_count FROM bus_routes WHERE route_key = ?').bind(key).first();
  if(!previous) {
    await db.prepare('INSERT OR IGNORE INTO bus_routes (route_key,response,average_ride_seconds,sample_count) VALUES (?,?,?,1)').bind(key,JSON.stringify(route),seconds).run();
    return {...route,busCacheStatus:'new',baselineBusRideSeconds:seconds,baselineSampleCount:1};
  }
  const baseline=Number(previous.average_ride_seconds);
  const count=Number(previous.sample_count);
  if(!Number.isFinite(baseline) || baseline<=0 || !Number.isFinite(count) || count<1) return route;
  const difference=seconds-baseline;
  const significant=Math.abs(difference)>=300 && Math.abs(difference)>=baseline*.2;
  if(significant && difference>0) {
    await db.prepare('UPDATE bus_routes SET checked_at = CURRENT_TIMESTAMP WHERE route_key = ?').bind(key).run();
    return {...route,busCacheStatus:'longer',baselineBusRideSeconds:baseline,baselineSampleCount:count,
      currentBusRideSeconds:seconds,rideDifferenceSeconds:difference};
  }
  if(significant && difference<0) {
    await db.prepare('UPDATE bus_routes SET response = ?, average_ride_seconds = ?, sample_count = 1, checked_at = CURRENT_TIMESTAMP WHERE route_key = ?')
      .bind(JSON.stringify(route),seconds,key).run();
    return {...route,busCacheStatus:'shorter-reset',baselineBusRideSeconds:seconds,baselineSampleCount:1};
  }
  const nextCount=Math.min(20,count+1);
  const average=Math.round((baseline*Math.min(count,19)+seconds)/nextCount);
  await db.prepare('UPDATE bus_routes SET response = ?, average_ride_seconds = ?, sample_count = ?, checked_at = CURRENT_TIMESTAMP WHERE route_key = ?')
    .bind(JSON.stringify(route),average,nextCount,key).run();
  return {...route,minutes:Math.max(1,route.walkMinutes+Math.round(average/60)),busRideSeconds:average,
    busRideMinutes:Math.round(average/60),steps:route.steps.map(step=>step.type==='BUS' ? {...step,minutes:Math.round(average/60)} : step),
    busCacheStatus:'reused',baselineBusRideSeconds:average,
    baselineSampleCount:nextCount,currentBusRideSeconds:seconds};
}
async function cachedBusFallback(env,coords) {
  const prefix='bus:'+pairKey(coords)+':';
  const saved=await database(env).prepare('SELECT response, average_ride_seconds, sample_count FROM bus_routes WHERE route_key LIKE ? ORDER BY checked_at DESC LIMIT 1').bind(prefix+'%').first();
  if(!saved) return null;
  const route=JSON.parse(saved.response);
  const seconds=Number(saved.average_ride_seconds);
  if(!Number.isFinite(seconds) || seconds<=0) return null;
  const observed=Number(route.busRideSeconds) || 0;
  return {status:'OK',routes:[{...route,minutes:Math.max(1,route.minutes-Math.round(observed/60)+Math.round(seconds/60)),
    busRideSeconds:seconds,busRideMinutes:Math.round(seconds/60),
    steps:(route.steps || []).map(step=>step.type==='BUS' ? {...step,minutes:Math.round(seconds/60)} : step),
    busCacheStatus:'fallback',currentUnavailable:true,baselineBusRideSeconds:seconds,
    baselineSampleCount:Number(saved.sample_count) || 1}]};
}
async function search(url,env) {
  const query=(url.searchParams.get('q') || '').trim();
  if(query.length<2||query.length>100) return error('주소나 장소명을 2~100자로 입력해 주세요.',400);
  if(!env.KAKAO_REST_API_KEY) return error('주소 검색 연결을 준비 중입니다.',503);
  const results=[];
  for(const kind of ['address','keyword']) {
    if(!await reserve(env,'place-search')) return error('오늘의 주소 검색 안전 한도에 도달했습니다.',429);
    const data=await kakao(env,'https://dapi.kakao.com/v2/local/search/'+kind+'.json?'+new URLSearchParams({query,size:'10'}),1000000);
    for(const item of data.documents || []) {
      const lat=Number(item.y),lon=Number(item.x);
      if(lat>=33&&lat<=39&&lon>=124&&lon<=132) results.push({name:item.place_name || item.address_name || query,address:item.road_address_name || item.address_name || '',lat,lon});
    }
  }
  const unique=new Map();
  for(const p of results) {const key=p.lat.toFixed(6)+':'+p.lon.toFixed(6); if(!unique.has(key)) unique.set(key,p);}
  return json({results:[...unique.values()].slice(0,10)});
}
async function route(url,env) {
  const mode=url.searchParams.get('mode');
  if(!['walk','transit'].includes(mode)) return error('이동 수단이 올바르지 않습니다.',400);
  const coords={};
  for(const [name,min,max] of [['start_x',124,132],['start_y',33,39],['end_x',124,132],['end_y',33,39]]) {
    const number=Number(url.searchParams.get(name));
    if(!Number.isFinite(number)||number<min||number>max) return error('국내 출발지·도착지 좌표가 필요합니다.',400);
    coords[name]=number.toFixed(7);
  }
  const registeredPair=registered(coords,url.searchParams.get('start_id'),url.searchParams.get('end_id'));
  const persistent=mode==='walk' && registeredPair;
  const key=pairKey(coords);
  const calculate=async()=>{
    if(persistent) {
      const saved=await database(env).prepare('SELECT response FROM walk_routes WHERE route_key = ?').bind(key).first();
      if(saved) return {status:200,body:JSON.parse(saved.response)};
    }
    const fallback=mode==='transit' && registeredPair ? await cachedBusFallback(env,coords) : null;
    if(!env.KAKAO_REST_API_KEY) return fallback ? {status:200,body:fallback} : {status:503,body:{error:'경로 검색 연결을 준비 중입니다.'}};
    if(!await reserve(env,mode)) return fallback ? {status:200,body:fallback} : {status:429,body:{error:'오늘의 경로 조회 안전 한도에 도달했습니다.'}};
    let data;
    try {data=await kakao(env,'https://dapi.kakao.com/v2/routing/'+(mode==='walk'?'walk':'publictraffic')+'?'+new URLSearchParams(coords),4000000);}
    catch(error) {if(fallback) return {status:200,body:fallback}; throw error;}
    const result=summarize(mode,data);
    if(persistent && result.status==='OK' && result.routes.length) await database(env).prepare('INSERT OR IGNORE INTO walk_routes (route_key,response) VALUES (?,?)').bind(key,JSON.stringify(result)).run();
    if(mode==='transit' && registeredPair && result.status==='OK')
      result.routes=await Promise.all(result.routes.map(item=>compareAndSaveBusRoute(env,coords,item)));
    return {status:200,body:result};
  };
  // 등록 구간만 요청 중 합친다. 서로 다른 Worker에서도 DB 기본키가 중복 저장을 방지한다.
  if(!persistent) {const result=await calculate();return json(result.body,result.status);}
  if(!inFlight.has(key)) inFlight.set(key,calculate().finally(()=>inFlight.delete(key)));
  const result=await inFlight.get(key);
  return json(result.body,result.status);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) {
      if(request.method!=='GET') return error('지원하지 않는 요청입니다.',405);
      try {
        if(url.pathname==='/api/place-search') return await search(url,env);
        if(url.pathname==='/api/route') return await route(url,env);
        return error('찾을 수 없는 API입니다.',404);
      } catch { return error('검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',502); }
    }
    return env.ASSETS.fetch(request);
  }
};
