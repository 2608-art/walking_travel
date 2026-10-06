const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const sandbox = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'), sandbox);
const engine = sandbox.module.exports;
const places = JSON.parse(fs.readFileSync('dist/client/places.json','utf8')).places;
const station = {id:'station',name:'목포역',lat:34.7914,lon:126.3859};
const place = id => places.find(item => item.id === id) || station;
function validate(p,minute,duration,date) {
  if (p.unrestrictedAccess) return minute>=7*60 && minute+duration<=18*60 ? {kind:'ok'} : {kind:'bad'};
  const dated=engine.datedHours(p,date);
  if (dated?.closed) return {kind:'bad'};
  const h=dated?.open ? {...p.hours,...dated} : p.hours;
  if (!h) return {kind:'bad'};
  const t=minute%1440;
  if (h.closedDates?.includes(date) || (!dated?.open && h.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))) return {kind:'bad'};
  if (t<engine.minutes(h.open) || t+duration>engine.minutes(h.close) || h.breaks?.some(([a,b])=>t<engine.minutes(b)&&t+duration>engine.minutes(a))) return {kind:'bad'};
  if ((h.lastEntry || h.lastOrder) && t>engine.minutes(h.lastEntry || h.lastOrder)) return {kind:'bad'};
  return {kind:'ok'};
}
const routeProvider = async (from,to) => ({...engine.estimate(from,to),actual:true});

(async () => {
  assert.equal(engine.THEME_START_TIMES.length,48);
  assert.equal(engine.THEME_START_TIMES[0],'00:00');
  assert.equal(engine.THEME_START_TIMES.at(-1),'23:30');
  assert.equal(engine.themeWindow('06:30').end,'15:30');
  assert.equal(engine.themeWindow('11:30').end,'20:00');
  for(const start of ['00:00','21:00','21:30','23:30'])
    assert(!(await engine.themeStartCandidate({places,origin:station,destination:station,date:'2026-10-06',start,theme:'first',validate})),`${start}: 늦은/이른 출발 후보`);
  assert(!(await engine.themeStartCandidate({places,origin:station,destination:station,date:'2026-10-06',start:'16:00',theme:'history',validate,
    routeProvider:async()=>{throw Error('경로 조회 불가');},busProvider:async()=>[]})),'실제 경로를 확인하지 못한 16시가 후보에 포함됨');
  let checked = 0, maxVisits = 0;
  const checkedThemes=new Set();
  for (const start of ['06:00','07:00','08:00','09:30','10:00','11:00','12:00','14:00','16:00']) {
    for (const theme of Object.keys(engine.THEME_PRESETS)) {
      const preset = engine.THEME_PRESETS[theme];
      const input={places,origin:place(preset.originId),destination:place(preset.destinationId),date:'2026-10-06',start,theme,validate};
      if(!(await engine.themeStartCandidate(input))) continue;
      const routes = await engine.generateThemeDay({...input,routeProvider});
      assert(routes.length,`${theme} ${start}: 코스 없음`);
      const route = routes[0];
      maxVisits=Math.max(maxVisits,route.rows.length);
      assert.equal(route.start,engine.minutes(start),`${theme} ${start}: 출발 시각 변경`);
      assert(route.rows.every(row => row.minute >= route.start),`${theme} ${start}: 출발 전 방문`);
      assert(route.endArrival <= Math.min(engine.minutes(start)+540,20*60),`${theme} ${start}: 20시/9시간 초과`);
      assert(route.rows.length>=5 && route.endArrival-route.start>=240,`${theme} ${start}: 하루 코스 부족`);
      assert(route.rows[0].minute-route.start-route.rows[0].walkEstimate<=60,`${theme} ${start}: 출발 직후 긴 대기`);
      assert(route.rows.every(row=>row.result.kind==='ok'),`${theme} ${start}: 운영 가능 미확인`);
      checked++;
      checkedThemes.add(theme);
    }
  }
  assert.equal(checkedThemes.size,6,'테마별 시작 후보 누락');
  assert(maxVisits>5,'5곳을 넘는 기존 방문 코스가 줄어듦');
  console.log(`PASS: ${checked}개 테마·시작시간 후보에서 최소 5곳, 최대 ${maxVisits}곳·20시 종료 확인`);
})().catch(error => {console.error(error);process.exitCode=1;});
