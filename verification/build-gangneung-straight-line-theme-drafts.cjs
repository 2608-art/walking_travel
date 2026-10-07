const fs=require('node:fs');
const places=require('../public/gangneung-places.json').places;
const picks=require('../public/gangneung-theme-place-picks.json');
const routesPath='../public/gangneung-theme-review-routes.json';
const previous=JSON.parse(fs.readFileSync(require.resolve(routesPath),'utf8'));
const byId=new Map(places.map(place=>[place.id,place]));
const cafeRoute=previous.routes.find(route=>route.themeId==='cafe');
if(!cafeRoute) throw Error('기존 카페 투어 초안을 찾을 수 없습니다.');

const configs=[
  {themeId:'food',title:'강문·초당마을',core:['g5','g22','g35','g49','g45'],meals:{breakfast:'g33',lunch:'g88',dinner:'g181'},cafes:['g98','g30'],tailStops:[{id:'g56',kind:'place'},{id:'g257',kind:'take-home'}],omitFirstStop:true},
  {themeId:'sea',title:'커피거리·안목',core:['g14','g4','g156','g158','g37','g38'],meals:{breakfast:'g33',lunch:'g171',dinner:'g297'},cafes:['g189'],omitFirstStop:true},
  {themeId:'shops',title:'시장·먹거리',allStops:['g3','g27','g200','g1','g2','g73','g40','g58','g24'],precedence:[['g40','g58']],meals:{breakfast:'g33',lunch:'g40',dinner:'g58'},cafes:['g24']},
  {themeId:'history',title:'경포·오죽헌 역사·문화',core:['g9','g10','g11','g121','g12','g22'],meals:{breakfast:'g33',lunch:'g236',dinner:'g181'},cafes:['g21'],omitFirstStop:true}
];
const coords=id=>{
  const place=byId.get(id);
  if(!place) throw Error('장소가 없습니다: '+id);
  const lat=place.lat??place.mapLat,lon=place.lon??place.mapLon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) throw Error('좌표가 없습니다: '+id);
  return [lat,lon];
};
const distanceKm=(a,b)=>Math.hypot((a[0]-b[0])*111,(a[1]-b[1])*88);
const coordsDistanceKm=(a,b)=>distanceKm(coords(a),coords(b));
function shortestOpenOrder(start,ids,precedence=[]){
  let best=null;
  function visit(order,left,length){
    if(!left.length){if(!best||length<best.length)best={order:[...order],length};return;}
    for(let i=0;i<left.length;i++){
      const id=left[i];
      if(precedence.some(([before,after])=>id===after&&left.includes(before)))continue;
      const nextLength=length+coordsDistanceKm(order.at(-1),id);
      if(best&&nextLength>=best.length)continue;
      visit([...order,id],left.filter((_,index)=>index!==i),nextLength);
    }
  }
  visit([start],ids,0);
  return best.order.slice(1);
}
function projectToCorePath(id,path){
  const point=coords(id);let along=0,best=null;
  for(let i=0;i<path.length-1;i++){
    const a=coords(path[i]),b=coords(path[i+1]);
    const dx=(b[1]-a[1])*88,dy=(b[0]-a[0])*111;
    const px=(point[1]-a[1])*88,py=(point[0]-a[0])*111;
    const length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,(px*dx+py*dy)/length)):0;
    const offsetKm=Math.hypot(px-dx*t,py-dy*t);
    const segmentKm=distanceKm(a,b),progressKm=along+t*segmentKm;
    if(!best||offsetKm<best.offsetKm)best={progressKm,offsetKm,segmentIndex:i};
    along+=segmentKm;
  }
  return best;
}
function makeDraft(config){
  const breakfast=config.meals.breakfast;
  const fullStopOrder=config.allStops ? shortestOpenOrder(breakfast,config.allStops,config.precedence) : null;
  const mealIds=new Set(Object.values(config.meals));
  const cafeIds=new Set(config.cafes);
  const coreOrder=fullStopOrder ? fullStopOrder.filter(id=>!mealIds.has(id)&&!cafeIds.has(id)) : shortestOpenOrder(breakfast,config.core);
  const corePath=[breakfast,...coreOrder];
  const routePath=fullStopOrder ? [breakfast,...fullStopOrder] : corePath;
  const events=fullStopOrder ? routePath.map((id,index)=>{
    const meal=Object.entries(config.meals).find(([,mealId])=>mealId===id);
    const kind=meal?'meal':cafeIds.has(id)?'cafe':'place';
    return {id,kind,slot:meal?.[0],progressKm:index?coordsDistanceKm(routePath[index-1],id):0,offsetKm:0};
  }) : [{id:breakfast,kind:'meal',slot:'breakfast',progressKm:0,offsetKm:0}];
  let progressKm=0;
  if(!fullStopOrder){
    for(let i=1;i<corePath.length;i++){
      progressKm+=coordsDistanceKm(corePath[i-1],corePath[i]);
      events.push({id:corePath[i],kind:'place',progressKm,offsetKm:0});
    }
    for(const [slot,id] of Object.entries(config.meals)){
      if(slot==='breakfast')continue;
      const projection=projectToCorePath(id,corePath);
      events.push({id,kind:'meal',slot,...projection});
    }
    for(const id of config.cafes){
      const projection=projectToCorePath(id,corePath);
      events.push({id,kind:'cafe',...projection});
    }
    events.sort((a,b)=>a.progressKm-b.progressKm || (a.kind==='place'?-1:1));
  }
  const placeIds=fullStopOrder ? routePath : events.map(event=>event.id);
  if(config.tailStops?.length){
    const lastId=placeIds.at(-1),insertAt=placeIds.length-1;
    placeIds.splice(insertAt,0,...config.tailStops.map(stop=>stop.id));
    if(placeIds.at(-1)!==lastId)throw Error(config.themeId+' 마지막 장소 순서가 바뀌었습니다.');
  }
  if(config.omitFirstStop){
    if(placeIds[0]!==config.meals.breakfast)throw Error(config.themeId+' expected first stop is not the breakfast stop');
    placeIds.shift();
  }
  const activeEvents=events.filter(event=>placeIds.includes(event.id));
  const expectedStopCount=10+(config.tailStops?.length||0)-(config.omitFirstStop?1:0);
  if(placeIds.length!==expectedStopCount)throw Error(config.themeId+' 코스 장소 수 불일치: '+placeIds.length);
  if(new Set(placeIds).size!==placeIds.length)throw Error(config.themeId+' 중복 장소가 있음');
  const mealOrder=activeEvents.filter(event=>event.kind==='meal').map(event=>event.slot);
  const expectedMeals=config.omitFirstStop?['lunch','dinner']:['breakfast','lunch','dinner'];
  if(JSON.stringify(mealOrder)!==JSON.stringify(expectedMeals))throw Error(config.themeId+' 식사 순서가 예상과 다름: '+mealOrder);
  if(config.cafes.length>2)throw Error(config.themeId+' 카페가 2곳 초과');
  const legs=placeIds.slice(0,-1).map((from,index)=>{
    const to=placeIds[index+1],[fromLat,fromLon]=coords(from),[toLat,toLon]=coords(to);
    const meters=Math.round(coordsDistanceKm(from,to)*1000);
    return {from,to,mode:'walk',minutes:null,meters,straightLineMeters:meters,surveyed:false,geometrySource:'straight-line-order-draft',walkPoints:[[fromLon,fromLat],[toLon,toLat]]};
  });
  const totalMeters=legs.reduce((sum,leg)=>sum+leg.straightLineMeters,0);
  const eventById=new Map(events.map(event=>[event.id,event]));
  const route={
    id:'gangneung-'+config.themeId+'-straight-line-review',themeId:config.themeId,
    title:config.title+' · 확정 방문 순서',orderStatus:'user-confirmed',orderConfirmedOn:'2026-10-07',
    planNote:'장소 방문 순서는 확정했습니다. 지도 실선은 OpenStreetMap 보행망으로 저장한 GPX 구간입니다. 운영일·체류시간·현장 출입구와 실제 통행 가능 여부는 별도 확인이 필요합니다.',
    mealSlots:Object.fromEntries([[config.meals.breakfast,'아침'],[config.meals.lunch,'점심'],[config.meals.dinner,'저녁']].filter(([id])=>placeIds.includes(id))),
    transitLegCount:0,placeIds,
    orderBasis:{source:config.allStops?'place-pin straight-line minimization across all stops; lunch before dinner':'place-pin straight-line distance; optimized attraction order then meal/cafe insertion',checkedOn:'2026-10-07',walkingOrderMeters:totalMeters,busLegs:[],corePlaceIds:coreOrder,insertedStops:[...activeEvents.filter(event=>event.kind!=='place').map(event=>({id:event.id,kind:event.kind,slot:event.slot||null,offsetMeters:Math.round(event.offsetKm*1000)})),...(config.tailStops||[]).map(stop=>({id:stop.id,kind:stop.kind,slot:null,offsetMeters:null}))]},
    unknownHoursPlaceIds:[],directionStatus:'straight-line-order-draft',legs,
    stopKinds:{...Object.fromEntries(activeEvents.map(event=>[event.id,event.kind==='meal'?event.slot:event.kind])),...Object.fromEntries((config.tailStops||[]).map(stop=>[stop.id,stop.kind]))},
    startTime:'08:00'
  };
  const audit={themeId:config.themeId,title:route.title,corePlaceIds:coreOrder,orderedPlaceIds:placeIds,stopKinds:route.stopKinds,mealSlots:route.mealSlots,cafeCount:config.cafes.length,straightLineKilometers:Number((totalMeters/1000).toFixed(2)),segments:legs.map(leg=>({from:leg.from,to:leg.to,meters:leg.straightLineMeters,routeType:'pin-to-pin straight line; actual walk unverified'})),insertedStops:route.orderBasis.insertedStops};
  return {route,audit};
}

function preserveMatchingGeometry(route){
  const prior=previous.routes.find(item=>item.themeId===route.themeId);
  if(!prior?.walkGeometry||JSON.stringify(prior.placeIds)!==JSON.stringify(route.placeIds))return route;
  route.walkGeometry=prior.walkGeometry;route.directionStatus=prior.directionStatus;
  for(const leg of route.legs){
    const saved=prior.legs.find(item=>item.from===leg.from&&item.to===leg.to);
    if(saved)for(const key of ['walkPoints','actual','geometrySource','geometryMeters','geometryMinutes','geometrySnap','geometryReview'])if(saved[key]!==undefined)leg[key]=saved[key];
  }
  return route;
}
const built=configs.map(config=>{const item=makeDraft(config);item.route=preserveMatchingGeometry(item.route);return item;});
cafeRoute.orderStatus='user-confirmed';cafeRoute.orderConfirmedOn='2026-10-07';
cafeRoute.planNote='카페 방문 순서는 확정했습니다. 지도 실선은 OpenStreetMap 보행망으로 저장한 GPX 구간입니다. 버스 이동과 현장 출입구·통행 가능 여부는 별도 확인이 필요하며, 카페 투어라 식사 정차는 넣지 않았습니다.';
const result={version:3,status:'review-only',checkedOn:'2026-10-07',source:'User-confirmed visit order for four regional themes; stop 1 removed from Gangmun, sea, and history routes at user request; market and cafe routes retained.',orderAudit:'verification/qa/gangneung-straight-line-order-2026-10-07.json',routes:[...built.map(item=>item.route),cafeRoute]};
const audit={date:'2026-10-07',method:'Regional routes generally minimize the open path across a sightseeing backbone and insert meals/cafes by nearest projection. The market route minimizes straight-line distance across all selected food, cafe, market, and sightseeing stops together, with lunch before dinner. This is not a walk network.',rules:{routeStops:'Food 11 (12 originally before user-directed stop-1 removal); sea/history 9 each; market and cafe 10 each',breakfast:'omitted from food, sea, and history routes at user request; retained in the market route',meals:'market has breakfast, lunch, and dinner; food/sea/history retain lunch and dinner',cafes:'0-2 on regional routes',cafeTour:'existing 10-cafe route retained unchanged'},routes:[...built.map(item=>item.audit),{themeId:'cafe',title:cafeRoute.title,orderedPlaceIds:cafeRoute.placeIds,preserved:true,actualSavedWalkGeometry:Boolean(cafeRoute.walkGeometry)}]};
fs.writeFileSync(require.resolve(routesPath),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(require('node:path').resolve(__dirname,'../verification/qa/gangneung-straight-line-order-2026-10-07.json'),JSON.stringify(audit,null,2)+'\n');
for(const item of built)console.log(item.route.themeId,item.route.placeIds.join(' → '),(item.route.orderBasis.walkingOrderMeters/1000).toFixed(2)+' straight-line km');
