const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('./dist/route-engine.js');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const validate=(p,minute,duration,date) => {
  const daily=engine.datedHours(p,date);
  if (daily?.closed) return {kind:'bad',title:'휴무'};
  const h=daily?.open ? {...p.hours,...daily,breaks:daily.breaks?.length ? daily.breaks : p.hours?.breaks} : p.hours;
  if (!h) return {kind:'unknown',title:'시간 미확인'};
  const m=minute%1440, open=engine.minutes(h.open),close=engine.minutes(h.close);
  if (h.closedDates?.includes(date) || (!daily?.open && h.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))) return {kind:'bad',title:'휴무'};
  if (m<open || m+duration>close || h.breaks?.some(([a,b]) => m<engine.minutes(b) && m+duration>engine.minutes(a))) return {kind:'bad',title:'운영시간 외'};
  return {kind:'ok',title:'가능'};
};
let quotaHit=false;
const provider=async (a,b) => {
  const params=new URLSearchParams({mode:'walk',start_x:a.lon,start_y:a.lat,end_x:b.lon,end_y:b.lat});
  const response=await fetch('http://127.0.0.1:8765/api/route?'+params);
  if (response.status===429) quotaHit=true;
  if (!response.ok) throw Error('API '+response.status);
  const data=await response.json();
  if (data.status!=='OK' || !data.routes?.[0]) throw Error(data.status);
  return {meters:data.routes[0].meters,minutes:data.routes[0].minutes};
};
(async () => {
  const scenario=process.argv[2] || 'default';
  const coast=scenario==='coast', late=scenario==='late', shops=scenario==='shops';
  const origin=coast ? places.find((p) => p.id==='p7') : station;
  const destination=coast ? places.find((p) => p.id==='p14') : station;
  const mealTimes=coast ? ['13:00','18:00'] : late ? ['15:30'] : ['12:30','18:30'];
  const routes=await engine.generate({places,origin,destination,start:late?'13:00':'10:00',end:coast?'21:00':late?'22:00':'24:00',date:'2026-10-03',theme:coast?'sea':shops?'shops':'balanced',mealTimes,routeProvider:provider,validate,variants:1});
  if (quotaHit) throw Error('카카오 도보 API의 일일 조회 한도(429): 실제 거리 검증은 한도 초기화 후 다시 실행');
  assert(routes.length===1,'실제 도보 경로로 생성된 일정 없음');
  const route=routes[0];
  assert(route.rows.length>=5,'하루 코스가 너무 짧음');
  assert(route.walkMeters<=8000);
  assert(route.rows.every((r) => r.walkMeters<=1600 && r.walkEstimate<=25 && r.result.kind!=='bad' && r.actual));
  assert(route.endArrival<=route.end && route.endWalk.meters<=1600 && route.endWalk.minutes<=25 && route.endWalk.actual,JSON.stringify({endArrival:route.endArrival,end:route.end,endWalk:route.endWalk,last:route.rows.at(-1)?.placeId}));
  for (let i=1;i<route.rows.length;i++) assert(route.rows[i].minute>=route.rows[i-1].minute+route.rows[i-1].duration+route.rows[i].walkEstimate,'체류·이동 시간 겹침');
  for (const time of mealTimes) {
    const row=route.rows.find((r) => r.minute===engine.minutes(time) && r.kind==='meal');
    assert(row,`${time} 식사 누락`);
    assert(['food','cafe'].includes(places.find((p) => p.id===row.placeId).category));
  }
  if (shops) assert(route.rows.filter((r) => engine.SHOP_IDS.has(r.placeId)).length>=2,'소품샵 테마 반영 부족');
  if (coast) assert(route.rows.some((r) => ['p25','p32','p34'].includes(r.placeId)),'바다 테마 장소 누락');
  console.log(JSON.stringify({origin:route.originName,destination:route.destinationName,walkKm:route.walkMeters/1000,endArrival:route.endArrival,rows:route.rows.map((r) => ({time:r.minute,name:places.find((p)=>p.id===r.placeId).name,kind:r.kind,duration:r.duration,meters:r.walkMeters,actual:r.actual,status:r.result.kind})),endLeg:route.endWalk},null,2));
})().catch((error) => { console.error(error); process.exitCode=1; });
