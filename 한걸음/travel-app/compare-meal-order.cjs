// 식사 시각을 경로보다 먼저 고를 때 결과 수가 어떻게 달라지는지 비교한다.
// 도보 구간은 로컬 추정치로 계산하며 외부 API를 호출하지 않는다.
const assert=require('node:assert/strict');
const engine=require('./dist/route-engine.js');
const places=require('./dist/places.json').places;
const byId=(id)=>places.find((p)=>p.id===id);
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const validate=(p,minute,duration,date)=>{
  const dated=engine.datedHours(p,date);
  if (dated?.closed) return {kind:'bad',title:'휴무'};
  const h=dated?.open ? {...p.hours,...dated,breaks:dated.breaks?.length ? dated.breaks : p.hours?.breaks} : p.hours;
  if (!h) return {kind:'unknown',title:'운영시간 확인 필요'};
  const time=minute%1440, open=engine.minutes(h.open), close=engine.minutes(h.close);
  if (h.closedDates?.includes(date) || (!dated?.open && h.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))) return {kind:'bad',title:'휴무'};
  if (time<open || time+duration>close || h.breaks?.some(([a,b])=>time<engine.minutes(b)&&time+duration>engine.minutes(a))) return {kind:'bad',title:'운영시간 외'};
  return {kind:'ok',title:'운영시간상 가능'};
};
const cases=[
  {name:'목포역 순환·종일',date:'2026-10-04',start:'10:00',end:'24:00',lunchTime:'12:30',dinnerTime:'18:00'},
  {name:'목포역 순환·오후 6시 종료',date:'2026-10-04',start:'10:00',end:'18:00',lunchTime:'12:30',dinnerTime:'17:00'},
  {name:'목포역 순환·오후 출발',date:'2026-10-04',start:'13:00',end:'21:00',lunchTime:'14:00',dinnerTime:'18:00'},
  {name:'목포역→역사관 2관',date:'2026-10-04',start:'10:00',end:'18:00',lunchTime:'12:30',dinnerTime:'17:00',destination:byId('p9')},
  {name:'목포역→역사관 2관·필수 방문',date:'2026-10-04',start:'10:00',end:'18:00',lunchTime:'12:30',dinnerTime:'17:00',destination:byId('p9'),requiredPlaceId:'p17'},
  {name:'목포역 순환·다른 날짜',date:'2026-10-05',start:'10:00',end:'20:00',lunchTime:'12:30',dinnerTime:'18:00'},
  {name:'목포역 순환·늦은 출발',date:'2026-10-04',start:'15:00',end:'24:00',lunchTime:'15:30',dinnerTime:'18:00'}
];
(async()=>{
  const results=[];
  for(const input of cases){
    const {lunchTime,dinnerTime,...routeInput}=input;
    const timings=[[],[lunchTime],[dinnerTime],[lunchTime,dinnerTime]];
    const counts=[];
    for(const mealTimes of timings){
      const routes=await engine.generateAdaptive({places,origin:station,destination:station,theme:'balanced',routeFocus:'through',
        ...routeInput,mealTimes,validate,routeProvider:null});
      for(const route of routes) for(const mealTime of mealTimes)
        assert(route.rows.some((row)=>row.kind==='meal'&&row.minute===engine.minutes(mealTime)),
          `${input.name}: ${mealTime} 식사 시각 누락`);
      counts.push(routes.length);
    }
    results.push({scenario:input.name,none:counts[0],lunch:counts[1],dinner:counts[2],both:counts[3]});
  }
  console.table(results);
  const summary={};
  for(const key of ['none','lunch','dinner','both']) summary[key]=results.filter((row)=>row[key]>0).length;
  console.log('코스가 하나 이상 나온 조건 수:',summary,'/',results.length);
})().catch((error)=>{console.error(error);process.exitCode=1;});
