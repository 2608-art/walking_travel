const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const routesPath=path.join(root,'public','gangneung-theme-review-routes.json');
const evidence=require('./qa/gangneung-cafe-map-distance-2026-10-07.json');
const data=JSON.parse(fs.readFileSync(routesPath,'utf8'));
const route=data.routes.find(item=>item.themeId==='cafe');
if(!route) throw new Error('Cafe route not found');
for(const proof of evidence.transitSegments){
  const leg=route.legs.find(item=>item.mode==='transit'&&item.from===proof.from&&item.to===proof.to);
  if(!leg) throw new Error(`Transit leg not found: ${proof.from} -> ${proof.to}`);
  const result=proof.mapResult;
  Object.assign(leg,{
    minutes:result.totalRouteMinutes,
    buses:result.routeLabel,
    surveyed:true,
    busDistanceMetersApprox:proof.busDistanceMetersApprox,
    busRideMinutes:result.busRideMinutes,
    totalRouteMinutes:result.totalRouteMinutes,
    accessWalkMeters:result.accessWalkMeters,
    accessWalkMinutes:result.accessWalkMinutes,
    egressWalkMeters:result.egressWalkMeters,
    egressWalkMinutes:result.egressWalkMinutes,
    boardingStop:{name:result.boardingStop,id:result.boardingStopId},
    alightingStop:{name:result.alightingStop,id:result.alightingStopId},
    busStopCount:result.stopCount,
    distanceSource:'Naver Map',
    distanceCheckedOn:evidence.checkedOn,
    distanceMethod:proof.distanceMethod
  });
}
for(const proof of evidence.walkingSegments){
  const leg=route.legs.find(item=>item.mode==='walk'&&item.from===proof.from&&item.to===proof.to);
  if(!leg) throw new Error(`Walking leg not found: ${proof.from} -> ${proof.to}`);
  Object.assign(leg,{naverMeters:proof.naverMeters,naverMinutes:proof.naverMinutes,naverCheckedOn:evidence.checkedOn,naverSource:'Naver Map'});
}
const unresolved=evidence.transitSegments.filter(proof=>!route.legs.some(leg=>leg.mode==='transit'&&leg.from===proof.from&&leg.to===proof.to&&leg.surveyed));
const unresolvedWalk=evidence.walkingSegments.filter(proof=>!route.legs.some(leg=>leg.mode==='walk'&&leg.from===proof.from&&leg.to===proof.to&&leg.naverMeters===proof.naverMeters));
if(unresolved.length||unresolvedWalk.length) throw new Error('Some Naver walking or bus evidence was not applied');
fs.writeFileSync(routesPath,JSON.stringify(data,null,2)+'\n');
console.log(`Applied Naver evidence to ${evidence.transitSegments.length} cafe bus legs.`);
