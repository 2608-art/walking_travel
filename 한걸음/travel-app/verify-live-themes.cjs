const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const engine=require('./dist/route-engine.js');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const byId=id=>places.find(p=>p.id===id);
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const source=fs.readFileSync('./dist/app.js','utf8');
const evaluate=vm.runInNewContext(source.slice(source.indexOf('  function evaluate('),source.indexOf('  function pillFor('))+'\nevaluate;',{
  routeEngine:engine,entryPlace:e=>byId(e.placeId),toMin:engine.minutes,
  dateAt:(base,m)=>{const d=new Date(base+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(m/1440));return d.toISOString().slice(0,10);},
  weekday:d=>new Date(d+'T12:00:00Z').getUTCDay()
});
const validate=(p,m,d,date)=>evaluate({placeId:p.id,duration:d},m,date);
const input={places,origin:station,destination:station,date:'2026-10-04',start:'10:00',end:'20:00',theme:'balanced',validate};
const bus={minutes:33,meters:7228,walkMeters:443,walkMinutes:8,steps:[{type:'BUS',guidance:'검증용 22번 버스'}]};
async function api(mode,a,b){const q=new URLSearchParams({mode,start_x:a.lon,start_y:a.lat,end_x:b.lon,end_y:b.lat,start_id:a.id,end_id:b.id});const res=await fetch('http://127.0.0.1:8766/api/route?'+q);const data=await res.json();if(!res.ok)throw Error(data.error);return data.routes;}
(async()=>{
 const report=[];
 for(const theme of ['first','history','sea','shops','food','cafe']) {
  const preset=engine.THEME_PRESETS[theme];
  const route=(await engine.generateThemeDay({...input,theme,origin:byId(preset.originId)||station,destination:byId(preset.destinationId)||station,routeProvider:async(a,b)=>(await api('walk',a,b))[0],busProvider:async(a,b)=>api('transit',a,b)}))[0];
  assert(route,theme+' route missing');
  report.push({theme,start:route.start,end:route.endArrival,walkMeters:route.walkMeters,meals:route.plannedMeals,rows:route.rows.map(x=>({name:byId(x.placeId).name,minute:x.minute,actual:x.actual,kind:x.kind,walk:x.walkEstimate}))});
 }
 fs.writeFileSync('qa/live-themes-2026-10-04.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
