// 실제 앱 영업 판정 + 배포된 등록 장소 도보 API로 회귀를 재현한다.
// node audit-live-routes.cjs [결과 파일명] — API 오류는 성공으로 숨기지 않는다.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const setup=fs.readFileSync(path.join(__dirname,'audit-route-journeys.cjs'),'utf8').split('const cases =')[0];
const context=vm.runInNewContext(setup+';({engine,places,station,byId,validate})',{require,__dirname,console});
const {engine,places,station,byId,validate}=context;
const cache=new Map(), errors=[];
const fixturePath=path.join(__dirname,'qa','live-route-legs-2026-10-04.json');
if(fs.existsSync(fixturePath)) for(const [key,value] of Object.entries(JSON.parse(fs.readFileSync(fixturePath,'utf8')).legs)) cache.set(key,value);
async function routeProvider(a,b){
  const key=[a.id,a.lat,a.lon,b.id,b.lat,b.lon].join(':');
  if(cache.has(key)) return cache.get(key);
  const params=new URLSearchParams({mode:'walk',start_x:a.lon,start_y:a.lat,end_x:b.lon,end_y:b.lat,start_id:a.id,end_id:b.id});
  const response=await fetch('https://mokpo-day-planner.sooyeon-jun-0389.chatgpt.site/api/route?'+params,{signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok || !data.routes?.length){errors.push({key,status:response.status,error:data.error});throw Error(data.error||'도보 응답 없음');}
  const route=data.routes[0], value={meters:route.meters,minutes:route.minutes,actual:true};
  cache.set(key,value);return value;
}
const cases=[
  ['역 왕복 자정','station','station',{end:'24:00'}],
  ['역 왕복 18시','station','station',{}],
  ['역사관1관→역','p8','station',{}],
  ['역→역사관2관','station','p9',{}],
  ['갓바위→평화광장','p7','p14',{}],
  ['평화광장→갓바위','p14','p7',{}],
  ['역사관1관→노적봉 근거리','p8','p2',{}]
];
const transit=process.argv.includes('--transit');
async function busProvider(a,b){
  const params=new URLSearchParams({mode:'transit',start_x:a.lon,start_y:a.lat,end_x:b.lon,end_y:b.lat,start_id:a.id,end_id:b.id});
  const response=await fetch('https://mokpo-day-planner.sooyeon-jun-0389.chatgpt.site/api/route?'+params,{signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok || !data.routes?.length){errors.push({mode:'transit',from:a.id,to:b.id,status:response.status,error:data.error||data.status});throw Error(data.error||'버스 응답 없음');}
  return data.routes;
}
const report={date:'2026-10-04',checkedAt:new Date().toISOString(),transit,cases:[],errors};
function checkRoutes(routes){
  for(const r of routes){
    assert(r.rows.length>=2 && new Set(r.rows.map(x=>x.placeId)).size===r.rows.length);
    assert(r.endArrival<=r.end && r.walkMeters<=8000);
    let now=r.start,meters=0;
    for(const row of r.rows){
      assert(row.minute>=now+row.walkEstimate && row.walkMeters<=1600);
      assert(row.mode==='bus' ? row.actual && row.busLeg.walkMinutes<=30 && row.walkEstimate<=90 : row.walkEstimate<=30);
      const result=validate(byId(row.placeId),row.minute,row.duration,report.date);
      assert(result.kind!=='bad' && !(result.kind==='warn' && /체류 중 브레이크|폐관을 넘/.test(result.title)));
      now=row.minute+row.duration;meters+=row.walkMeters;
    }
    assert(r.endWalk.meters<=1600 && r.endArrival>=now+r.endWalk.minutes);
    assert(r.endWalk.mode==='bus' ? r.endWalk.actual && r.endWalk.walkMinutes<=30 && r.endWalk.minutes<=90 : r.endWalk.minutes<=30);
    assert.equal(r.walkMeters,meters+r.endWalk.meters);
  }
}
function summary(routes){checkRoutes(routes);return routes.map(r=>({signature:r.signature,visits:r.rows.length,meters:r.walkMeters,arrival:r.endArrival,transport:r.transport,adjusted:!!r.actualTimeAdjusted,dropped:r.adjustedDroppedNames||[],estimated:r.rows.some(x=>!x.actual)||!r.endWalk.actual,rows:r.rows.map(x=>({id:x.placeId,minute:x.minute,duration:x.duration,walk:x.walkEstimate,result:x.result.kind}))}));}
(async()=>{
  for(const [name,from,to,extra] of cases){
    const input={places,origin:byId(from),destination:byId(to),start:'10:00',end:'18:00',date:report.date,theme:'balanced',mealTimes:[],routeFocus:'through',validate,...extra};
    const estimated=await engine.generateAdaptive(input);
    const actual=await engine.generateAdaptive({...input,routeProvider,...(transit?{busProvider}:{})});
    const row={name,estimated:summary(estimated),actual:summary(actual)};report.cases.push(row);
    console.log(JSON.stringify({name,estimated:estimated.length,actual:actual.length,visits:actual.map(r=>r.rows.length)}));
  }
  for(const [theme,preset] of Object.entries(engine.THEME_PRESETS)){
    const actual=await engine.generateThemeDay({places,origin:byId(preset.originId),destination:byId(preset.destinationId),date:report.date,theme,validate,routeProvider,...(transit?{busProvider}:{})});
    report.cases.push({name:'theme:'+theme,actual:summary(actual)});
    console.log(JSON.stringify({theme,actual:actual.length,visits:actual.map(r=>r.rows.length)}));
  }
  fs.writeFileSync(path.join(__dirname,'qa',process.argv[2]||'live-route-before-2026-10-04.json'),JSON.stringify(report,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  fs.writeFileSync(fixturePath,JSON.stringify({source:'Published registered walking API; distances/times, no path geometry',checkedAt:new Date().toISOString(),legs:Object.fromEntries(cache)},null,2)+'\n');
});
