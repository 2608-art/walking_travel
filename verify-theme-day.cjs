const fs=require('node:fs');
const assert=require('node:assert/strict');
const engine=require('./dist/route-engine.js');
const places=JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const byId=(id)=>places.find((place)=>place.id===id);
const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
function validate(p,minute,duration,date) {
  const dated=engine.datedHours(p,date);
  if (dated?.closed) return {kind:'bad',title:'해당 날짜 휴무'};
  const h=dated?.open ? {...p.hours,...dated} : p.hours;
  if (!h) return {kind:'unknown',title:'운영시간 확인 필요'};
  const t=minute%1440;
  if (h.closedDates?.includes(date) || (!dated?.open && h.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))) return {kind:'bad',title:'휴무'};
  if (t<engine.minutes(h.open) || t+duration>engine.minutes(h.close) || h.breaks?.some(([a,b])=>t<engine.minutes(b)&&t+duration>engine.minutes(a))) return {kind:'bad',title:'운영시간 외'};
  return {kind:'ok',title:'운영시간상 가능'};
}
(async()=>{
  const report=[];
  for (const date of ['2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-17']) {
    for (const theme of Object.keys(engine.THEME_PRESETS)) {
      const preset=engine.THEME_PRESETS[theme];
      const origin=byId(preset.originId)||station, destination=byId(preset.destinationId)||station;
      const routes=await engine.generateThemeDay({places,origin,destination,date,theme,validate});
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
      report.push({date,theme,stops:route.rows.length,meals:route.plannedMeals.length,km:(route.walkMeters/1000).toFixed(1),end:route.end});
    }
  }
  console.table(report);
  assert(report.every((row)=>row.stops>0),'날짜·테마별 시간표 누락');
})().catch((error)=>{console.error(error);process.exitCode=1;});
