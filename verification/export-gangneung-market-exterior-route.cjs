const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'public','gangneung-market-exterior-route.json'),'utf8'));
if(data.id!=='gangneung-market-exterior-2026-10-07'||data.geometry?.coordinates?.length<30)throw Error('시장 외곽 코스 원본이 올바르지 않습니다.');
const properties={id:data.id,name:'강릉 시장 외곽 보행 코스',source:data.source.label,sourceUrl:data.source.url,
  status:'시장 외곽 보행망 확인 · 실내 통로와 실제 건물 문 미확인',meters:data.meters,
  stopIds:data.stops.map(s=>s.id),stopPointIndices:data.geometry.stopPointIndices,limitations:data.limitations};
const geojson={type:'Feature',properties,geometry:{type:'LineString',coordinates:data.geometry.coordinates}};
fs.writeFileSync(path.join(root,'public','gangneung-market-exterior-route.geojson'),JSON.stringify(geojson,null,2)+'\n');
const xmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const waypoints=data.stops.map((stop,i)=>{const [lon,lat]=data.geometry.coordinates[data.geometry.stopPointIndices[i]];
  return `  <wpt lat="${lat}" lon="${lon}"><name>${xmlEscape(stop.routeLabel||stop.name)}</name><desc>건물 밖 보행망 접근점. 실제 출입구 확인 전.</desc></wpt>`;}).join('\n');
const trackpoints=data.geometry.coordinates.map(([lon,lat])=>`    <trkpt lat="${lat}" lon="${lon}"/>`).join('\n');
const gpx=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Hangeoreum — OSM/Valhalla saved pedestrian geometry" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>강릉 시장 외곽 보행 코스</name><desc>1.377km. OSM/Valhalla 보행망에서 저장. 시장 내부 통로와 실제 출입문 미확인. GPX Studio 내보내기 파일 아님.</desc><link href="${xmlEscape(data.source.url)}"><text>OSM/Valhalla 원본 요청</text></link></metadata>\n${waypoints}\n  <trk><name>강릉 시장 외곽 보행 코스</name><trkseg>\n${trackpoints}\n  </trkseg></trk>\n</gpx>\n`;
fs.writeFileSync(path.join(root,'public','gangneung-market-exterior-route.gpx'),gpx);
console.log('Exported one GeoJSON LineString and one GPX track from the stored 38-point geometry.');
