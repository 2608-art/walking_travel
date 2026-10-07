import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'),sandbox);
const engine=sandbox.module.exports;engine.configureRegion('gyeongju');
const places=JSON.parse(fs.readFileSync('public/gyeongju-places.json','utf8')).places;
const app=fs.readFileSync('public/app.js','utf8');
const validateContext={routeEngine:engine,entryPlace:e=>places.find(p=>p.id===e.placeId),
  toMin:engine.minutes,weekday:date=>new Date(date+'T12:00:00Z').getUTCDay(),
  dateAt:(date,minute)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(minute/1440));return d.toISOString().slice(0,10);}};
vm.runInNewContext(app.slice(app.indexOf('  function evaluate('),app.indexOf('  function pillFor('))+
  app.slice(app.indexOf('  function validateThemeVisit('),app.indexOf('  let themeTimeCheckId')),validateContext);
let calls=0;const results=[];const providerCache=new Map();
const root='http://127.0.0.1:8765';
const provider=async(a,b,mode='walk')=>{
  const key=[mode,a.id,a.lat,a.lon,b.id,b.lat,b.lon].join('|');
  if(providerCache.has(key))return providerCache.get(key);
  calls++;if(calls>160)throw Error('Live verification call limit');
  const q=new URLSearchParams({mode,start_x:a.lon,start_y:a.lat,end_x:b.lon,end_y:b.lat,start_id:a.id,end_id:b.id});
  const r=await fetch(root+'/api/route?'+q,{signal:AbortSignal.timeout(20000)});const body=await r.json();
  if(!r.ok || body.status!=='OK' || !body.routes?.length)throw Error(body.error||'No verified route');
  const value=mode==='walk'?body.routes[0]:body.routes;providerCache.set(key,value);return value;
};
for(const date of ['2026-10-07','2026-10-10'])for(const theme of ['first','history','shops','food','sea']){
  const preset=engine.THEME_PRESETS[theme];const origin=places.find(p=>p.id===preset.originId),destination=places.find(p=>p.id===preset.destinationId);
  const routes=await engine.generateThemeDay({places,origin,destination,date,start:'10:00',theme,
    validate:validateContext.validateThemeVisit,routeProvider:(a,b)=>provider(a,b),busProvider:(a,b)=>provider(a,b,'transit')});
  if(theme!=='sea') assert(routes.length>0,'시내 테마 실제 코스 생성: '+theme);
  for(const route of routes){
    assert(route.rows.length>=5);assert(route.endArrival-route.start>=240);assert(route.endArrival<=1200);
    if(theme!=='sea') assert(route.rows.length>=9,'약 10곳 목표 회귀: '+theme);
    assert(route.rows[0].minute-route.start-route.rows[0].walkEstimate<=60);
    assert(route.walkMeters<=8000);assert(route.rows.every(x=>x.actual && x.result.kind==='ok'));assert(route.endWalk.actual);
    assert(!route.rows.some(x=>engine.EXCLUDED_IDS.has(x.placeId)||places.find(p=>p.id===x.placeId).researchOnly));
  }
  const result={date,theme,routeCount:routes.length,routes:routes.map(r=>({visits:r.rows.length,start:r.start,end:r.endArrival,walkMeters:r.walkMeters,
    rows:r.rows.map(x=>({...x,name:places.find(p=>p.id===x.placeId).name})),endWalk:r.endWalk}))};
  results.push(result);console.log(JSON.stringify({date,theme,routes:routes.length,visits:routes[0]?.rows.length,calls}));
}
fs.writeFileSync('한걸음/docs/지역/경주/추천루트-실경로-검증-2026-10-07.json',JSON.stringify({checkedAt:'2026-10-07',start:'10:00',source:root+'/api/route',usesEstimatedPaths:false,calls,results},null,2)+'\n');
console.log('Saved real API route verification; missing themes are reported, never asserted successful.');
