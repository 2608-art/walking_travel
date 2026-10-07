const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('public/route-engine.js','utf8'),sandbox);
const engine=sandbox.module.exports;
engine.configureRegion('gangneung');
const data=JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places;
const routable=engine.prepareRoutePlaces(data);
const withRoutePoint=routable.filter(place=>Number.isFinite(place.lat)&&Number.isFinite(place.lon));
assert.equal(data.length,300,'강릉 장소 전체 수가 예상과 다름');
assert.equal(withRoutePoint.length,294,'검증된 지도 대표 핀을 루트 좌표로 연결하지 못함');
assert.equal(withRoutePoint.filter(place=>place.routeCoordinateBasis==='representative_map_pin').length,263,
  '대표 핀 경로 좌표의 근거 표시가 누락됨');
assert.equal(data.filter(place=>Number.isFinite(place.lat)&&Number.isFinite(place.lon)).length,31,
  '원본의 경로 좌표는 변경하지 않아야 함');
assert.equal(engine.minimumVisitCount({theme:'balanced'}),5);
assert.equal(engine.maximumVisitCount({theme:'balanced'}),15);

const origin={id:'test-station',name:'시험 출발',lat:37.764,lon:128.900};
const fixture=Array.from({length:20},(_,index)=>{
  const angle=2*Math.PI*index/20;
  return {id:'test-'+index,name:'시험 장소 '+index,category:index===18?'food':index===19?'cafe':'culture',mapLat:origin.lat+Math.sin(angle)*.002,
    mapLon:origin.lon+Math.cos(angle)*.002,mapPinBasis:'시험 대표 핀',hours:{open:'09:00',close:'20:00'}};
});
const planned=engine.prepareRoutePlaces(fixture);
const estimatePath=async(from,to)=>{
  const estimate=engine.estimate(from,to);
  return {...estimate,meters:Math.max(15,Math.ceil(estimate.meters*.9)),minutes:Math.max(1,Math.ceil(estimate.minutes*.9)),actual:true,
    points:[[from.lon,from.lat],[to.lon,to.lat]]};
};
const input={places:planned,origin,destination:origin,start:'09:00',end:'24:00',date:'2026-10-07',theme:'balanced',
  routeFocus:'through',routeProvider:estimatePath,validate:()=>({kind:'ok'})};
(async()=>{
  const routes=await engine.generateAdaptive(input);
  assert(routes.length>0,'합성 경로 자료로도 시험 코스를 만들지 못함');
  assert(routes.every(route=>route.rows.length>=5&&route.rows.length<=15),
    '강릉 맞춤 루트의 방문 장소 수가 5~15 범위를 벗어남');
  assert(routes.every(route=>route.rows.some(row=>row.kind==='meal')),
    '긴 강릉 맞춤 루트에 점심 정차가 배치되지 않음');
  assert(routes.every(route=>route.rows.some(row=>row.kind==='cafe')),
    '긴 강릉 맞춤 루트에 카페·간식 휴식이 배치되지 않음');
  const tooShort={...routes[0],rows:routes[0].rows.slice(0,4)};
  assert.equal(await engine.verifyEditedRoute(tooShort,{...input,start:'09:00',end:'24:00'}),null,
    '최소 방문 수 미달 코스를 검증 완료로 반환함');
  console.log(JSON.stringify({passed:true,totalPlaces:data.length,routeablePlaces:withRoutePoint.length,
    representativePinPlaces:263,syntheticRouteVisitCounts:routes.map(route=>route.rows.length)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
