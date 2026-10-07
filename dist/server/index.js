// 서버 등록 목록은 빌드 때 앱의 장소 데이터로 채운다. 외부 주소는 추가하지 않는다.
const registeredPoints = {"p2":["126.3820996","34.7879739"],"p3":["126.3699919","34.7994941"],"p4":["126.3749897","34.7878522"],"p5":["126.3607355","34.7744460"],"p6":["126.3592348","34.7779243"],"p7":["126.4255319","34.7919401"],"p8":["126.3820943","34.7875870"],"p9":["126.3814912","34.7859637"],"p10":["126.3768046","34.7826234"],"p12":["126.3773208","34.7817485"],"p14":["126.4330925","34.7960696"],"p16":["126.4210673","34.7937272"],"p17":["126.3798370","34.7869710"],"p18":["126.3737241","34.7943713"],"p19":["126.3673280","34.7877402"],"p20":["126.4222754","34.7939620"],"p21":["126.4195010","34.7936385"],"p22":["126.3861924","34.7888585"],"p24":["126.3882001","34.7808113"],"p25":["126.4212311","34.7924637"],"p29":["126.3811666","34.7879608"],"p30":["126.3922302","34.7828489"],"p31":["126.3849351","34.7851748"],"p32":["126.3888338","34.7820060"],"p33":["126.4169703","34.7928511"],"p34":["126.3663913","34.7669418"],"p35":["126.4189759","34.7922313"],"p41":["126.3822322","34.7901537"],"p42":["126.4196429","34.7929462"],"p43":["126.4159330","34.7927462"],"p46":["126.3840577","34.7861717"],"p47":["126.3834355","34.7868061"],"p48":["126.3834000","34.7848750"],"p49":["126.4366888","34.8039251"],"p50":["126.4306439","34.8054514"],"p51":["126.3865090","34.7856321"],"p52":["126.3660911","34.8047995"],"p53":["126.3880262","34.7812872"],"p54":["126.3856697","34.7941123"],"p55":["126.4300707","34.7946403"],"p56":["126.4301471","34.7953938"],"p57":["126.3851487","34.7901961"],"p58":["126.4315684","34.8046204"],"p59":["126.3749201","34.8067147"],"p60":["126.3699130","34.8028999"],"p61":["126.3843625","34.7923417"],"p62":["126.4296963","34.7944851"],"p63":["126.3840639","34.7866417"],"p64":["126.3831243","34.7858388"],"p65":["126.3824181","34.7847044"],"p66":["126.4260250","34.7980583"],"p67":["126.3726474","34.8082039"],"p68":["126.3765937","34.7807647"],"p69":["126.3903124","34.7900832"],"p70":["126.4251624","34.8084163"],"p71":["126.3919577","34.7949669"],"p72":["126.4023374","34.7922305"],"p73":["126.3760005","34.8037745"],"p74":["126.4312028","34.7978383"],"p75":["126.3765910","34.8090562"],"p76":["126.3967126","34.8025250"],"p77":["126.4197460","34.8019249"],"p78":["126.3951433","34.8047215"],"p79":["126.4157316","34.8128100"],"p80":["126.3979783","34.8062876"],"p81":["126.3827257","34.7836096"],"p82":["126.4035240","34.8054457"],"p83":["126.3835452","34.7900432"],"p84":["126.3833160","34.7925799"],"p85":["126.3854051","34.7933398"],"p86":["126.3780729","34.8102820"],"p87":["126.3966175","34.7885604"],"p88":["126.3678406","34.8038106"],"p89":["126.3916822","34.7949725"],"p90":["126.3959278","34.7991981"],"p92":["126.4373918","34.8062295"],"p93":["126.3866014","34.7884179"],"p94":["126.3822672","34.7840345"],"p95":["126.3815469","34.7862431"],"p96":["126.3811140","34.7870468"],"p97":["126.3732844","34.7805019"],"p98":["126.3852150","34.7867043"],"p99":["126.3658809","34.8019423"],"p100":["126.4291939","34.7942531"],"p101":["126.4306203","34.7956475"],"p102":["126.3852995","34.7912584"],"p103":["126.3847631","34.7923312"],"p104":["126.4188615","34.8158355"],"p105":["126.3836114","34.7898546"],"p106":["126.4217644","34.7980329"],"p107":["126.4429028","34.8128789"],"p108":["126.3857510","34.7873190"],"p109":["126.3889714","34.8090610"],"p110":["126.4432472","34.8119045"],"p111":["126.4006758","34.8097104"],"p112":["126.3660101","34.8050196"],"p113":["126.3845655","34.7901725"],"p115":["126.3845095","34.7903825"],"p116":["126.3844209","34.7899850"],"p117":["126.3822041","34.7898580"],"p118":["126.3856463","34.7911734"],"p119":["126.3803534","34.7866691"],"p120":["126.3823640","34.7858834"],"p121":["126.4245930","34.8153814"],"p122":["126.3930277","34.8043935"],"p123":["126.3834759","34.8003411"],"p124":["126.4293109","34.8087124"],"p125":["126.3842670","34.7883253"],"p126":["126.3802057","34.7859537"],"p127":["126.3872482","34.7868346"],"p128":["126.3861582","34.7897235"],"p129":["126.3961262","34.8098740"],"p130":["126.3841820","34.7915770"],"g1":["128.8986238","37.7540251"],"g3":["128.8974965","37.7559098"],"g4":["128.9451009","37.7742852"],"g5":["128.9192316","37.7941028"],"g6":["128.9078036","37.8051381"],"g7":["128.9014980","37.7522636"],"g8":["128.8949965","37.7546925"],"g9":["128.8798026","37.7791902"],"g10":["128.8847671","37.7854492"],"g11":["128.8966363","37.7950742"],"g14":["128.9371318","37.7801011"],"g17":["128.9478294","37.7720457"],"g21":["128.9074894","37.7878498"],"g22":["128.9097365","37.7917949"],"g23":["128.8943582","37.7549334"],"g24":["128.8924254","37.7510368"],"g25":["128.8904730","37.7497493"],"g26":["128.8979872","37.7542002"],"g27":["128.8919443","37.7525948"],"g28":["128.9120214","37.7881734"],"g29":["128.9153628","37.7900354"],"g30":["128.9171152","37.7922884"],"g31":["128.9096754","37.7919282"],"g32":["128.9095233","37.7909275"],"g33":["128.8958264","37.7559700"],"g34":["128.8938950","37.7530995"],"g35":["128.9166745","37.7977252"],"g36":["128.9273280","37.7854577"],"g37":["128.9513627","37.7681353"],"g38":["128.9548440","37.7643337"],"g40":["128.8970743","37.7531069"],"j1":["129.2190002","35.8347148"],"j2":["129.2269755","35.8347763"],"j3":["129.2099538","35.8374081"],"j4":["129.2133340","35.8381911"],"j5":["129.2181213","35.8292995"],"j6":["129.2146950","35.8296331"],"j7":["129.2279503","35.8292339"],"j8":["129.2336399","35.8405670"],"j9":["129.2309889","35.8385294"],"j10":["129.2137477","35.8466262"],"j11":["129.2163548","35.8453437"],"j12":["129.2067438","35.8439619"],"j13":["129.2775380","35.8446064"],"j14":["129.2616606","35.8495071"],"j15":["129.2820660","35.8362526"],"j16":["129.2883479","35.8308656"],"j17":["129.3318426","35.7899147"],"j18":["129.3505207","35.7952417"],"j19":["129.4772149","35.7480008"],"j20":["129.4868767","35.7382616"],"j21":["129.5055064","35.8067936"],"j22":["129.5113557","35.8072283"],"j23":["129.4913197","35.7860738"],"j24":["129.4066283","35.8023528"],"j25":["129.4028567","35.8380110"],"j26":["129.4742290","35.6860839"],"j27":["129.4756709","35.6914278"],"j28":["129.4638845","35.6721322"],"j29":["129.2530559","36.0016179"],"j30":["129.1632474","36.0116911"],"j31":["129.1599124","36.0165988"],"j32":["129.1207553","35.8340566"],"j33":["129.0773815","35.8329718"],"j34":["129.2128813","35.8071926"],"j35":["129.2094958","35.7967468"],"j36":["129.2107891","35.8216929"],"j37":["129.2091537","35.8367669"],"j38":["129.2100375","35.8355973"],"j39":["129.2063010","35.8398432"],"j40":["129.2136444","35.8408398"],"j41":["129.2099755","35.8466020"],"j42":["129.2147315","35.8334528"],"j43":["129.2517063","35.8426841"],"j44":["129.3126400","35.7973471"],"j45":["129.4899387","35.7879909"],"j46":["129.2250753","35.9900235"],"j47":["129.0867022","35.8638547"],"j48":["129.2815010","35.8456142"],"j49":["129.2634789","35.8525796"],"j50":["129.1039498","35.8499982"],"j51":["129.1070563","35.8506177"],"j52":["129.1934487","36.0011554"],"j53":["129.5021394","35.8049573"],"j54":["129.2718125","35.8450625"],"j55":["129.2103125","35.8331875"],"j56":["129.2575625","35.8449375"],"j57":["129.5124375","35.8296875"],"j58":["129.4999375","35.8138125"],"j59":["129.5015625","35.8056875"],"j60":["129.4646875","35.6691875"],"j61":["129.2260625","35.9906875"],"j62":["129.5002527","35.8047515"],"j63":["129.4627836","35.6813631"],"j64":["129.2037611","36.0049813"],"j65":["129.2144375","35.8584375"],"j66":["129.0748125","35.9213125"],"j67":["129.0910625","35.7689375"],"j68":["129.4836875","35.7441875"],"j69":["129.2388226","35.8399154"],"j70":["129.2079375","36.0189375"],"j71":["129.4989375","35.7926875"],"j72":["129.2169375","35.8311875"],"j73":["129.2085625","35.8224375"],"j74":["129.3331875","35.7885625"],"j75":["129.1570625","36.0190625"],"j76":["129.2890625","35.8286875"],"j77":["129.3340625","35.7850625"],"j78":["129.2891875","35.8448125"],"j79":["129.2895625","35.8346875"],"j80":["129.2619375","35.8469375"],"j81":["129.2119375","35.8404375"],"j82":["129.1829375","35.8616875"],"j83":["129.2153513","35.8415724"],"j84":["129.2097679","35.8389649"],"j85":["129.2098125","35.8366875"],"j86":["129.2193843","35.8358719"],"j87":["129.2108556","35.8202608"],"j88":["129.2087972","35.8331692"],"j89":["129.2097642","35.8367556"],"j90":["129.2158604","35.8450735"],"j91":["129.2158537","35.8448322"],"j92":["129.2135625","35.8663125"],"j93":["129.2096347","35.8376735"],"j94":["129.1881875","35.8294375"],"j95":["129.2103125","35.8375625"],"j96":["129.2084375","35.8365625"],"j97":["129.2131875","35.8474375"],"j98":["129.2108125","35.8374375"],"j99":["129.2106717","35.8364398"],"j100":["129.2151643","35.8426463"],"j101":["129.2217954","35.8593085"],"j102":["129.2118127","35.8470836"],"j103":["129.2095850","35.8342865"],"j104":["129.2112580","35.8361947"],"j105":["129.2097422","35.8388357"],"j106":["129.2094694","35.8360222"],"j107":["129.2138003","35.8343458"],"j108":["129.2129699","35.8420524"],"j109":["129.2127376","35.8352845"],"j110":["129.2117655","35.8407627"],"j111":["129.2083487","35.8356716"],"j112":["129.2066485","35.8538607"],"j113":["129.2192582","35.8699336"],"j114":["129.2099880","35.8331762"],"j115":["129.2087634","35.8364208"],"j116":["129.4865816","35.7469605"],"j117":["129.2109096","35.8344892"],"j118":["129.2853312","35.8370176"],"j119":["129.3267969","35.7868958"],"j120":["129.5044773","35.8041734"],"j121":["129.2339503","35.9184647"],"j122":["129.4636497","35.6741914"],"j123":["129.2879971","35.8447662"],"j124":["129.3282501","35.7851557"],"j125":["129.3284937","35.7848627"],"j126":["129.4866903","35.7460501"],"j127":["129.1401602","35.9802736"],"j128":["129.4690620","35.6795442"],"j129":["129.2106933","35.8356249"],"j130":["129.2304905","35.8412005"],"j131":["129.4846220","35.7452325"],"j132":["129.5083536","35.8188722"],"j133":["129.4949963","35.7740152"],"j134":["129.4922516","35.7518118"],"j135":["129.4599499","35.6767884"],"j136":["129.4722272","35.6838550"],"j137":["129.1672357","35.9946948"],"j138":["129.3491047","35.6894085"],"j139":["129.2091935","35.8380098"],"j140":["129.2088054","35.8376128"],"j141":["129.2621826","35.8520429"],"j142":["129.2093368","35.8378482"],"j143":["129.2097418","35.8356106"],"j144":["129.2057387","35.7908185"],"j145":["129.2112492","35.8355441"],"j146":["129.2249936","35.9901556"],"j147":["129.2123633","35.8350994"],"j148":["129.2098453","35.8288561"],"j149":["129.3031068","35.7733763"],"j150":["129.1826310","35.8441722"],"j151":["129.2753000","35.8695387"],"j152":["129.2083895","35.8390588"],"j153":["129.2117974","35.8414361"],"j154":["129.3094186","35.7936535"],"j155":["129.2525846","35.8330445"],"j156":["129.2350152","35.8446213"],"j157":["129.2038885","35.8843198"],"j158":["129.3011665","35.8530491"],"j159":["129.1757465","35.8454320"],"j160":["129.2538158","35.7967672"],"j161":["129.3115995","35.8017461"],"j162":["129.2087513","35.8394954"],"j163":["129.2031706","35.8536074"],"j164":["129.2201662","35.8369279"],"j165":["129.2381472","35.8436043"],"j166":["129.2094375","35.8360625"],"j167":["129.2229375","35.8436875"],"j168":["129.1971875","35.7529375"],"j169":["129.4897870","35.7812871"],"j170":["129.2220625","35.8428125"],"j171":["129.1699375","35.8484375"],"j172":["129.2160625","35.8649375"],"j173":["129.2109375","35.8356875"],"j174":["129.3277958","35.7850492"],"j175":["129.2935625","35.7540625"],"j176":["129.0569375","35.6959375"],"station":["126.3859000","34.7914000"],"gangneung-station":["128.8997106","37.7641331"],"gyeongju-station":["129.1389994","35.7983773"]};
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
    return {minutes:mode==='transit' && !walking.length ? null : Math.max(1,Math.round((mode==='transit' ? walkingSeconds+vehicleSeconds : p.totalTime || 0)/60)),meters:p.totalDistance || 0,
      walkMeters:mode==='transit' ? (walking.length ? walkingMeters : null) : p.totalDistance || 0,
      walkMinutes:mode==='transit' ? (walking.length ? Math.max(0,Math.round(walkingSeconds/60)) : null) : Math.max(1,Math.round((p.totalTime || 0)/60)),
      busAccessUnknown:mode==='transit' && !walking.length,
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
async function addBusAccess(env,coords,route,requests,canReadSaved) {
  if(!route.busAccessUnknown || !busIdentity(route)) return route;
  const bus=route.steps.find(step=>step.type==='BUS');
  const start=bus.points?.[0],end=bus.points?.at(-1);
  const valid=point=>Array.isArray(point) && point.length===2 && point.every(Number.isFinite);
  if(!valid(start) || !valid(end)) return route;
  const origin=[Number(coords.start_x),Number(coords.start_y)],destination=[Number(coords.end_x),Number(coords.end_y)];
  let saved;
  try {
    const row=canReadSaved ? await database(env).prepare('SELECT response FROM bus_routes WHERE route_key = ?').bind('bus:'+pairKey(coords)+':'+busIdentity(route)).first() : null;
    if(row) saved=JSON.parse(row.response);
  } catch(failure) {console.warn('Bus access cache read failed:',failure?.message);}
  const same=(a,b)=>valid(a) && valid(b) && a.every((value,index)=>value.toFixed(7)===b[index].toFixed(7));
  const foot=async(from,to,previous)=>{
    if(same(from,to)) return {minutes:0,meters:0,points:[from],from,to,verified:true};
    if(previous?.verified && same(previous.from,from) && same(previous.to,to) &&
      previous.points?.length>1 && Number.isFinite(previous.minutes) && Number.isFinite(previous.meters)) return previous;
    const parameters={start_x:from[0].toFixed(7),start_y:from[1].toFixed(7),end_x:to[0].toFixed(7),end_y:to[1].toFixed(7)};
    const key=pairKey(parameters);
    if(!requests.has(key)) requests.set(key,(async()=>{
      try {
        if(!await reserve(env,'walk')) return null;
        const response=summarize('walk',await kakao(env,'https://dapi.kakao.com/v2/routing/walk?'+new URLSearchParams(parameters),4000000));
        const walk=response.status==='OK' ? response.routes[0] : null;
        if(!walk?.points?.length || walk.points.length<2) return null;
        return {...walk,from,to,verified:true};
      } catch {return null;}
    })());
    return requests.get(key);
  };
  const [access,egress]=await Promise.all([foot(origin,start,saved?.accessWalk),foot(end,destination,saved?.egressWalk)]);
  if(!access || !egress) return route;
  const walkMinutes=access.minutes+egress.minutes,walkMeters=access.meters+egress.meters;
  const steps=[{type:'WALKING',guidance:bus.stops[0]+' 정류장까지 걷기',minutes:access.minutes,meters:access.meters,points:access.points},
    bus,{type:'WALKING',guidance:'하차 후 목적지까지 걷기',minutes:egress.minutes,meters:egress.meters,points:egress.points}];
  return {...route,walkMinutes,walkMeters,busAccessUnknown:false,accessWalk:access,egressWalk:egress,
    minutes:walkMinutes+route.busRideMinutes,meters:walkMeters+bus.meters,
    points:steps.flatMap(step=>step.points).slice(0,5000),steps,
    busStops:{boarding:{name:bus.stops[0],lon:start[0],lat:start[1],positionBasis:'bus-step-path'},
      alighting:{name:bus.stops.at(-1),lon:end[0],lat:end[1],positionBasis:'bus-step-path'}}};
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
    await db.prepare('UPDATE bus_routes SET response = ?, checked_at = CURRENT_TIMESTAMP WHERE route_key = ?').bind(JSON.stringify(route),key).run();
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
  return {...route,minutes:route.busAccessUnknown ? null : Math.max(1,route.walkMinutes+Math.round(average/60)),busRideSeconds:average,
    busRideMinutes:Math.round(average/60),steps:route.steps.map(step=>step.type==='BUS' ? {...step,minutes:Math.round(average/60)} : step),
    busCacheStatus:'reused',baselineBusRideSeconds:average,
    baselineSampleCount:nextCount,currentBusRideSeconds:seconds};
}
async function cachedBusFallback(env,coords) {
  const prefix='bus:'+pairKey(coords)+':';
  const saved=await database(env).prepare('SELECT response, average_ride_seconds, sample_count FROM bus_routes WHERE route_key >= ? AND route_key < ? ORDER BY checked_at DESC LIMIT 1').bind(prefix,prefix+'\uffff').first();
  if(!saved) return null;
  const route=JSON.parse(saved.response);
  if(!(route.steps || []).some(step=>['WALK','WALKING'].includes(step.type))) {
    route.walkMinutes=null;route.walkMeters=null;route.busAccessUnknown=true;
  }
  const seconds=Number(saved.average_ride_seconds);
  if(!Number.isFinite(seconds) || seconds<=0) return null;
  const observed=Number(route.busRideSeconds) || 0;
  return {status:'OK',routes:[{...route,minutes:route.busAccessUnknown ? null : Math.max(1,route.walkMinutes+Math.round(seconds/60)),
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
    let fallback=null;
    if(mode==='transit' && registeredPair) {
      try {fallback=await cachedBusFallback(env,coords);}
      catch(failure) {console.warn('Bus fallback cache read failed:',failure?.message);}
    }
    if(!env.KAKAO_REST_API_KEY) return fallback ? {status:200,body:fallback} : {status:503,body:{error:'경로 검색 연결을 준비 중입니다.'}};
    if(!await reserve(env,mode)) return fallback ? {status:200,body:fallback} : {status:429,body:{error:'오늘의 경로 조회 안전 한도에 도달했습니다.'}};
    let data;
    try {data=await kakao(env,'https://dapi.kakao.com/v2/routing/'+(mode==='walk'?'walk':'publictraffic')+'?'+new URLSearchParams(coords),4000000);}
    catch(error) {if(fallback) return {status:200,body:fallback}; throw error;}
    const result=summarize(mode,data);
    if(persistent && result.status==='OK' && result.routes.length) await database(env).prepare('INSERT OR IGNORE INTO walk_routes (route_key,response) VALUES (?,?)').bind(key,JSON.stringify(result)).run();
    if(mode==='transit' && result.status==='OK') {
      const requests=new Map();
      result.routes=await Promise.all(result.routes.map(async item=>{
        const enriched=await addBusAccess(env,coords,item,requests,registeredPair);
        return registeredPair ? compareAndSaveBusRoute(env,coords,enriched) : enriched;
      }));
    }
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
      } catch(failure) {console.error('Route API failure:',failure?.message); return error('검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',502); }
    }
    return env.ASSETS.fetch(request);
  }
};
