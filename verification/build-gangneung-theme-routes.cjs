const fs = require('node:fs');

const places = JSON.parse(fs.readFileSync('public/gangneung-places.json', 'utf8')).places;
const byId = new Map(places.map(place => [place.id, place]));
const point = id => {
  const place = byId.get(id);
  if (!place) throw new Error(`Unknown place: ${id}`);
  const lat = Number.isFinite(place.lat) ? place.lat : place.mapLat;
  const lon = Number.isFinite(place.lon) ? place.lon : place.mapLon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`No mapped pin: ${id}`);
  return { lat, lon, name: place.name, basis: place.mapPinBasis || '앱 저장 좌표; 현장 출입구 미확인' };
};

// Values were read from Naver Map's visible walking or transit route summaries on 2026-10-07.
// Transit times are the map's route estimates at query time; they are not timetable guarantees.
const edgeRows = [
  ['g22','g49','walk',2,186],['g49','g29','walk',9,644],['g29','g30','walk',5,371],['g30','g5','walk',12,776],['g5','g56','walk',8,565],
  ['g22','g31','walk',1,42],['g31','g41','walk',12,831],['g41','g98','walk',4,321],['g98','g5','walk',11,773],
  ['g22','g32','walk',2,174],['g32','g28','walk',8,537],['g28','g30','walk',11,789],['g31','g29','walk',11,764],['g49','g41','walk',10,711],
  ['g27','g8','walk',6,424],['g8','g1','walk',7,477],['g1','g72','walk',1,60],['g72','g26','walk',2,152],['g26','g7','walk',6,468],
  ['g1','g73','walk',2,169],['g73','g176','walk',1,122],['g176','g3','walk',6,421],['g3','g7','walk',8,578],
  ['g8','g145','walk',4,290],['g145','g1','walk',3,210],['g1','g40','walk',3,197],['g40','g7','walk',7,498],
  ['g1','g26','walk',2,133],['g26','g75','walk',3,249],['g75','g3','walk',6,400],['g72','g91','walk',1,47],['g91','g3','walk',4,324],
  ['g15','g96','walk',1,59],['g96','g17','walk',1,51],['g17','g171','walk',5,340],['g171','g14','walk',17,1200],
  ['g15','g4','walk',5,372],['g4','g147','walk',3,255],['g147','g17','walk',1,108],['g15','g187','walk',1,31],['g187','g147','walk',1,105],
  ['g147','g4','walk',4,255],['g4','g171','walk',4,311],['g4','g96','walk',4,312],['g15','g189','walk',1,114],['g189','g187','walk',1,103],
  ['g23','g24','walk',8,593],['g24','g258','walk',10,683],['g23','g258','walk',2,165],['g24','g25','walk',4,294],['g25','g258','walk',12,856],
  ['g258','g96','transit',26,null,'300-1'],['g96','g17','walk',1,51],['g17','g21','transit',29,null,'504-1, 207'],
  ['g96','g147','walk',1,57],['g147','g21','transit',27,null,'504-1, 207'],['g96','g21','transit',28,null,'504-1, 207'],
  ['g11','g6','walk',24,1600],['g6','g21','transit',27,null,'시티1'],['g6','g10','transit',9,null,'202-1'],['g21','g22','walk',9,667],['g22','g32','walk',2,174],
  ['g32','g9','transit',19,null,'202, 200'],['g11','g21','transit',28,null,'202'],['g11','g9','transit',12,null,'202-1'],['g9','g10','walk',17,1100],['g10','g9','walk',17,1100],
  ['g21','g9','transit',40,null,'시티1, 202-1'],['g9','g32','transit',33,null,'200, 202-1'],['g10','g32','transit',34,null,'202-1'],
  ['g32','g11','transit',24,null,'시티1, 202-1'],['g22','g9','transit',36,null,'시티1, 202-1'],['g27','g18','walk',12,749],
  ['g18','g9','transit',32,null,'300'],['g27','g18','walk',12,749],['g18','g27','walk',12,749],['g9','g27','transit',16,null,'200'],['g27','g9','transit',17,null,'200'],['g9','g11','transit',12,null,'202'],
  ['g6','g10','transit',9,null,'202-1'],['g10','g11','transit',6,null,'202'],['g11','g331','walk',1,81],['g331','g9','transit',13,null,'202-1'],
  ['g289','g11','walk',1,101],['g330','g11','walk',2,179],['g11','g289','walk',1,101]
];
const edgeMap = new Map(edgeRows.map(([from,to,mode,minutes,meters,buses]) => [`${from}>${to}`, { from, to, mode, minutes, meters, buses: buses || null }]));

const routeSpecs = [
  ['food','강문·초당 A — 기념공원·차·순두부·해변',['g22','g49','g29','g30','g5','g56']],
  ['food','강문·초당 B — 생가터·순두부·툇마루·해변',['g22','g31','g41','g98','g5']],
  ['food','강문·초당 C — 기념관·장칼국수·카페·해변',['g22','g32','g28','g30','g5']],
  ['food','강문·초당 D — 생가터·초당 순두부·카페·해변',['g22','g31','g29','g30','g5']],
  ['food','강문·초당 E — 전통차·순두부 식사·툇마루·해변',['g22','g49','g41','g98','g5']],
  ['sea','안목 A — 커피거리·카페·물회·송정',['g15','g96','g17','g171','g14']],
  ['sea','안목 B — 안목해변·뤼미에르·물회·송정',['g15','g4','g147','g17','g171','g14']],
  ['sea','안목 C — 카페거리·뤼미에르·해변·물회·송정',['g15','g187','g147','g4','g171','g14']],
  ['sea','안목 D — 해변·AM브레드·보사노바·물회·송정',['g15','g4','g96','g17','g171','g14']],
  ['sea','안목 E — 커피커퍼·레오파드·해변·물회·송정',['g15','g189','g187','g147','g4','g171','g14']],
  ['shops','시장 A — 관아·임당 굿즈·중앙시장·닭강정·월화교',['g27','g8','g1','g72','g26','g7']],
  ['shops','시장 B — 임당·시장 간식·월화거리 산책',['g27','g8','g1','g73','g176','g3','g7']],
  ['shops','시장 C — 임당·월화의 부엌·옹심이·월화교',['g27','g8','g145','g1','g40','g7']],
  ['shops','시장 D — 중앙시장 식사·젤라또·월화거리',['g27','g8','g1','g26','g75','g3','g7']],
  ['shops','시장 E — 중앙시장 닭강정·무침회·월화거리',['g27','g8','g1','g72','g91','g3','g7']],
  ['cafe','카페 투어 A — 임당·봉봉·베리베리딸기·안목',['g23','g24','g258','g96','g17']],
  ['cafe','카페 투어 B — 명주동·베리베리딸기·뤼미에르·경포호',['g23','g258','g96','g147','g21']],
  ['cafe','카페 투어 C — 봉봉·새바람·베리베리딸기·안목',['g24','g25','g258','g96','g17']],
  ['cafe','카페 투어 D — 임당·명주동·새바람·베리베리딸기',['g23','g24','g25','g258','g96']],
  ['cafe','카페 투어 E — 명주동·새바람·베리베리딸기·안목·경포',['g24','g25','g258','g96','g17','g21']],
  ['history','역사 A — 경포대 주변 식사·오죽헌·선교장',['g11','g331','g9','g10']],
  ['history','역사 B — 막국수·경포대·오죽헌·대도호부·단오제 전시관',['g289','g11','g9','g27','g18']],
  ['history','역사 C — 한정식·경포대·오죽헌·선교장',['g330','g11','g9','g10']],
  ['history','역사 D — 단오제 전시관·대도호부·오죽헌·경포대 식사',['g18','g27','g9','g11','g331']],
  ['history','역사 E — 경포해변·선교장·오죽헌·경포대·막국수',['g6','g10','g9','g11','g289']]
];

const routes = routeSpecs.map(([themeId,title,placeIds], index) => {
  const legs = [];
  for (let i=0;i<placeIds.length-1;i++) {
    const key = `${placeIds[i]}>${placeIds[i+1]}`;
    const edge = edgeMap.get(key);
    if (!edge) throw new Error(`No Naver-checked edge for ${title}: ${key}`);
    const from = point(edge.from), to = point(edge.to);
    const path = `https://way-m.map.naver.com/quick-path/${from.lon}%2C${from.lat}%2C${encodeURIComponent(from.name)}%2Cundefined%2CADDRESS_POI/${to.lon}%2C${to.lat}%2C${encodeURIComponent(to.name)}%2Cundefined%2CADDRESS_POI/-/${edge.mode}/0`;
    legs.push({ ...edge, fromName:from.name, toName:to.name, routeUrl:path, coordinateBasis:{from:from.basis,to:to.basis} });
  }
  const unknownHoursPlaceIds = placeIds.filter(id => {
    const p=byId.get(id);
    return !p.unrestrictedAccess && !p.hours && !p.weeklyHours;
  });
  return {
    id:`${themeId}-${String(index%5+1).padStart(2,'0')}`,
    themeId, title, placeIds,
    placeNames:placeIds.map(id=>byId.get(id).name),
    walkMinutes:legs.filter(leg=>leg.mode==='walk').reduce((sum,leg)=>sum+leg.minutes,0),
    walkMeters:legs.filter(leg=>leg.mode==='walk').reduce((sum,leg)=>sum+(leg.meters||0),0),
    transitMinutes:legs.filter(leg=>leg.mode==='transit').reduce((sum,leg)=>sum+leg.minutes,0),
    transitLines:[...new Set(legs.flatMap(leg=>(leg.buses||'').split(', ').filter(Boolean)))],
    unknownHoursPlaceIds,
    mapPathStatus:'각 인접 구간 네이버 길찾기 확인 완료',
    operatingStatus:'미완료: 방문 시간·배차·대기·영업일·예약 조건을 코스 시각에 맞춰 확정하지 않음',
    coordinateCaveat:'지도 길찾기는 앱 대표 좌표로 조회했으며, 일부 핀은 건물 대표점·권역 접근점이다. 실제 현장 문·해변 진입로까지는 별도 확인 필요.',
    legs
  };
});

const output = {
  title:'강릉 테마별 네이버 지도 구간 검증 자료',
  checkedAt:'2026-10-07',
  mapProvider:'Naver Map mobile walking/transit directions',
  routeCount:routes.length,
  routesByTheme:Object.fromEntries(['food','sea','shops','cafe','history'].map(theme=>[theme,routes.filter(route=>route.themeId===theme).length])),
  verificationScope:'25개의 서로 다른 후보 동선. 각 인접 구간에서 지도 길찾기 경로선과 요약 이동시간을 확인했다. 운영시간·배차 대기·예약·현장 입구는 모든 후보에 대해 완전 검증하지 않았다.',
  transitCaveat:'대중교통 구간의 시간·노선은 조회 시점 기준이며 실제 출발시간, 배차, 대기시간에 따라 달라질 수 있다.',
  routes
};
fs.writeFileSync('verification/qa/gangneung-theme-routes-naver-2026-10-07.json', JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({routes:routes.length, routesByTheme:output.routesByTheme, legs:routes.reduce((sum,route)=>sum+route.legs.length,0), output:'verification/qa/gangneung-theme-routes-naver-2026-10-07.json'},null,2));
