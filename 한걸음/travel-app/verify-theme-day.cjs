const fs=require('node:fs');
const assert=require('node:assert/strict');
const engine=require('./dist/route-engine.js');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const byId=(id)=>places.find((place)=>place.id===id);
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const vm=require('node:vm');
const source=fs.readFileSync('./dist/app.js','utf8');
const evaluate=vm.runInNewContext(source.slice(source.indexOf('  function evaluate('),source.indexOf('  function pillFor('))+'\nevaluate;',{
  routeEngine:engine,entryPlace:e=>byId(e.placeId),toMin:engine.minutes,
  dateAt:(base,m)=>{const d=new Date(base+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(m/1440));return d.toISOString().slice(0,10);},
  weekday:d=>new Date(d+'T12:00:00Z').getUTCDay()
});
const validate=(p,m,d,date)=>evaluate({placeId:p.id,duration:d},m,date);
// 날짜별 동작 회귀용 공급자 응답이며 현장 실측을 뜻하지 않는다.
const fixtureWalk=async(a,b)=>engine.estimate(a,b);
(async()=>{
  const report=[];
  for (const date of ['2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-17']) {
    for (const theme of Object.keys(engine.THEME_PRESETS)) {
      const preset=engine.THEME_PRESETS[theme];
      const origin=byId(preset.originId)||station, destination=byId(preset.destinationId)||station;
      const routes=await engine.generateThemeDay({places,origin,destination,date,theme,validate,routeProvider:fixtureWalk});
      if (!routes.length) { report.push({date,theme,stops:0,meals:0,km:'-',end:'-'}); continue; }
      const route=routes[0];
      assert.equal(route.originName,origin.name);
      assert.equal(route.destinationName,destination.name);
      assert(route.autoSchedule && route.rows.length>=2);
      assert(route.endArrival<=route.end && route.end<=1440);
      assert(route.walkMeters<=8000);
      assert(route.endWalk.meters<=1600 && route.endWalk.minutes<=30);
      for(const row of route.rows){
        assert(row.walkMeters<=1600 && row.walkEstimate<=30);
        assert(row.minute>=route.start && row.minute+row.duration<=route.end);
        assert.notEqual(row.result.kind,'bad');
        if(row.kind==='meal') assert(['food','cafe'].includes(byId(row.placeId).category));
      }
      for(const kind of ['meal','cafe']) {const rows=route.rows.filter(r=>r.kind===kind); if(theme==='food' || kind==='cafe') assert(rows.length<=2); for(let i=1;i<rows.length;i++) assert(rows[i].minute-rows[i-1].minute >= (kind==='meal'?180:100));}
      report.push({date,theme,stops:route.rows.length,meals:route.plannedMeals.length,km:(route.walkMeters/1000).toFixed(1),end:route.end});
    }
  }
  fs.writeFileSync('qa/theme-routes-2026-10-04.json',JSON.stringify(report,null,2));
  console.table(report);
  assert(report.every((row)=>row.stops>0),'날짜·테마별 시간표 누락');
})().catch((error)=>{console.error(error);process.exitCode=1;});
