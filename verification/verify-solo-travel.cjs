const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const load=(name)=>{
  const sandbox={module:{exports:{}},console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public',name),'utf8'),sandbox);
  return sandbox.module.exports;
};
const solo=load('solo-travel.js');
const engine=load('route-engine.js');
const places=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/places.json'),'utf8')).places;
const place=(id)=>places.find((p)=>p.id===id);

assert(solo.canEat(place('p47')),'1인 메뉴가 확인된 식당 누락');
assert(solo.canEat(place('p59')),'라멘 1인 메뉴 누락');
assert(solo.canEat(place('p72')),'혼밥 방문 정황이 있는 집밥 식당 누락');
assert(solo.canEat(place('p84')),'사용자가 허용한 백반 단품 추정 후보 누락');
assert(!solo.canEat(place('p48')) && !solo.canVisit(place('p48')),'2인 구성 식당이 혼자 여행 코스에 포함됨');
assert(!solo.canEat(place('p76')) && !solo.canVisit(place('p76')),'포장 전문 장소가 식사 코스에 포함됨');
assert(!solo.canEat(place('p66')),'회식형 보쌈 식당이 혼밥 후보에 포함됨');
assert(solo.canEat(place('p94')) && solo.canEat(place('p105')),'식사 메뉴 카페 누락');
assert(!solo.canEat(place('p104')),'식사 메뉴가 확인되지 않은 카페가 식사 후보에 포함됨');
assert(solo.canVisit(place('p1')),'일반 관광 장소가 혼자 여행에서 제외됨');
(async()=>{
  const station={id:'station',name:'목포역',lat:34.7914,lon:126.3859};
  const validate=()=>({kind:'ok',title:'운영시간 확인'});
  const routes=await engine.generate({places,origin:station,destination:station,start:'10:00',end:'20:00',date:'2026-10-06',theme:'balanced',validate});
  assert(routes.length,'식사 후보 검증용 코스 생성 실패');
  const args={route:routes[0],places,origin:station,destination:station,date:'2026-10-06',validate,kind:'meal'};
  const filtered=engine.mealChoices({...args,candidateFilter:solo.canEat});
  assert(filtered.every((choice)=>solo.canEat(place(choice.placeId))),'혼자 여행에서 제외한 식당이 결과에 나타남');
  const cafes=engine.mealChoices({...args,kind:'cafe',candidateFilter:solo.canEat,mealDuration:60});
  assert(cafes.every((choice)=>solo.canEat(place(choice.placeId)) && choice.slots.every((slot)=>slot.duration===60)),'카페 식사 후보 또는 체류시간 오류');
  console.log('혼자 여행 후보 분류와 식사 필터 확인 완료');
})().catch((error)=>{console.error(error);process.exitCode=1;});
