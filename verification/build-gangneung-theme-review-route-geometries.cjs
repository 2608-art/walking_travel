const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const routeFile=path.join(root,'public','gangneung-theme-review-routes.json');
const data=JSON.parse(fs.readFileSync(routeFile,'utf8'));
const places=require('../public/gangneung-places.json').places;
const byId=new Map(places.map(place=>[place.id,place]));
const outputDir=path.join(root,'public','gangneung-theme-routes');
const qaDir=path.join(__dirname,'qa');
const checkedOn='2026-10-07';
const MAX_SNAP_METERS=80;

function pin(id){
  const place=byId.get(id),lat=place?.lat??place?.mapLat,lon=place?.lon??place?.mapLon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error(id+' has no usable map pin');
  return {id,name:place.name,lat,lon,pinType:Number.isFinite(place.lat)?'route-pin':'representative-map-pin'};
}
function decodePolyline6(value){
  let index=0,lat=0,lon=0;const points=[];
  while(index<value.length){
    let result=0,shift=0,byte;
    do{byte=value.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32);
    lat+=result&1?~(result>>1):result>>1;result=0;shift=0;
    do{byte=value.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32);
    lon+=result&1?~(result>>1):result>>1;points.push([lon/1e6,lat/1e6]);
  }
  return points;
}
function meters(a,b){
  const rad=Math.PI/180,lat1=a[1]*rad,lat2=b[1]*rad,dLat=(b[1]-a[1])*rad,dLon=(b[0]-a[0])*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 12742017.6*Math.asin(Math.sqrt(h));
}
function walkRuns(route){
  const runs=[];let current=null;
  for(let i=0;i<route.legs.length;i++){
    if(route.legs[i].mode==='walk'){
      if(!current)current={firstLeg:i,lastLeg:i};else current.lastLeg=i;
    }else if(current){runs.push(current);current=null;}
  }
  if(current)runs.push(current);
  return runs;
}
async function fetchWalkRun(route,run){
  const stops=route.placeIds.slice(run.firstLeg,run.lastLeg+2).map(pin);
  const request={locations:stops.map(stop=>({lat:stop.lat,lon:stop.lon})),costing:'pedestrian',units:'kilometers',shape_format:'polyline6'};
  const url='https://valhalla1.openstreetmap.de/route?json='+encodeURIComponent(JSON.stringify(request));
  const response=await fetch(url,{headers:{'User-Agent':'Hangeoreum local route geometry build'}});
  const payload=await response.json();
  if(!response.ok||payload.trip?.legs?.length!==stops.length-1)throw Error(route.themeId+' walking route response incomplete: '+response.status+' '+JSON.stringify(payload));
  return {stops,payload,url};
}
async function buildRoute(route){
  route.legs.forEach(leg=>{if(leg.mode==='walk')delete leg.walkPoints;delete leg.geometryMeters;delete leg.geometryMinutes;delete leg.geometrySnap;delete leg.geometryReview;});
  const features=[],runs=[];
  for(const run of walkRuns(route)){
    const runFeatures=[];
    for(let firstLeg=run.firstLeg;firstLeg<=run.lastLeg;firstLeg+=9){
      const chunk={firstLeg,lastLeg:Math.min(firstLeg+8,run.lastLeg)};
      const result=await fetchWalkRun(route,chunk);
      for(let offset=0;offset<result.payload.trip.legs.length;offset++){
      const legIndex=chunk.firstLeg+offset,leg=route.legs[legIndex],from=pin(leg.from),to=pin(leg.to),responseLeg=result.payload.trip.legs[offset];
      const coordinates=decodePolyline6(responseLeg.shape||'');
      if(coordinates.length<2)throw Error(route.themeId+' empty OSM walking geometry '+leg.from+'>'+leg.to);
      const startSnapMeters=Math.round(meters(coordinates[0],[from.lon,from.lat]));
      const endSnapMeters=Math.round(meters(coordinates.at(-1),[to.lon,to.lat]));
      const usable=startSnapMeters<=MAX_SNAP_METERS&&endSnapMeters<=MAX_SNAP_METERS;
      const feature={type:'Feature',properties:{themeId:route.themeId,legIndex:legIndex+1,from:leg.from,to:leg.to,fromName:from.name,toName:to.name,
        meters:Math.round(responseLeg.summary.length*1000),minutes:Math.ceil(responseLeg.summary.time/60),startSnapMeters,endSnapMeters,
        accepted:usable,pinType:{from:from.pinType,to:to.pinType}},geometry:{type:'LineString',coordinates}};
      features.push(feature);runFeatures.push(feature);
      leg.geometryMeters=feature.properties.meters;leg.geometryMinutes=feature.properties.minutes;
      leg.geometrySnap={startMeters:startSnapMeters,endMeters:endSnapMeters,accepted:usable};
      if(usable){leg.walkPoints=coordinates;leg.actual=true;leg.geometrySource='OpenStreetMap/Valhalla pedestrian routing';}
      else{leg.actual=false;leg.geometryReview='pin-to-road snap exceeded 80m; line omitted from app map';}
      }
    }
    runs.push({firstLeg:run.firstLeg,lastLeg:run.lastLeg,features:runFeatures});
  }
  const accepted=features.filter(feature=>feature.properties.accepted).length;
  const rejected=features.filter(feature=>!feature.properties.accepted).length;
  route.walkGeometry={file:`gangneung-theme-routes/${route.themeId}.geojson`,gpx:`gangneung-theme-routes/${route.themeId}.gpx`,source:'OpenStreetMap/Valhalla public pedestrian router',checkedOn,acceptedLegs:accepted,rejectedLegs:rejected,walkLegs:features.length};
  route.directionStatus='saved-walking-geometry-review';
  return {route,features,runs};
}
function xml(value){return String(value).replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]));}
function writeGeoJson(item){
  return {type:'FeatureCollection',name:'Gangneung '+item.route.themeId+' pedestrian legs',metadata:{checkedOn,source:'OpenStreetMap/Valhalla public pedestrian router',attribution:'© OpenStreetMap contributors',note:'Only walk-mode legs are routed. Transit-mode gaps remain separate. Place pins may not be entrances.'},features:item.features};
}
function writeGpx(item){
  const stops=item.route.placeIds.map((id,index)=>({...pin(id),index:index+1}));
  const acceptedFeatures=item.features.filter(feature=>feature.properties.accepted);
  const trksegs=acceptedFeatures.map(feature=>'<trkseg>'+feature.geometry.coordinates.map(([lon,lat])=>`<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join('')+'</trkseg>').join('');
  const wpts=stops.map(stop=>`<wpt lat="${stop.lat}" lon="${stop.lon}"><name>${xml(String(stop.index).padStart(2,'0')+' '+stop.name)}</name><desc>Representative place pin; entrance not verified</desc></wpt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Hangeoreum · OpenStreetMap/Valhalla pedestrian geometry" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${xml(item.route.title)}</name><desc>Walk-mode legs only; transit legs are intentionally not connected. ${acceptedFeatures.length} walking legs, ${item.features.length-acceptedFeatures.length} omitted for pin snap over ${MAX_SNAP_METERS}m. Source: OpenStreetMap/Valhalla; checked ${checkedOn}.</desc><link href="https://www.openstreetmap.org/copyright"><text>© OpenStreetMap contributors</text></link></metadata>\n${wpts}<trk><name>${xml(item.route.title)} · 도보 구간</name><type>walking route segments</type>${trksegs}</trk>\n</gpx>\n`;
}
async function main(){
  fs.mkdirSync(outputDir,{recursive:true});
  const built=[];
  for(const route of data.routes){
    const item=await buildRoute(route);built.push(item);
    fs.writeFileSync(path.join(outputDir,route.themeId+'.geojson'),JSON.stringify(writeGeoJson(item),null,2)+'\n');
    fs.writeFileSync(path.join(outputDir,route.themeId+'.gpx'),writeGpx(item));
  }
  data.geometrySource='OpenStreetMap/Valhalla pedestrian geometry generated at build time; no route API call is made by the app';
  data.geometryCheckedOn=checkedOn;
  fs.writeFileSync(routeFile,JSON.stringify(data,null,2)+'\n');
  const qa={checkedOn,source:'OpenStreetMap/Valhalla public pedestrian routing',attribution:'© OpenStreetMap contributors',routes:built.map(({route,features})=>({themeId:route.themeId,title:route.title,gpx:`public/${route.walkGeometry.gpx}`,geojson:`public/${route.walkGeometry.file}`,walkLegCount:features.length,acceptedLegCount:features.filter(x=>x.properties.accepted).length,rejectedLegCount:features.filter(x=>!x.properties.accepted).length,legs:features.map(x=>x.properties)})),limitations:['Only legs marked walk in the saved theme draft receive walking geometry. Bus legs remain disconnected and are not represented as walk paths.','The router snaps representative place pins to mapped pedestrian roads; place entrances and on-site access are not verified.','This is build-time OSM/Valhalla output and not an export from the GPX Studio routing engine.']};
  fs.writeFileSync(path.join(qaDir,'gangneung-theme-route-geometries-2026-10-07.json'),JSON.stringify(qa,null,2)+'\n');
  console.log(JSON.stringify(qa.routes.map(route=>({themeId:route.themeId,walkLegs:route.walkLegCount,accepted:route.acceptedLegCount,rejected:route.rejectedLegCount,issues:route.legs.filter(leg=>!leg.accepted).map(leg=>`${leg.from}>${leg.to} snap ${leg.startSnapMeters}/${leg.endSnapMeters}m`)})),null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
