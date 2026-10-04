// 추천 결과의 순서 조정과 시간 때문에 필요한 우회를 분리해 확인한다.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/route-engine.js'),'utf8');
const sandbox={module:{exports:{}},console};
vm.runInNewContext(source.replace('const api={','const api={improveRoute,routeDetourPenalty,scheduleVisits,'),sandbox);
const engine=sandbox.module.exports;
const origin={id:'origin',name:'출발',lat:34.79,lon:126.38};
const place=(id,n)=>({id,name:id,lat:origin.lat+n*.001,lon:origin.lon,category:'culture'});
const a=place('a',1),b=place('b',4),c=place('c',1.2),d=place('d',5);
const walk=(from,to)=>({meters:Math.max(30,Math.ceil(engine.distanceKm(from,to)*1400)),minutes:Math.max(1,Math.ceil(engine.distanceKm(from,to)*25)),actual:true});
const input=(places,validate)=>({places,origin,destination:origin,start:'10:00',end:'17:00',date:'2026-10-05',theme:'balanced',validate,routeProvider:async(from,to)=>walk(from,to)});
const initial=(order,context)=>engine.scheduleVisits(order,context,[origin,...order].map((p,i)=>walk(p,order[i] || origin)));
(async()=>{
  const normal=input([a,b,c,d],()=>({kind:'ok'}));
  const wasteful=initial([a,b,c,d],normal);
  assert(wasteful);
  const improved=await engine.improveRoute(wasteful,normal,new Map());
  assert.deepEqual([...improved.rows.map(row=>row.placeId)].sort(),['a','b','c','d']);
  assert(improved.rows.findIndex(row=>row.placeId==='c')<improved.rows.findIndex(row=>row.placeId==='b'),'가까운 c를 지나쳐 b에 갔다가 돌아옴');
  assert(improved.walkMeters<wasteful.walkMeters,'되돌아감 제거 후 실제 도보 거리 감소');
  assert(improved.rows.every(row=>row.actual)&&improved.endWalk.actual);
  assert(improved.endArrival<=engine.minutes(normal.end));
  const rechecked=await engine.verifyEditedRoute({...improved,rows:improved.rows.map((row,i)=>i?row:{...row,actual:false})},normal);
  assert(rechecked && rechecked.rows.every(row=>row.actual)&&rechecked.endWalk.actual,'수정 코스의 모든 이동을 다시 확인');
  assert.equal(await engine.verifyEditedRoute(improved,{...normal,routeProvider:async()=>{throw Error('offline');}}),null,
    '실제 이동을 확인하지 못한 수정 코스를 확정함');
  assert(engine.routeDetourPenalty([a,place('near',1.04),place('near2',1.07)],origin)===0,'같은 블록 안의 출입을 우회로 오판');
  const timed=input([a,b,c],(p,minute,duration)=>({kind:p.id==='b' && minute+duration>740 || p.id==='c' && minute<750 ? 'bad':'ok'}));
  const necessary=initial([a,b,c],timed);
  assert(necessary,'운영시간상 가능한 우회 준비');
  const checked=await engine.improveRoute(necessary,timed,new Map());
  assert.equal(checked.signature,necessary.signature,'운영시간 때문에 필요한 순서 보존');
  console.log(JSON.stringify({passed:true,originalMeters:wasteful.walkMeters,improvedMeters:improved.walkMeters,order:improved.rows.map(row=>row.placeId),timedOrder:checked.rows.map(row=>row.placeId)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
