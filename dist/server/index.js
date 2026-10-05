// 서버 등록 목록은 빌드 때 앱의 장소 데이터로 채운다. 외부 주소는 추가하지 않는다.
const registeredPoints = {"p2":["126.3820996","34.7879739"],"p3":["126.3699919","34.7994941"],"p4":["126.3749897","34.7878522"],"p5":["126.3607355","34.7744460"],"p6":["126.3592348","34.7779243"],"p7":["126.4255319","34.7919401"],"p8":["126.3820943","34.7875870"],"p9":["126.3814912","34.7859637"],"p10":["126.3768046","34.7826234"],"p12":["126.3773208","34.7817485"],"p14":["126.4330925","34.7960696"],"p16":["126.4210673","34.7937272"],"p17":["126.3798370","34.7869710"],"p18":["126.3737241","34.7943713"],"p19":["126.3673280","34.7877402"],"p20":["126.4222754","34.7939620"],"p21":["126.4195010","34.7936385"],"p22":["126.3861924","34.7888585"],"p24":["126.3882001","34.7808113"],"p25":["126.4212311","34.7924637"],"p29":["126.3811666","34.7879608"],"p30":["126.3922302","34.7828489"],"p31":["126.3849351","34.7851748"],"p32":["126.3888338","34.7820060"],"p33":["126.4169703","34.7928511"],"p34":["126.3663913","34.7669418"],"p35":["126.4189759","34.7922313"],"p41":["126.3822322","34.7901537"],"p42":["126.4196429","34.7929462"],"p43":["126.4159330","34.7927462"],"p46":["126.3840577","34.7861717"],"p47":["126.3834355","34.7868061"],"p48":["126.3834000","34.7848750"],"p49":["126.4366888","34.8039251"],"p50":["126.4306439","34.8054514"],"p51":["126.3865090","34.7856321"],"p52":["126.3660911","34.8047995"],"p53":["126.3880262","34.7812872"],"p54":["126.3856697","34.7941123"],"p55":["126.4300707","34.7946403"],"p56":["126.4301471","34.7953938"],"p57":["126.3851487","34.7901961"],"p58":["126.4315684","34.8046204"],"p59":["126.3749201","34.8067147"],"p60":["126.3699130","34.8028999"],"p61":["126.3843625","34.7923417"],"p62":["126.4296963","34.7944851"],"p63":["126.3840639","34.7866417"],"p64":["126.3831243","34.7858388"],"p65":["126.3824181","34.7847044"],"p66":["126.4260250","34.7980583"],"p67":["126.3726474","34.8082039"],"p68":["126.3765937","34.7807647"],"p69":["126.3903124","34.7900832"],"p70":["126.4251624","34.8084163"],"p71":["126.3919577","34.7949669"],"p72":["126.4023374","34.7922305"],"p73":["126.3760005","34.8037745"],"p74":["126.4312028","34.7978383"],"p75":["126.3765910","34.8090562"],"p76":["126.3967126","34.8025250"],"p77":["126.4197460","34.8019249"],"p78":["126.3951433","34.8047215"],"p79":["126.4157316","34.8128100"],"p80":["126.3979783","34.8062876"],"p81":["126.3827257","34.7836096"],"p82":["126.4035240","34.8054457"],"p83":["126.3835452","34.7900432"],"p84":["126.3833160","34.7925799"],"p85":["126.3854051","34.7933398"],"p86":["126.3780729","34.8102820"],"p87":["126.3966175","34.7885604"],"p88":["126.3678406","34.8038106"],"p89":["126.3916822","34.7949725"],"p90":["126.3959278","34.7991981"],"p92":["126.4373918","34.8062295"],"p93":["126.3866014","34.7884179"],"p94":["126.3822672","34.7840345"],"p95":["126.3815469","34.7862431"],"p96":["126.3811140","34.7870468"],"p97":["126.3732844","34.7805019"],"p98":["126.3852150","34.7867043"],"p99":["126.3658809","34.8019423"],"p100":["126.4291939","34.7942531"],"p101":["126.4306203","34.7956475"],"p102":["126.3852995","34.7912584"],"p103":["126.3847631","34.7923312"],"p104":["126.4188615","34.8158355"],"p105":["126.3836114","34.7898546"],"p106":["126.4217644","34.7980329"],"p107":["126.4429028","34.8128789"],"p108":["126.3857510","34.7873190"],"p109":["126.3889714","34.8090610"],"p110":["126.4432472","34.8119045"],"p111":["126.4006758","34.8097104"],"p112":["126.3660101","34.8050196"],"p113":["126.3845655","34.7901725"],"p115":["126.3845095","34.7903825"],"p116":["126.3844209","34.7899850"],"p117":["126.3822041","34.7898580"],"p118":["126.3856463","34.7911734"],"p119":["126.3803534","34.7866691"],"p120":["126.3823640","34.7858834"],"p121":["126.4245930","34.8153814"],"p122":["126.3930277","34.8043935"],"p123":["126.3834759","34.8003411"],"p124":["126.4293109","34.8087124"],"p125":["126.3842670","34.7883253"],"p126":["126.3802057","34.7859537"],"p127":["126.3872482","34.7868346"],"p128":["126.3861582","34.7897235"],"p129":["126.3961262","34.8098740"],"p130":["126.3841820","34.7915770"],"station":["126.3859000","34.7914000"]};
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
    const busSeconds=steps.filter(step=>step.properties?.type==='BUS').reduce((sum,step)=>sum+(step.properties?.time || 0),0);
    return {minutes:Math.max(1,Math.round((p.totalTime || 0)/60)),meters:p.totalDistance || 0,
      walkMeters:mode==='transit' ? Math.max(0,(p.totalDistance || 0)-vehicleMeters) : p.totalDistance || 0,
      walkMinutes:mode==='transit' ? Math.max(0,Math.round(((p.totalTime || 0)-vehicleSeconds)/60)) : Math.max(1,Math.round((p.totalTime || 0)/60)),
      busRideSeconds:mode==='transit' ? (busSeconds>0 ? busSeconds : null) : 0,
      busRideMinutes:mode==='transit' ? (busSeconds>0 ? Math.round(busSeconds/60) : null) : 0,
      transfers:p.transfers || 0,fare:p.fare?.value ?? null,
      points:steps.flatMap(step=>step.path?.points || []).filter(point=>Array.isArray(point)&&point.length===2).slice(0,5000),
      steps:mode==='transit' ? steps.map(step=>({type:step.properties?.type || '',guidance:step.properties?.guidance || '',minutes:Math.round((step.properties?.time || 0)/60),meters:step.properties?.distance || 0,vehicle:(step.properties?.vehicles || []).map(v=>v.name).filter(Boolean).join(', ')})) : [],
      url:mode==='walk' ? p.landingUrl : data.properties?.landingURL};
  })};
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
  const persistent=mode==='walk' && registered(coords,url.searchParams.get('start_id'),url.searchParams.get('end_id'));
  const key=pairKey(coords);
  const calculate=async()=>{
    if(persistent) {
      const saved=await database(env).prepare('SELECT response FROM walk_routes WHERE route_key = ?').bind(key).first();
      if(saved) return {status:200,body:JSON.parse(saved.response)};
    }
    if(!env.KAKAO_REST_API_KEY) return {status:503,body:{error:'경로 검색 연결을 준비 중입니다.'}};
    if(!await reserve(env,mode)) return {status:429,body:{error:'오늘의 경로 조회 안전 한도에 도달했습니다.'}};
    const data=await kakao(env,'https://dapi.kakao.com/v2/routing/'+(mode==='walk'?'walk':'publictraffic')+'?'+new URLSearchParams(coords),4000000);
    const result=summarize(mode,data);
    if(persistent && result.status==='OK' && result.routes.length) await database(env).prepare('INSERT OR IGNORE INTO walk_routes (route_key,response) VALUES (?,?)').bind(key,JSON.stringify(result)).run();
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
