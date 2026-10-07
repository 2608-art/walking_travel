const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'), sandbox);
const engine = sandbox.module.exports;
engine.configureRegion('gangneung');
const places = JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places;
const byId = id => places.find(p => p.id === id) || (id === 'gangneung-station' ? {id,name:'강릉역',lat:37.7641331,lon:128.8997106} : null);
const date = process.argv[2] || '2026-10-06';
const weekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
const routeProvider = async (from,to) => ({...engine.estimate(from,to),actual:true});
const busProvider = async () => [];
const validate = (place,minute,duration) => {
  if (place.unrestrictedAccess) return minute>=420 && minute+duration<=1080 ? {kind:'ok'} : {kind:'bad'};
  const hours={...place.hours,...place.weeklyHours?.[weekday]};
  if (!hours.open || hours.closedWeekdays?.includes(weekday)) return {kind:'bad'};
  const open=engine.minutes(hours.open), close=engine.minutes(hours.close);
  return minute>=open && minute+duration<=close && (!hours.lastOrder || minute<=engine.minutes(hours.lastOrder)) ? {kind:'ok'} : {kind:'bad'};
};

(async () => {
  const routable=places.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  const results=[];
  for (const theme of ['first','sea','history','shops','food']) {
    const preset=engine.THEME_PRESETS[theme];
    const origin=byId(preset.originId), destination=byId(preset.destinationId);
    if (!origin || !destination) throw Error(`Missing endpoint for ${theme}`);
    for (const start of ['09:00','10:00','11:00','12:00','13:00']) {
      const routes=await engine.generateThemeDay({places,origin,destination,date,start,theme,validate,routeProvider,busProvider});
      const route=routes[0];
      results.push({theme,start,visits:route?.rows.length||0,ids:route?.rows.map(r=>r.placeId)||[],walkMeters:route?.walkMeters||null,endArrival:route?.endArrival||null,simulatedActual:route?route.rows.every(r=>r.actual)&&route.endWalk.actual:false});
    }
  }
  const station=byId('gangneung-station');
  const customCases=[
    {name:'station-roundtrip-18',origin:station,destination:station,start:'10:00',end:'18:00'},
    {name:'station-roundtrip-24',origin:station,destination:station,start:'10:00',end:'24:00'},
    {name:'downtown-through',origin:byId('g27'),destination:byId('g7'),start:'10:00',end:'18:00'},
    {name:'coast-through',origin:byId('g17'),destination:byId('g6'),start:'10:00',end:'18:00'}
  ];
  const custom=[];
  for(const test of customCases){
    const routes=await engine.generateAdaptive({...test,places,date,theme:'balanced',mealTimes:[],routeFocus:'through',validate,routeProvider,busProvider});
    custom.push({name:test.name,routes:routes.map(route=>({ids:route.rows.map(r=>r.placeId),walkMeters:route.walkMeters,endArrival:route.endArrival,simulatedActual:route.rows.every(r=>r.actual)&&route.endWalk.actual}))});
  }
  console.log(JSON.stringify({date,method:'직선거리 기반 추정치를 실제 응답 형식으로 주입한 알고리즘 진단. 실제 보행 경로 아님.',routable:routable.length,themeResults:results,custom},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
