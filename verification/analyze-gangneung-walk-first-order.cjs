const fs=require('node:fs');
const routes=require('../public/gangneung-theme-review-routes.json').routes;
const places=require('../public/gangneung-places.json').places;
const byId=new Map(places.map(place=>[place.id,place]));
function meters(result){return result&&Number.isFinite(result.distance)?Math.round(result.distance*1000):Infinity;}
async function matrixFor(route){
  const locations=route.placeIds.map(id=>{const place=byId.get(id),lat=place?.lat??place?.mapLat,lon=place?.lon??place?.mapLon;if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error(id+' no pin');return {lat,lon};});
  const request={sources:locations,targets:locations,costing:'pedestrian',units:'kilometers'};
  const url='https://valhalla1.openstreetmap.de/sources_to_targets?json='+encodeURIComponent(JSON.stringify(request));
  const response=await fetch(url,{headers:{'User-Agent':'Hangeoreum walk-first order review'}}),data=await response.json();
  if(!response.ok||data.sources_to_targets?.length!==locations.length)throw Error(route.themeId+' matrix unavailable');
  const table=Array.from({length:locations.length},()=>Array(locations.length));
  for(const row of data.sources_to_targets)for(const result of row)table[result.from_index][result.to_index]=result;
  if(table.some(row=>row.some(value=>!value||!Number.isFinite(value.distance))))throw Error(route.themeId+' has unreachable pedestrian pairs');
  return {table,url};
}
function candidates(route,table){
  const n=route.placeIds.length,start=0,end=n-1,lunchId=Object.entries(route.mealSlots||{}).find(([,value])=>value==='점심')?.[0];
  const precedence=route.themeId==='food'?[['g27','g88'],['g88','g30'],['g30','g22'],['g22','g45'],['g45','g12'],['g45','g20'],['g45','g6']]:[];
  const middle=Array.from({length:n-2},(_,i)=>i+1),out=[];
  function visit(path,left){
    if(!left.length){
      const sequence=[start,...path,end];
      if(lunchId){const placeIndex=route.placeIds.indexOf(lunchId),position=sequence.indexOf(placeIndex),min=route.themeId==='food'?2:3;if(position<min||position>5)return;}
      if(precedence.some(([before,after])=>sequence.indexOf(route.placeIds.indexOf(before))>=sequence.indexOf(route.placeIds.indexOf(after))))return;
      const legs=sequence.slice(0,-1).map((from,i)=>({from:route.placeIds[from],to:route.placeIds[sequence[i+1]],meters:meters(table[from][sequence[i+1]]),minutes:Math.ceil(table[from][sequence[i+1]].time/60)}));
      const long=legs.map((leg,index)=>({index,...leg})).filter(leg=>leg.meters>2000).sort((a,b)=>b.meters-a.meters);
      const busLegs=long.slice(0,3).map(leg=>leg.index);
      const score=legs.reduce((sum,leg,index)=>sum+(busLegs.includes(index)?24:leg.minutes),0);
      out.push({score,sequence:sequence.map(index=>route.placeIds[index]),legs,busLegs});return;
    }
    for(let i=0;i<left.length;i++)visit([...path,left[i]],[...left.slice(0,i),...left.slice(i+1)]);
  }
  visit([],middle);
  out.sort((a,b)=>a.score-b.score||a.legs.reduce((s,l)=>s+l.meters,0)-b.legs.reduce((s,l)=>s+l.meters,0));
  return out;
}
async function main(){
  const report=[];
  for(const route of routes){
    const {table,url}=await matrixFor(route),choices=candidates(route,table),best=choices[0],currentIds=route.placeIds;
    const currentLegs=currentIds.slice(0,-1).map((from,i)=>({from,to:currentIds[i+1],mode:route.legs[i].mode,meters:meters(table[i][i+1]),minutes:Math.ceil(table[i][i+1].time/60)}));
    report.push({themeId:route.themeId,title:route.title,matrixUrl:url,current:{placeIds:currentIds,allPedestrianMeters:currentLegs.reduce((s,l)=>s+l.meters,0),walkOnlyMeters:currentLegs.filter(leg=>leg.mode==='walk').reduce((s,l)=>s+l.meters,0),legs:currentLegs},best:{score:best.score,placeIds:best.sequence,legs:best.legs,busLegs:best.busLegs.map(index=>best.legs[index])},alternatives:choices.slice(0,5).map(choice=>({score:choice.score,placeIds:choice.sequence,legs:choice.legs,busLegs:choice.busLegs.map(index=>choice.legs[index])}))});
  }
  fs.writeFileSync(require('node:path').join(__dirname,'qa','gangneung-walk-first-order-2026-10-07.json'),JSON.stringify({checkedOn:'2026-10-07',source:'OpenStreetMap/Valhalla pedestrian distance/time matrix',criteria:{fixedStartEnd:true,lunchWindowPositions:[4,5,6],foodLocalToCoastwardProgression:true,transitThresholdMeters:2000,maxTransitLegs:3,unverifiedTransitPenaltyMinutes:24},routes:report},null,2)+'\n');
  for(const route of report)console.log(JSON.stringify({themeId:route.themeId,currentWalkOnly:route.current.walkOnlyMeters,best:route.best.placeIds.map(id=>byId.get(id).name),legs:route.best.legs.map(leg=>({from:byId.get(leg.from).name,to:byId.get(leg.to).name,meters:leg.meters,mode:route.best.busLegs.some(bus=>bus.from===leg.from&&bus.to===leg.to)?'transit':'walk'}))}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
