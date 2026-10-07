const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'),sandbox);
const engine = sandbox.module.exports;
engine.configureRegion('gangneung');
const places = JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places;
const byId = id => places.find(place => place.id === id);

assert(!byId('g13'),'오죽헌 내부 시립박물관이 별도 장소로 중복됨');
assert(byId('g9').description.includes('문성사') && byId('g9').description.includes('시립박물관'));
assert.deepEqual(Array.from(engine.THEMES.filter(theme => theme.id !== 'balanced'),theme => theme.id),
  ['food','sea','shops','cafe','history'],'사용자와 정한 강릉 테마 5개 순서');
assert.deepEqual(Array.from(engine.THEMES.filter(theme => theme.id !== 'balanced'),theme => theme.name),
  ['강문·초당마을','커피거리·안목','시장·먹거리','특색있는 카페 투어','경포·오죽헌 역사·문화']);
assert.deepEqual(Array.from(engine.THEMES.filter(theme => theme.id !== 'balanced'),theme => engine.THEME_PRESETS[theme.id].description),[
  '강문 바다와 초당마을의 순두부·산책을 즐기는 테마',
  '안목 커피거리와 바닷가 풍경을 함께 즐기는 테마',
  '중앙시장 간식과 월화거리 주변 골목을 둘러보는 테마',
  '강릉의 개성 있는 카페와 시그니처 메뉴를 찾아가는 테마',
  '오죽헌·선교장·경포대에서 강릉의 역사와 문화를 만나는 테마'
],'테마 설명은 제목의 목적·매력을 소개하고 일정 구성이나 식사 횟수를 나열하지 않음');
for (const [theme,originId,destinationId] of [
  ['food','g33','g58'],['sea','g33','g58'],['shops','g33','g58'],
  ['cafe','g24','g17'],['history','g33','g58']
]) {
  assert.equal(engine.THEME_PRESETS[theme].originId,originId,`${theme} 시작 장소`);
  assert.equal(engine.THEME_PRESETS[theme].destinationId,destinationId,`${theme} 끝 장소`);
}

const routingPlaces = engine.prepareRoutePlaces(places);
const representativePin = routingPlaces.find(place => place.id === 'g15');
assert.equal(representativePin.lat,byId('g15').mapLat);
assert.equal(representativePin.lon,byId('g15').mapLon);
assert.equal(representativePin.routeCoordinateBasis,'representative_map_pin');

const historyPreset = engine.THEME_PRESETS.history;
const historyStart = engine.prepareRoutePlaces([byId(historyPreset.originId)])[0];
const historyEnd = engine.prepareRoutePlaces([byId(historyPreset.destinationId)])[0];
const base = {places:routingPlaces,origin:historyStart,destination:historyEnd,date:'2026-10-07',start:'10:00',end:'19:00',theme:'history',
  validate:()=>({kind:'ok'}),busProvider:async()=>[]};

(async()=>{
  const noConfirmedRoute = await engine.generateThemeDay({...base,routeProvider:async()=>{throw Error('경로 API 한도');}});
  assert.equal(noConfirmedRoute.length,0,'실제 도보 경로 API 실패를 확인 코스로 표시하지 않음');
  let apiCalls = 0;
  const review = await engine.generateReviewRoute({...base,offlineOnly:true,
    routeProvider:async()=>{apiCalls++;throw Error('초안은 API를 호출하지 않음');},
    busProvider:async()=>{apiCalls++;throw Error('초안은 API를 호출하지 않음');}});
  assert.equal(apiCalls,0,'테마 검토 초안은 도보·버스 API를 추가로 호출하지 않음');
  assert(review.review && review.rows.length > 0);
  assert(review.rows.every(row=>!row.actual),'좌표 추정 구간을 실제 도보 경로로 표시하지 않음');
  assert(review.issues.some(issue=>issue.includes('좌표 간 직선거리')),'검토 초안의 이동 한계를 설명');

  const app = fs.readFileSync('public/app.js','utf8');
  assert(app.includes('시내에서 시작해 아침·점심·저녁을 한 번씩') && app.includes('버스는 최대 세 구간'),'테마 화면에 공통 식사·교통 기준을 표시');
  assert(app.includes("const referenceStart=r.theme==='cafe'?'10:00':'08:00'"),'식사 코스는 아침 영업시간에 맞춰 시작');
  assert(app.includes("const STORAGE_THEME_ROUTE_DRAFTS = 'hangeoreum-theme-route-drafts-v1' + regionStorage"));
  assert(app.includes('검토용 테마 초안을 이 기기에 저장했습니다.'));
  assert(app.includes('data-open-theme-draft=') && app.includes('data-delete-theme-draft='));
  assert(app.includes("r.review=JSON.parse(JSON.stringify(draft.review))"),'저장된 방문 순서를 다시 복원함');
  console.log(JSON.stringify({passed:true,themes:5,representativePin:true,offlineThemeDraft:true,confirmedRoutes:0,
    mapCheckedRouteExamples:['강릉대도호부관아→월화교','안목커피거리→송정해변','경포대→오죽헌']}));
})().catch(error=>{console.error(error);process.exitCode=1;});
