const fs = require('node:fs');
const assert = require('node:assert/strict');
const engine = require('./dist/route-engine.js');
const places = JSON.parse(fs.readFileSync('./dist/places.json','utf8')).places;
const byId = (id) => places.find((p) => p.id === id);
const station = {id:'station',name:'목포역',lat:34.7914,lon:126.3859};
function validate(p, minute, duration, date) {
  const dated=engine.datedHours(p,date);
  if (dated?.closed) return {kind:'bad',title:'해당 날짜 휴무'};
  const h=dated?.open ? {...p.hours,...dated} : p.hours;
  if (!h) return {kind:'unknown',title:'운영시간 확인 필요'};
  const t=minute%1440, start=engine.minutes(h.open), close=engine.minutes(h.close);
  if (h.closedDates?.includes(date) || (!dated?.open && h.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))) return {kind:'bad',title:'휴무'};
  if (t<start || t+duration>close || h.breaks?.some(([a,b])=>t<engine.minutes(b)&&t+duration>engine.minutes(a))) return {kind:'bad',title:'운영시간 외'};
  return {kind:'ok',title:'운영시간상 가능'};
}
async function run({origin=station,destination=station,start='10:00',end='24:00',theme='balanced',mealTimes=[]}) {
  return engine.generateAdaptive({places,origin,destination,start,end,theme,mealTimes,date:'2026-10-03',validate,variants:1});
}
(async () => {
  const cases=[
    ['default',{}],
    ['end museum',{destination:byId('p8')}],
    ['end history2',{destination:byId('p9')}],
    ['end skywalk',{destination:byId('p19')}],
    ['end near skywalk cafe',{destination:byId('p97')}],
    ['end near skywalk monument',{destination:byId('p17')}],
    ['end peace',{destination:byId('p14')}],
    ['origin museum',{origin:byId('p8')}],
    ['origin museum end skywalk',{origin:byId('p8'),destination:byId('p19')}],
    ['origin 갓바위 end peace',{origin:byId('p7'),destination:byId('p14'),theme:'sea'}],
    ['sea preset meal',{origin:byId('p7'),destination:byId('p14'),theme:'sea',mealTimes:['13:00','18:00']}],
    ['short day',{end:'18:00'}],
    ['afternoon',{start:'13:00',end:'21:00'}],
    ['15:30 meal',{start:'13:00',end:'21:00',mealTimes:['15:30']}],
    ['history',{theme:'history'}],
    ['sea',{theme:'sea'}],
    ['shops',{theme:'shops'}],
    ['food',{theme:'food',mealTimes:['12:30','18:30']}],
    ['cafe',{theme:'cafe'}],
    ['late start',{start:'18:00',end:'24:00'}]
  ];
  const result=[];
  for (const [name,input] of cases) {
    const routes=await run(input);
    for (const route of routes) {
      const origin=input.origin || station, destination=input.destination || station;
      assert.equal(route.originName,origin.name,`${name}: 출발지 불일치`);
      assert.equal(route.destinationName,destination.name,`${name}: 도착지 불일치`);
      assert(route.walkMeters <= 8000,`${name}: 하루 도보 초과`);
      assert(route.endArrival <= route.end,`${name}: 종료시각 초과`);
      assert(route.endWalk.meters <= 1600 && route.endWalk.minutes <= 30,`${name}: 마지막 도보 초과`);
      for (const row of route.rows) {
        assert(row.walkMeters <= 1600 && row.walkEstimate <= 30,`${name}: 구간 도보 초과`);
        assert(row.minute >= route.start && row.minute+row.duration <= route.end,`${name}: 체류시간 초과`);
        assert.notEqual(row.result.kind,'bad',`${name}: 영업시간 위반`);
      }
      for (const meal of input.mealTimes || []) {
        const row=route.rows.find((item) => item.minute === engine.minutes(meal) && item.kind === 'meal');
        assert(row,`${name}: ${meal} 식사 누락`);
        assert(['food','cafe'].includes(byId(row.placeId).category),`${name}: 식사 장소가 음식점·카페가 아님`);
      }
      if (input.theme && input.theme !== 'balanced') {
        const relevant=route.rows.filter((row) => {
          const p=byId(row.placeId);
          return input.theme === 'shops' ? engine.SHOP_IDS.has(row.placeId) :
            input.theme === 'history' ? ['p2','p8','p9','p12','p13','p20','p22','p29','p30','p31','p40'].includes(row.placeId) :
            input.theme === 'sea' ? ['p3','p4','p5','p6','p7','p14','p19','p24','p25','p32','p34','p36','p37'].includes(row.placeId) :
            input.theme === 'food' ? p.category === 'food' : p.category === 'cafe';
        });
        assert(relevant.length >= 1,`${name}: 테마 장소 누락`);
      }
    }
    result.push({name,count:routes.length,stops:routes[0]?.rows.length||0,km:routes[0]?(routes[0].walkMeters/1000).toFixed(1):'-'});
  }
  console.table(result);
  for (const name of ['default','end museum','end skywalk','origin museum end skywalk','sea preset meal','history','shops','food','cafe','late start']) {
    assert(result.find((x)=>x.name===name).count>0,`${name}: 예상 경로 없음`);
  }
  assert.equal(result.find((x)=>x.name==='end peace').count,0,'먼 권역까지 억지 도보 경로가 생성됨');
})().catch((error)=>{console.error(error);process.exitCode=1;});
