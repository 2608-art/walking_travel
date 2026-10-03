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
const upstream=globalThis.fetch;
let calls=0;
globalThis.fetch=async url=>{
  calls++;
  if(url.includes('/local/search/')) return Response.json({documents:[{x:'126.3853',y:'34.7911',address_name:'시험 주소'}]});
  if(url.includes('/publictraffic')) return Response.json({status:'OK',routes:[{properties:{totalTime:1974,totalDistance:7228},steps:[{properties:{type:'BUS',guidance:'22-1 버스',distance:6785,time:1486,vehicles:[{name:'22-1'}]}}]}]});
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
  assert.equal(transit.routes[0].steps[0].meters,6785);
  assert.equal(transit.routes[0].steps[0].type,'BUS');
  assert.equal(count(),1,'버스 경로는 영구 저장 제외');
  console.log('PASS: hosted API, registered-only D1 cache, deduplication, custom addresses, quota, assets, bus access walking.');
} finally {globalThis.fetch=upstream;db.close();}
