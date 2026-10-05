import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const {default:worker}=await import('../dist/server/index.js');
const db=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql'))) db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const env={
  KAKAO_REST_API_KEY:'test-key',
  ASSETS:{fetch:async()=>new Response('static-ok')},
  DB:{prepare(sql){
    return {bind(...args){
      return {
        async first(){return db.prepare(sql).get(...args) || null;},
        async run(){return db.prepare(sql).run(...args);}
      };
    }};
  }}
};
const points=JSON.parse(fs.readFileSync('public/places.json','utf8')).places;
const station={id:'station',lat:34.7914,lon:126.3859}, destination=points.find(p=>p.id==='p8');
const parameters={mode:'walk',start_id:station.id,end_id:destination.id,start_x:station.lon,start_y:station.lat,end_x:destination.lon,end_y:destination.lat};
const api=p=>worker.fetch(new Request('https://test.invalid/api/route?'+new URLSearchParams(p)),env);
const count=()=>db.prepare('SELECT COUNT(*) n FROM walk_routes').get().n;
const busCount=()=>db.prepare('SELECT COUNT(*) n FROM bus_routes').get().n;
const upstream=globalThis.fetch;
let calls=0;
let busSeconds=1500, failBus=false, mixedTransit=false;
globalThis.fetch=async url=>{
  calls++;
  if(url.includes('/local/search/')) return Response.json({documents:[{x:'126.3853',y:'34.7911',address_name:'시험 주소'}]});
  if(url.includes('/publictraffic')) {
    if(failBus) throw Error('upstream unavailable');
    return Response.json({status:'OK',routes:[{properties:{totalTime:busSeconds+1080,totalDistance:7228,transfers:mixedTransit?1:0},steps:[
      {properties:{type:'WALKING',distance:443,time:480,guidance:'정류장까지 걷기'}},
      {properties:{type:'BUS',guidance:'22-1 버스',distance:6785,time:busSeconds,vehicles:[{name:'22-1'}],stops:[{name:'승차 정류장'},{name:'하차 정류장'}]}},
      ...(mixedTransit ? [{properties:{type:'SUBWAY',time:600,distance:1000}}] : []),
    ]}]});
  }
  return Response.json({status:'OK',route:{properties:{totalTime:600,totalDistance:600},legs:[{steps:[{path:{points:[[126.3859,34.7914],[destination.lon,destination.lat]]}}]}]}});
};
try {
  const responses=await Promise.all([api(parameters),api(parameters),api(parameters)]);
  assert(responses.every(r=>r.status===200));assert.equal(calls,1);assert.equal(count(),1);
  const data=await (await api(parameters)).json();assert.equal(data.routes[0].minutes,10);assert.equal(calls,1);
  await api({...parameters,start_id:''});await api({...parameters,end_id:'custom'});assert.equal(calls,3);assert.equal(count(),1);
  await api({...parameters,start_x:126.3861234});assert.equal(calls,4);assert.equal(count(),1);
  assert.equal((await api({...parameters,start_y:'NaN'})).status,400);
  const search=await worker.fetch(new Request('https://test.invalid/api/place-search?q='+encodeURIComponent('시험 주소')),env);
  assert.equal(search.status,200);assert.equal((await search.json()).results.length,1);assert.equal(count(),1);
  assert.equal(await (await worker.fetch(new Request('https://test.invalid/'),env)).text(),'static-ok');
  db.prepare("UPDATE api_usage SET calls=200 WHERE day_kind LIKE '%:walk'").run();
  assert.equal((await api({...parameters,start_id:'custom'})).status,429);
  assert.equal((await api(parameters)).status,200,'한도 뒤에도 등록 캐시 재사용');
  const transit=await (await api({...parameters,mode:'transit'})).json();
  assert.equal(transit.routes[0].walkMeters,443);
  assert.equal(transit.routes[0].walkMinutes,8);
  assert.equal(transit.routes[0].busRideMinutes,25);
  assert.equal(transit.routes[0].busRideSeconds,1500);
  assert.equal(transit.routes[0].minutes,33,'정류장 도보와 탑승만 포함');
  assert.equal(transit.routes[0].steps[1].meters,6785);
  assert.equal(transit.routes[0].steps[1].type,'BUS');
  assert.equal(transit.routes[0].busCacheStatus,'new');
  assert.equal(busCount(),1);
  busSeconds=1680;
  let next=(await (await api({...parameters,mode:'transit'})).json()).routes[0];
  assert.equal(next.busCacheStatus,'reused');
  assert.equal(next.busRideSeconds,1590,'작은 변동은 관측 평균을 재사용');
  busSeconds=2100;
  next=(await (await api({...parameters,mode:'transit'})).json()).routes[0];
  assert.equal(next.busCacheStatus,'longer');
  assert.equal(next.busRideSeconds,2100,'5분과 20% 모두 넘는 증가만 현재 조회값 사용');
  assert.equal(next.rideDifferenceSeconds,510);
  assert.equal(db.prepare('SELECT average_ride_seconds n FROM bus_routes').get().n,1590,'긴 조회값은 기준 평균을 오염시키지 않음');
  failBus=true;
  next=(await (await api({...parameters,mode:'transit'})).json()).routes[0];
  assert.equal(next.currentUnavailable,true);
  assert.equal(next.busRideSeconds,1590,'API 실패 시 저장값 사용');
  failBus=false;
  await api({...parameters,mode:'transit',start_id:'custom'});
  assert.equal(busCount(),1,'미등록 구간은 버스 저장 제외');
  mixedTransit=true;
  next=(await (await api({...parameters,mode:'transit'})).json()).routes[0];
  assert.equal(next.busCacheStatus,undefined,'복합·환승은 단일 버스 평균 저장에서 제외');
  assert.equal(next.minutes,53,'철도 탑승시간을 버스 평균으로 덮어쓰지 않음');
  assert.equal(busCount(),1);
  assert.equal(count(),1);
  console.log('PASS: hosted API, walk cache, bus average/traffic/fallback, registered-only persistence, quota, assets.');
} finally {globalThis.fetch=upstream;db.close();}
