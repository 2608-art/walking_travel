// 확정 코스가 없어도 입력 장소를 잇고, 버스 탑승시간 경계를 따로 표시한다.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/route-engine.js'),'utf8'),sandbox);
const engine=sandbox.module.exports;
const origin={id:'origin',name:'내 장소',lat:34.79,lon:126.38};
const nearby=[
  {id:'must',name:'가고 싶은 장소',lat:34.791,lon:126.38,category:'culture'},
  {id:'food',name:'가까운 식당',lat:34.7914,lon:126.38,category:'food'},
  {id:'cafe',name:'가까운 카페',lat:34.792,lon:126.38,category:'cafe'}
];
(async()=>{
  const base={places:nearby,origin,destination:origin,start:'10:00',end:'10:30',date:'2026-10-05',
    requiredPlaceId:'must',validate:()=>({kind:'bad',title:'선택한 시간에는 닫음'}),
    routeProvider:async(a,b)=>({meters:Math.ceil(engine.distanceKm(a,b)*1400),minutes:8,points:[]})};
  const review=await engine.generateReviewRoute(base);
  assert(review.review);
  assert(review.rows.some(row=>row.placeId==='must'),'필수 장소를 검토안에서도 유지');
  assert(review.issues.some(issue=>issue.includes('선택한 시간에는 닫음')));
  assert(review.issues.some(issue=>issue.includes('종료 시각')));
  assert(review.rows.every(row=>row.actual),'근처의 확인된 도보 경로 유지');
  const sameRequired=await engine.generateReviewRoute({...base,origin:nearby[0],destination:origin});
  assert.equal(sameRequired.rows.filter(row=>row.placeId==='must').length,0,'출발지와 같은 필수 장소를 중복 방문하지 않음');
  const far={id:'far',name:'먼 식당',lat:34.84,lon:126.38,category:'food'};
  const makeBus=(busRideMinutes)=>async()=>[{minutes:busRideMinutes+12,busRideMinutes,busRideSeconds:busRideMinutes*60,walkMinutes:12,walkMeters:350,
    points:[],steps:[{type:'BUS',minutes:busRideMinutes,guidance:'버스'}]}];
  const distant={...base,places:[far],requiredPlaceId:'',end:'24:00',validate:()=>({kind:'ok'})};
  const under=await engine.generateReviewRoute({...distant,busProvider:makeBus(59)});
  const over=await engine.generateReviewRoute({...distant,busProvider:makeBus(60)});
  assert(under.rows.some(row=>row.placeId==='far'));
  assert(!under.issues.some(issue=>issue.includes('버스 탑승만 60분 이상')));
  assert(over.issues.some(issue=>issue.includes('버스 탑승만 60분 이상')));
  const justBelow=await engine.generateReviewRoute({...distant,busProvider:async()=>[{
    minutes:72,busRideMinutes:60,busRideSeconds:3599,walkMinutes:12,walkMeters:350,
    steps:[{type:'BUS',minutes:60,guidance:'버스'}]
  }]});
  assert(!justBelow.issues.some(issue=>issue.includes('버스 탑승만 60분 이상')),'표시용 반올림으로 60분 미만을 제외함');
  const closeCafe={id:'near-cafe',name:'가까운 카페',lat:34.7901,lon:126.38,category:'cafe'};
  const themeReview=await engine.generateReviewRoute({...base,requiredPlaceId:'',theme:'food',places:[closeCafe,far]});
  assert(themeReview.rows.some(row=>row.placeId==='far'),'테마 검토용 순서에 테마 장소 포함');
  assert(!themeReview.rows.some(row=>row.placeId==='near-cafe'),'가까운 비테마 장소만으로 테마 검토안을 채우지 않음');
  const unknown=await engine.generateReviewRoute({...distant,busProvider:async()=>[]});
  assert(unknown.review && unknown.issues.some(issue=>issue.includes('탑승시간을 확인하지 못했습니다')));
  let offlineProviderCalls=0;
  const offlineDraft=await engine.generateReviewRoute({...base,offlineOnly:true,
    routeProvider:async()=>{offlineProviderCalls++;throw Error('API should not be called');},
    busProvider:async()=>{offlineProviderCalls++;throw Error('API should not be called');}});
  assert.equal(offlineProviderCalls,0,'오프라인 초안이 도보·버스 API를 추가 호출하지 않음');
  assert(offlineDraft.review && offlineDraft.rows.length>0);
  assert(offlineDraft.rows.every(row=>!row.actual),'오프라인 초안의 추정 구간을 실제 경로로 표시하지 않음');
  assert(offlineDraft.issues.some(issue=>issue.includes('좌표 간 직선거리')),'오프라인 초안의 추정 한계를 설명');
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const renderer=app.slice(app.indexOf('  function showReviewRoute('),app.indexOf('  function showRouteResults('));
  const makeRoot=()=>{const value={innerHTML:''};value.querySelector=()=>({insertAdjacentHTML:(_position,html)=>{value.innerHTML+=html;}});value.querySelectorAll=()=>[];return value;};
  const root=makeRoot(),button={},view={
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;'),
    getPlace:id=>nearby.find(p=>p.id===id),
    routePlace:id=>nearby.find(p=>p.id===id),
    initResultMap:()=>{},
    $:selector=>selector==='#view-market-short-route'?null:button,nav:()=>{},state:{route:{mode:'theme'}}
  };
  vm.runInNewContext(renderer+'\nshowReviewRoute(root,review);',{...view,root,review});
  assert(root.innerHTML.includes('루트 초안') && root.innerHTML.includes('가고 싶은 장소'));
  assert(!root.innerHTML.includes('테마 초안 저장'),'루트 미리보기에는 초안 저장 버튼이 없음');
  assert(!renderer.includes('테마 초안 저장'),'루트 결과 카드에는 초안 저장 UI가 없음');
  assert(!root.innerHTML.includes('id="import-route"'),'미확정 경로를 확정 추천처럼 계획표에 넣지 않음');
  const draftRoot=makeRoot();
  vm.runInNewContext(renderer+'\nshowReviewRoute(root,review);',{...view,state:{route:{mode:'theme',reviewDetailsPage:true}},root:draftRoot,review:offlineDraft});
  assert(draftRoot.innerHTML.includes('좌표 간 직선거리') && draftRoot.innerHTML.includes('출입구'));
  const belowRoot=makeRoot();
  vm.runInNewContext(renderer+'\nshowReviewRoute(root,review);',{...view,root:belowRoot,review:justBelow});
  assert(belowRoot.innerHTML.includes('59분 59초'),'60분 미만을 60분으로 반올림해 표시하지 않음');
  const makeRoutesSource=app.slice(app.indexOf('  async function makeRoutes('),app.indexOf('  function captureRouteInputs('));
  const themeState={route:{mode:'theme',theme:'food',date:'2026-10-05',review:null,themeReviewOnly:false},places:[far]};
  let reviewOfflineOnly=false;
  const appEngine={THEME_PRESETS:{food:{originId:'station',destinationId:'station'}},themeWindow:()=>({start:'10:00',end:'19:00'}),prepareRoutePlaces:values=>values,generateThemeDay:async(input)=>{try{await input.routeProvider(origin,far);}catch{}return[];},
    generateReviewRoute:async(input)=>{reviewOfflineOnly=input.offlineOnly;return {review:true,theme:input.theme,start:input.start,end:input.end,rows:[],issues:[]};}};
  const makeRoutes=vm.runInNewContext(makeRoutesSource+'\nmakeRoutes',{routeCache:new Map(),state:themeState,
    activeRegion:{id:'mokpo'},routeEngine:appEngine,getPlace:()=>origin,STATION:origin,routeOrigin:()=>origin,routeDestination:()=>origin,
    coord:point=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lon),evaluate:()=>({kind:'ok'}),getRoute:async()=>{throw Error('429 안전 한도');}});
  assert.equal((await makeRoutes()).length,0);
  assert(themeState.route.review?.review && themeState.route.review.theme==='food','테마 확정 코스가 없을 때 검토용 루트 연결');
  assert(reviewOfflineOnly,'API 한도 응답 뒤 검토 초안은 추가 API 호출 없이 생성');
  assert(themeState.route.themeReviewOnly,'검토 초안이 생성되면 다음 버튼도 검토용으로 표시');
  assert(themeState.route.review.start==='10:00' && themeState.route.review.end==='19:00');
  const missingState={route:{mode:'custom',date:'2026-10-05',review:null},places:nearby};
  const missingRoute=vm.runInNewContext(makeRoutesSource+'\nmakeRoutes',{routeCache:new Map(),state:missingState,
    activeRegion:{id:'mokpo'},routeEngine:appEngine,getPlace:()=>origin,STATION:origin,routeOrigin:()=>({name:'좌표 없는 출발지'}),routeDestination:()=>origin,
    coord:point=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lon),evaluate:()=>({kind:'ok'}),getRoute:async()=>[]});
  assert.equal((await missingRoute()).length,0);
  assert(missingState.route.locationMissing && !missingState.route.review,'좌표 없는 위치에 임의의 검토 경로를 만들지 않음');
  console.log(JSON.stringify({passed:true,reviewStops:review.rows.length,busRideBoundary:'59초/60분',themeReview:true,offlineDraft:true,unknownTransit:'검토용 유지'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
