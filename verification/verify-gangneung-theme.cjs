const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'),sandbox);
const engine = sandbox.module.exports;
engine.configureRegion('gangneung');
const places = engine.prepareRoutePlaces(JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places);
const byId = id => places.find(place => place.id===id);
const preset = engine.THEME_PRESETS.sea;
const input = {
  places,origin:byId(preset.originId),destination:byId(preset.destinationId),
  date:'2026-10-06',start:'10:00',theme:'sea',busProvider:async()=>[],
  validate(place,minute,duration) {
    if(place.unrestrictedAccess) return minute>=7*60 && minute+duration<=18*60 ? {kind:'ok'} : {kind:'bad'};
    const hours={...place.hours,...place.weeklyHours?.[2]};
    if(!hours.open || hours.closedWeekdays?.includes(2)) return {kind:'bad'};
    const open=engine.minutes(hours.open),close=engine.minutes(hours.close);
    return minute>=open && minute+duration<=close && (!hours.lastOrder || minute<=engine.minutes(hours.lastOrder)) ? {kind:'ok'} : {kind:'bad'};
  }
};

(async()=>{
  assert.deepEqual(Array.from(engine.THEMES,theme=>theme.name),['강릉 기본 코스','강문·초당마을','커피거리·안목','시장·먹거리','특색있는 카페 투어','경포·오죽헌 역사·문화']);
  assert.equal(engine.THEME_PRESETS.cafe.originId,'g23');
  assert.equal(engine.THEME_PRESETS.cafe.destinationId,'g21');
  assert(engine.themeScore(byId('g258'),'cafe',0)>engine.themeScore(byId('g154'),'cafe',0),'특색 카페가 일반 카페보다 낮은 우선순위');
  assert(engine.distanceKm(byId('g23'),byId('g21'))>3,'강릉 전역 카페 코스의 출발·도착 권역이 너무 가까움');
  assert(!byId('g13'),'오죽헌 내부 시립박물관이 독립 장소로 남음');
  assert(byId('g9').description.includes('문성사') && byId('g9').description.includes('시립박물관'));
  const routes=await engine.generateThemeDay({...input,validate:()=>({kind:'ok'}),routeProvider:async(from,to)=>{const path=engine.estimate(from,to);return {...path,meters:Math.ceil(path.meters*.75),minutes:Math.max(1,Math.ceil(path.minutes*.75)),actual:true};}});
  assert.equal(routes.length,1,'안목 테마의 초기 탐색이 5곳 코스를 만들지 못함');
  const route=routes[0], ids=Array.from(route.rows,row=>row.placeId);
  assert(ids.length>=5&&ids.length<=15,'테마 코스 방문 수 범위 이탈');
  assert(ids.some(id=>['g147','g187','g189'].includes(id)),'안목 테마 경로에 커피거리 권역 장소가 없음');
  assert(route.walkMeters<=8000,'하루 도보 8km 상한 초과');
  assert(route.rows.every(row=>row.walkMeters<=2400 && row.walkEstimate<=40),'긴 도보 구간 상한 초과');
  assert(route.endWalk.meters<=2400 && route.endWalk.minutes<=40,'마지막 구간 상한 초과');
  const unavailable=await engine.generateThemeDay({...input,validate:()=>({kind:'ok'}),routeProvider:async()=>{throw Error('경로 API 이용 불가');}});
  assert.equal(unavailable.length,0,'실제 도보를 조회하지 못했는데 확정 코스가 표시됨');
  const cafePreset=engine.THEME_PRESETS.cafe;
  const cafeRoutes=await engine.generateThemeDay({places,origin:byId(cafePreset.originId),destination:byId(cafePreset.destinationId),date:'2026-10-06',start:'10:00',theme:'cafe',validate:()=>({kind:'ok'}),
    routeProvider:async(from,to)=>{const path=engine.estimate(from,to);if(path.meters>1500||path.minutes>30)throw Error('긴 구간');return {...path,actual:true};},
    busProvider:async()=>[{minutes:30,busRideMinutes:20,walkMinutes:5,walkMeters:300,actual:true,points:[],steps:[{type:'BUS',minutes:20,guidance:'test fixture'}]}]});
  assert.equal(cafeRoutes.length,1,'전역 특색 카페 투어의 합성 경로를 만들지 못함');
  const cafeStops=cafeRoutes[0].rows.filter(row=>byId(row.placeId).category==='cafe');
  assert(cafeStops.length>=3&&cafeStops.length<=4,'카페 투어의 카페 방문 수가 예상 범위를 벗어남');
  assert(cafeStops.filter(row=>['g24','g30','g43','g95','g98','g187','g189','g190','g191','g192','g193','g195','g198','g217','g223','g227','g258'].includes(row.placeId)).length>=2,'특색 카페 우선 배치가 작동하지 않음');
  console.log('PASS: 목적형 테마, 안목·바다 연계, 특색 카페 3~4곳, 합성 전역 버스 루트, 실제 경로 부재 시 미확정');
})().catch(error=>{console.error(error);process.exitCode=1;});
