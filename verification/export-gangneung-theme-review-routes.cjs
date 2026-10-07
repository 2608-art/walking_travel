const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const qa=require('./qa/gangneung-theme-routes-naver-2026-10-07.json');
const commonRouteAudit=require('./qa/gangneung-common-theme-route-audit-2026-10-07.json');
const orderAudit=require('./qa/gangneung-walk-first-order-2026-10-07.json');
const places=require('../public/gangneung-places.json').places;
const orderByTheme=new Map(orderAudit.routes.map(route=>[route.themeId,route]));
const idsByTheme=Object.fromEntries(orderAudit.routes.map(route=>[route.themeId,route.best.placeIds]));
const transitPairsByTheme=new Map(orderAudit.routes.map(route=>[route.themeId,new Set(route.best.busLegs.map(leg=>leg.from+'>'+leg.to))]));
const routeNames={food:'시내→강문·초당→경포 · 식사 3회',sea:'시내→남항진→안목→송정 · 식사 3회',shops:'시내·월화거리·중앙시장 한 바퀴 · 식사 3회',cafe:'시내→초당→안목 카페 투어 · 10곳',history:'시내→오죽헌·경포→시내 · 식사 3회'};
const routeNotes={
  food:'시내 아침 뒤 관아를 보고 초당으로 이동해 원조초당순두부에서 점심을 먹습니다. 초당110과 허균·허난설헌 기념공원, 아르떼뮤지엄을 거쳐 경포호·해변·습지 방향으로 이어갑니다. 하루 식사는 아침·점심·저녁 한 번씩, 디저트 카페는 한 곳입니다. 버스 이동은 실제 승하차·배차를 확인하고, 해변·습지의 진입로와 운영시간은 방문일에 확인하세요.',
  sea:'시내 아침과 관아 뒤 남항진으로 이동해 해변·점심·솔바람다리를 둘러봅니다. 안목해변과 커피커퍼에서 쉬고 송정해변·송림과 테라로사 방향으로 이어 시내 저녁으로 돌아옵니다. 해변을 한 방향으로 따라가며 식사와 카페를 중간에 넣었습니다. 두 대중교통 구간의 승하차·배차와 해변 진입로는 방문일에 확인하세요.',
  shops:'시내 아침 뒤 굿즈임당과 월화거리 주변을 둘러보고 월화의 부엌에서 점심을 먹습니다. 관아·단오 전시관·월화교를 지나 닭강정 간식과 중앙시장을 들른 뒤 시내 저녁으로 마칩니다. 도심 보행망 기준의 한 바퀴 동선이며, 시장 내부 통로와 점포별 영업은 현장에서 확인하세요.',
  cafe:'명주동에서 봉봉방앗간·새바람이 오는 그늘·베리베리딸기를 둘러본 뒤 초당의 말차로·쵸딩·카페콥스·툇마루로 이어갑니다. 이후 안목의 커피커퍼·레오파드·보사노바 순으로 방문합니다. 시내→초당→안목 방향으로 묶은 카페 전용 코스이며 식당 정차는 없습니다. 두 권역 간 이동과 카페 영업일·대기는 방문일에 확인하세요.',
  history:'시내 아침 뒤 오죽헌·선교장·김시습기념관·경포대 순으로 북부권을 걷고, 경포대 인근에서 점심과 해변을 둘러봅니다. 단오 전시관과 관아를 거쳐 시내 저녁으로 돌아옵니다. 시내에서 북부권으로 이동한 뒤 한 방향으로 내려오는 구성입니다. 두 버스 구간의 승하차·배차와 전시 체류시간을 방문일에 확인하세요.'
};
const mealSlotsByTheme={
  food:{g33:'아침',g88:'점심',g58:'저녁'},
  sea:{g33:'아침',g297:'점심',g58:'저녁'},
  shops:{g33:'아침',g145:'점심',g58:'저녁'},
  history:{g33:'아침',g289:'점심',g58:'저녁'}
};
const placesById=new Map(places.map(place=>[place.id,place]));
const surveyedEdges=new Map();
for(const route of qa.routes)for(const leg of route.legs)surveyedEdges.set(leg.from+'>'+leg.to,leg);
for(const leg of commonRouteAudit.verifiedSegments)surveyedEdges.set(leg.from+'>'+leg.to,leg);
function pointFor(place){const lat=place?.lat??place?.mapLat,lon=place?.lon??place?.mapLon;if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error((place?.id||'unknown')+' lacks a pin');return {lat,lon};}
function distanceKm(a,b){const x=pointFor(a),y=pointFor(b);return Math.hypot((x.lat-y.lat),(.82*(x.lon-y.lon)))*111;}
function naverUrl(from,to,mode){const a=pointFor(from),b=pointFor(to),token=(place,p)=>`${p.lon}%2C${p.lat}%2C${encodeURIComponent(place.name)}%2Cundefined%2CADDRESS_POI`;return `https://way-m.map.naver.com/quick-path/${token(from,a)}/${token(to,b)}/-/${mode==='transit'?'transit':'walk'}/0`;}
const routes=Object.entries(idsByTheme).map(([themeId,placeIds])=>{
  if(placeIds.length!==10||new Set(placeIds).size!==10)throw Error(themeId+' must have ten unique places');
  const routePlaces=placeIds.map(id=>{const place=placesById.get(id);if(!place)throw Error(themeId+' missing '+id);pointFor(place);return place;});
  const legs=routePlaces.slice(0,-1).map((from,i)=>{
    const to=routePlaces[i+1],key=from.id+'>'+to.id,source=surveyedEdges.get(key),mode=transitPairsByTheme.get(themeId).has(key)?'transit':'walk';
    const matchedSource=source?.mode===mode?source:null;
    return {from:from.id,to:to.id,mode,minutes:matchedSource?.minutes??null,meters:matchedSource?.meters??null,buses:matchedSource?.buses??null,routeUrl:matchedSource?.routeUrl??naverUrl(from,to,mode),surveyed:!!matchedSource};
  });
  const mealSlots=mealSlotsByTheme[themeId]||{};
  const transitLegCount=legs.filter(leg=>leg.mode==='transit').length;
  if(transitLegCount>3)throw Error(themeId+' exceeds the three bus-leg limit');
  const order=orderByTheme.get(themeId);
  return {id:'gangneung-'+themeId+'-10-stop-review',themeId,title:routeNames[themeId],planNote:routeNotes[themeId],mealSlots,transitLegCount,placeIds,
    orderBasis:{source:'OpenStreetMap/Valhalla pedestrian matrix',checkedOn:orderAudit.checkedOn,walkingOrderMeters:order.best.legs.reduce((sum,leg)=>sum+leg.meters,0),busLegs:order.best.busLegs.map(leg=>({from:leg.from,to:leg.to,pedestrianDistanceMeters:leg.meters,routeStatus:'not verified; do not draw connector'}))},
    unknownHoursPlaceIds:[],directionStatus:'walk-first-order-review',legs};
});
const output={version:3,status:'review-only',checkedOn:'2026-10-07',source:'OSM/Valhalla pedestrian matrix for visit order; only matching Naver lookups remain, all other time/distance values stay unknown',orderAudit:'verification/qa/gangneung-walk-first-order-2026-10-07.json',routes};
fs.writeFileSync(path.join(root,'public','gangneung-theme-review-routes.json'),JSON.stringify(output,null,2)+'\n');
console.log('Exported one ten-place review itinerary for each of',routes.length,'Gangneung themes');
