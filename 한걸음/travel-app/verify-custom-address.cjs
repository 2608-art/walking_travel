const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('./dist/route-engine.js');
const source=fs.readFileSync('./dist/app.js','utf8');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const getPlace=id=>places.find(p=>p.id===id);
const evaluate=vm.runInNewContext(source.slice(source.indexOf('  function evaluate('),source.indexOf('  function pillFor('))+'\nevaluate;',{
  routeEngine:engine,entryPlace:e=>getPlace(e.placeId),toMin:engine.minutes,
  dateAt:(base,m)=>{const d=new Date(base+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(m/1440));return d.toISOString().slice(0,10);},
  weekday:d=>new Date(d+'T12:00:00Z').getUTCDay()
});
const customStart={id:'custom',name:'시험용 외부 주소 A',lat:34.7909,lon:126.3863};
const customEnd={id:'custom',name:'시험용 외부 주소 B',lat:34.7856,lon:126.3814};
(async()=>{
  const queries=[], cache=new Map();
  let now=1000;
  const client=vm.runInNewContext(source.slice(source.indexOf('  function registeredRouteId('),source.indexOf('  let toastTimer;'))+'\n({getRoute});',{
    STATION:station,getPlace,coord:p=>p && Number.isFinite(p.lat) && Number.isFinite(p.lon),routeCache:cache,
    URLSearchParams,Date:{now:()=>now},fetch:async url=>{queries.push(new URL(url,'http://localhost'));return {ok:true,json:async()=>({status:'OK',routes:[{meters:500,minutes:10}]})};}
  });
  await Promise.all([client.getRoute('walk',station,getPlace('p8')),client.getRoute('walk',station,getPlace('p8'))]);
  assert.equal(queries.length,1);
  assert.equal(queries[0].searchParams.get('start_id'),'station');
  await client.getRoute('walk',customStart,getPlace('p8'));
  assert.equal(queries[1].searchParams.get('start_id'),'');
  await client.getRoute('walk',customStart,getPlace('p8'));
  assert.equal(queries.length,2,'같은 조작의 중복 요청 방지');
  now+=60001;
  await client.getRoute('walk',customStart,getPlace('p8'));
  assert.equal(queries.length,3,'임시 주소 캐시 만료');
  await client.getRoute('walk',{...customStart,id:'station'},customEnd);
  assert.equal(queries.at(-1).searchParams.get('start_id'),'','잘못된 등록 ID는 보내지 않음');
  const results=[];
  for (const [origin,destination] of [[customStart,station],[station,customEnd],[customStart,customEnd]]) {
    const legs=[];
    const routes=await engine.generateAdaptive({places,origin,destination,start:'10:00',end:'18:00',date:'2026-10-04',routeFocus:'through',
      validate:(p,m,d,date)=>evaluate({placeId:p.id,duration:d},m,date),
      routeProvider:async(a,b)=>{legs.push([a,b]);return engine.estimate(a,b);}});
    assert(routes.length,'외부 좌표에서도 코스 생성');
    for(const route of routes) { assert(route.endArrival<=1080); assert(route.walkMeters<=8000); assert.equal(route.originName,origin.name); assert.equal(route.destinationName,destination.name); }
    assert(legs.some(([a])=>a===origin)); assert(legs.some(([,b])=>b===destination));
    results.push({origin:origin.name,destination:destination.name,routes:routes.length});
  }
  const state={route:{origin:'custom',destination:'custom',customOrigin:{...customStart,id:undefined},customDestination:{...customEnd,id:undefined}}};
  const endpoints=vm.runInNewContext(source.slice(source.indexOf('  function routeOrigin('),source.indexOf('  function setupRoutePlaceSearch('))+'\n({origin:routeOrigin(),destination:routeDestination()});',{state,getPlace,STATION:station});
  assert.equal(endpoints.origin.id,'custom'); assert.equal(endpoints.destination.id,'custom');
  assert.equal(endpoints.origin.lat,customStart.lat); assert.equal(endpoints.destination.lon,customEnd.lon);
  console.log(JSON.stringify({customAddressRoutes:results,requestCache:'등록 ID 검증·중복·임시 만료 통과',endpointIdentity:'계획표용 custom ID 유지'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
