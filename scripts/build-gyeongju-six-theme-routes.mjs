import fs from 'node:fs';

const places = JSON.parse(fs.readFileSync(new URL('../public/gyeongju-places.json', import.meta.url), 'utf8')).places;
const candidateData = JSON.parse(fs.readFileSync(new URL('../public/gyeongju-theme-candidates.geojson', import.meta.url), 'utf8'));
const checkedOn = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

// Each list keeps the cultural, market, bookshop and outdoor stops in a one-way order.
// Food and cafes are inserted only where the saved location falls along that walk.
const plans = [
  {
    id: 'hwangridan', name: '황리단길·대릉원 골목', description: '황리단길에서 대릉원·첨성대·동궁과 월지 방향으로 걷는 골목·유적 코스',
    names: ['황리단길','미피스토어 경주','제로스페이스 경주','스컹크웍스','소향몽','대릉원','첨성대','동궁과 월지','경주원조콩국'],
    roles: {'스컹크웍스':'cafe','소향몽':'lunch','경주원조콩국':'dinner'},
    startTime:'10:00', note: '시내에서 10:00 출발 기준이라 아침은 넣지 않았습니다. 09:00 이전 출발로 바꾸면 시내 식당에서 아침을 먹고 시작하세요.'
  },
  {
    id: 'wolseong', name: '첨성대·교촌·월정교', description: '동궁과 월지에서 서쪽으로 첨성대·월정교·교촌을 잇는 유적 산책',
    names: ['동궁과 월지','바넘커피','첨성대','경주원조콩국','월정교','교촌한옥마을','복길'],
    roles: {'바넘커피':'cafe','경주원조콩국':'lunch','복길':'dinner'},
    startTime:'10:00', note: '시내 유적권 안에서 동쪽에서 서쪽으로 이어갑니다. 10:00 출발 기준이며, 09:00 이전 출발이면 시내 아침을 추가하세요.'
  },
  {
    id: 'donggung', name: '동궁과 월지·동쪽 유적', description: '국립경주박물관에서 동궁과 월지, 분황사·왕경숲 방향으로 이어지는 동쪽 유적 코스',
    names: ['경주원조콩국','국립경주박물관','동궁과 월지','꼬푸GGOPU','분황사','신라왕경숲공원','보문뜰'],
    roles: {'경주원조콩국':'lunch','꼬푸GGOPU':'cafe','보문뜰':'dinner'},
    startTime:'11:30', note: '경주원조콩국에서 이른 점심을 먹고 박물관·유적을 북동쪽으로 걷습니다. 황룡사역사문화관은 2026년 전시실 개편 휴관 안내가 있어 관람 순서에서 제외했습니다. 09:00 이전 출발이면 시내 아침을 추가하세요.'
  },
  {
    id: 'bunhwang', name: '분황사·황룡사·왕경숲', description: '분황사와 왕경숲을 중심으로 북동쪽으로 이어가는 짧은 권역 코스',
    names: ['경주원조콩국','분황사','신라왕경숲공원','벤자마스','보문뜰'],
    roles: {'경주원조콩국':'lunch','벤자마스':'cafe','보문뜰':'dinner'},
    startTime:'11:30', note: '경주원조콩국에서 점심을 먹고 분황사에서 왕경숲 쪽으로 진행합니다. 현재 후보 중 관람 가능한 장소가 적어 5곳으로 구성했습니다. 황룡사역사문화관은 전시실 개편 휴관 안내가 있어 제외했습니다. 09:00 이전 출발이면 시내 아침을 추가하세요.'
  },
  {
    id: 'market', name: '읍성·성동시장·중앙시장', description: '중앙시장에서 책방·읍성을 지나 성동시장으로 북동쪽 진행하는 구도심 코스',
    names: ['경주중앙시장','커피플레이스 노동점','명동김밥 성동시장점','북샵라벤더','서점 북미','경주읍성','성동시장','영양숯불갈비'],
    roles: {'커피플레이스 노동점':'cafe','명동김밥 성동시장점':'lunch','영양숯불갈비':'dinner'},
    startTime:'10:00', note: '중앙시장에서 성동시장 쪽으로 진행하며, 저녁 식사 뒤 시내 숙소권으로 돌아오는 동선입니다. 09:00 이전 출발이면 시내 아침을 추가하세요.'
  },
  {
    id: 'bulguksa', name: '불국사 마을', description: '시내에서 점심을 먹고 불국사 권역을 걸은 뒤 시내로 돌아와 저녁을 먹는 코스',
    names: ['불국사','불국사박물관','동리목월문학관'],
    roles: {},
    cityMeals: [
      {name:'경주원조콩국',mealRole:'lunch',sequence:1,mapPin:true,placement:'시내 점심 · 불국사행 버스를 타기 전'},
      {name:'복길',mealRole:'dinner',sequence:5,mapPin:true,placement:'불국사 관람 후 시내로 돌아와 저녁'}
    ],
    startTime:'11:00', note: '시내에서 점심을 먹고 10·11번 버스 후보로 불국사에 올라갑니다. 불국사·박물관·동리목월문학관은 권역 내 도보 방문 후 버스로 시내에 내려와 저녁을 먹습니다. 식사 장소까지의 시내 도보와 실제 버스 시각·정류장·귀환편은 미확인입니다. 석굴암은 이번 코스에 포함하지 않았습니다.'
  }
];
const onlyIds = new Set(process.argv.slice(2));
for (const id of onlyIds) if (!plans.some((plan) => plan.id === id)) throw new Error(`Unknown theme: ${id}`);

const byName = new Map(places.map((place) => [place.name, place]));
const distanceMeters = (a, b) => {
  const dy = (a.lat - b.lat) * 111320;
  const dx = (a.lon - b.lon) * 91000;
  return Math.hypot(dx, dy);
};
const fetchRoute = async (stops) => {
  const coordinates = stops.map((stop) => `${stop.lon},${stop.lat}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordinates}?overview=false&geometries=geojson&steps=true`;
  const response = await fetch(url, {headers:{'User-Agent':'HangeoreumGyeongjuThemeRoutes/1.0'}});
  if (!response.ok) throw new Error(`FOSSGIS OSRM failed: HTTP ${response.status}`);
  const result = await response.json();
  if (result.code !== 'Ok' || result.routes?.[0]?.legs?.length !== stops.length - 1) throw new Error(`No complete foot route for ${stops.map((stop) => stop.name).join(' → ')}`);
  return {result, url};
};

const features = [];
const gpxTracks = [];
const gpxTrackByName = new Map();
for (const plan of plans) {
  if (onlyIds.size && !onlyIds.has(plan.id)) continue;
  const stops = plan.names.map((name, index) => {
    const place = byName.get(name);
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) throw new Error(`Missing place with coordinates: ${name}`);
    return {...place, sequence:index + 1, mealRole:plan.roles[name] || null};
  });
  const {result, url} = await fetchRoute(stops);
  const route = result.routes[0];
  const snapDistances = result.waypoints.map((waypoint) => waypoint.distance || 0);
  const maxPlaceSnapMeters = Math.round(Math.max(...snapDistances));
  const lines = route.legs.map((leg, index) => {
    const points = [];
    for (const step of leg.steps || []) for (const coordinate of step.geometry?.coordinates || []) {
      if (!points.length || points.at(-1)[0] !== coordinate[0] || points.at(-1)[1] !== coordinate[1]) points.push(coordinate);
    }
    if (points.length < 2) throw new Error(`Missing walking geometry: ${stops[index].name} → ${stops[index + 1].name}`);
    return points;
  });
  const properties = stops.map((place, index) => ({
    sequence:place.sequence+(plan.cityMeals?.filter((meal)=>meal.mealRole==='lunch').length||0),
    placeId:place.id,
    name:place.name,
    category:place.category,
    lat:place.lat,
    lon:place.lon,
    routeSnapMeters:Math.round(snapDistances[index]),
    locationText:place.locationText || '',
    scheduleText:place.scheduleText || place.hours ? (place.scheduleText || `${place.hours.open || '운영 시작 미확인'}~${place.hours.close || '운영 종료 미확인'}`) : '운영시간 미확인 · 방문 전 확인',
    priceInfo:place.priceInfo || null,
    mealRole:place.mealRole
  }));
  const mealStops = [
    ...stops.filter((place) => ['lunch','dinner'].includes(place.mealRole)).map((place) => ({place, sequence:place.sequence, mapPin:false, placement:`${place.mealRole === 'lunch' ? '점심' : '저녁'} · 보행 동선 중`})),
    ...(plan.cityMeals || []).map((meal) => {
      const place = byName.get(meal.name);
      if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) throw new Error(`Missing city meal with coordinates: ${meal.name}`);
      return {place:{...place,mealRole:meal.mealRole},sequence:meal.sequence,mapPin:meal.mapPin,placement:meal.placement};
    })
  ];
  const meals = mealStops.map(({place,placement,sequence,mapPin}) => ({
    slot:place.mealRole === 'lunch' ? '점심' : '저녁',
    sequence:sequence||place.sequence,
    mapPin:Boolean(mapPin),
    name:place.name,
    placeId:place.id,
    lat:place.lat,
    lon:place.lon,
    locationText:place.locationText || '',
    placement,
    menu:place.priceInfo?.label || '대표 메뉴 정보는 장소 상세 참고',
    price:place.priceInfo?.price || '현행 가격 확인 필요',
    hours:place.scheduleText || '운영시간 미확인 · 방문 전 확인',
    source:place.priceInfo?.source || place.source || '',
    checkedAt:place.priceInfo?.checked || checkedOn
  }));
  const cafes = stops.filter((place) => place.category === 'cafe');
  if (cafes.length > 2) throw new Error(`${plan.name}: cafe limit exceeded`);
  const themePlaces = candidateData.features.filter((feature) => feature.properties.themeId === plan.id).map((feature) => ({
    sequence:feature.properties.sequence || null,
    placeId:feature.properties.placeId,
    name:feature.properties.name,
    category:feature.properties.category,
    lat:feature.geometry.coordinates[1],
    lon:feature.geometry.coordinates[0],
    routeSnapMeters:null,
    locationText:byName.get(feature.properties.name)?.locationText || ''
  }));
  const busLegs = plan.id === 'bulguksa' ? [
    {from:'경주 시내',to:'불국사',route:'10·11번 후보',boardings:1,stopCandidate:'불국사 정류장',sourceUrl:'https://www.gyeongju.go.kr/tour/page.do?mnu_uid=4748',sourceTitle:'경주시 관광 시내버스 안내',scheduleStatus:'방문일 배차·승차 정류장·귀환편 확인 필요'},
    {from:'불국사',to:'경주 시내',route:'10·11번 후보',boardings:1,stopCandidate:'불국사 정류장',sourceUrl:'https://www.gyeongju.go.kr/tour/page.do?mnu_uid=4748',sourceTitle:'경주시 관광 시내버스 안내',scheduleStatus:'방문일 배차·승차 정류장·귀환편 확인 필요'}
  ] : [];
  const walkingRouteUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${stops.map((stop) => `${stop.lat},${stop.lon}`).join(';')}`;
  features.push({
    type:'Feature', id:`gyeongju-${plan.id}`,
    geometry:{type:'MultiLineString',coordinates:lines},
    properties:{
      id:`gyeongju-${plan.id}`,region:'gyeongju',themeId:plan.id,title:plan.name,description:plan.description,
      stops:properties,stopCount:stops.length+(plan.cityMeals||[]).length,walkStopCount:stops.length,placePoolCount:themePlaces.length,placePool:themePlaces,
      distanceMeters:Math.round(route.distance),walkingDistanceMeters:Math.round(route.distance),walkingMinutes:Math.max(1,Math.round(route.duration/60)),
      legMetrics:route.legs.map((leg,index)=>({from:stops[index].name,to:stops[index+1].name,meters:Math.round(leg.distance),minutes:Math.max(1,Math.round(leg.duration/60))})),
      cafeCount:cafes.length,meals,busLegs,busRides:busLegs.reduce((sum,leg)=>sum+leg.boardings,0),
      originArea:plan.id==='bulguksa'?'경주 시내 숙소권 · 불국사까지 버스':'경주 시내 숙소권',
      checkedAt:checkedOn,walkingProvider:'fossgis-osrm-foot',walkingSource:`FOSSGIS OSRM foot · OpenStreetMap · ${checkedOn}`,
      walkingRouteUrl,profile:'foot',sourceUrl:walkingRouteUrl,maxPlaceSnapMeters,
      accessNotes:[],unverifiedAccess:stops.map((stop,index)=>({stop,index,gap:snapDistances[index]})).filter(item=>item.gap>100).map(item=>({placeId:item.stop.id,placeName:item.stop.name,gapMeters:Math.round(item.gap),checkedAt,status:'unverified',note:'대표 좌표와 보행망 접점 사이의 진입 경로를 확인하지 못해 지도 선으로 보충하지 않음.'})),
      returnTransitChecked:false,hoursAreDaySpecific:false,startTime:plan.startTime,breakfastRule:`${plan.startTime} 출발 기준. 09:00 이전 출발이면 시내에서 아침 식사 후 합류.`,
      note:`${plan.note} 보행망 거리 약 ${(route.distance/1000).toFixed(2)}km · 걷기 약 ${Math.max(1,Math.round(route.duration/60))}분(방문·식사·대기 제외).`,
      routeRule:'관광·시장·책방 등 비식사 장소의 진행 방향을 먼저 정한 뒤, 그 보행선에서 크게 벗어나지 않는 식당·카페를 삽입. 카페 최대 2곳.',
      routeFlowNote:plan.id==='bulguksa'?'시내 점심 → 버스로 불국사 이동 → 불국사·박물관·문학관 도보 → 버스로 시내 복귀 → 시내 저녁. 식사와 버스는 보행선·GPX에서 분리했습니다.':null,
      optionalVisitNotes:plan.id==='bulguksa'?['표시된 0.91km·12분은 세 대표 좌표 사이의 보행망 이동만 계산합니다. 불국사 경내 관람 동선과 실제 출입구·정류장까지 걷는 거리는 포함되지 않았습니다.']:[],
      busRidesNote:plan.id==='bulguksa'?'버스는 시내↔불국사 왕복 후보 2회. 버스 경로는 도보 선에 포함하지 않으며 날짜별 운행은 미확인.':'시내권 도보 코스; 숙소별 접근은 별도.',
      mapData:'© OpenStreetMap contributors'
    }
  });
  const trackSegments = lines.map((line) => `<trkseg>${line.map(([lon,lat])=>`<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join('')}</trkseg>`).join('');
  const gpxTrack=`<trk><name>${plan.name}</name><type>walking</type><desc>${stops.length}곳 · ${Math.round(route.distance)}m 보행 · 약 ${Math.max(1,Math.round(route.duration/60))}분 · 카페 ${cafes.length}곳</desc>${trackSegments}</trk>`;
  gpxTracks.push(gpxTrack);
  gpxTrackByName.set(plan.name,gpxTrack);
  console.log(`${plan.id}: ${stops.length}곳 · ${Math.round(route.distance)}m · ${Math.max(1,Math.round(route.duration/60))}분 · 최대 핀 간격 ${maxPlaceSnapMeters}m`);
}

const geojsonPath = new URL('../public/gyeongju-six-theme-routes.geojson', import.meta.url);
const gpxPath = new URL('../public/gyeongju-six-theme-routes.gpx', import.meta.url);
const existingGeojson=onlyIds.size?JSON.parse(fs.readFileSync(geojsonPath,'utf8')):null;
const mergedFeatures=onlyIds.size?existingGeojson.features.map((feature)=>features.find((updated)=>updated.properties.themeId===feature.properties.themeId)||feature):features;
const geojson = onlyIds.size?{...existingGeojson,features:mergedFeatures}:{type:'FeatureCollection',name:'경주 6개 후보 테마 도보 루트',generator:'FOSSGIS OSRM foot, route lines checked and saved',checkedAt:checkedOn,features};
const existingGpx=onlyIds.size?fs.readFileSync(gpxPath,'utf8'):null;
const gpx = onlyIds.size?existingGpx.replace(/<trk>[\s\S]*?<\/trk>/g,(track)=>{
  const name=track.match(/<name>(.*?)<\/name>/)?.[1];
  return gpxTrackByName.get(name)||track;
}):`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="한걸음 · 경주 6개 테마 루트" xmlns="http://www.topografix.com/1/1"><metadata><name>경주 6개 후보 테마 보행 루트</name><desc>실제 보행망 구간만 저장. 불국사 왕복 버스는 GPX 선에서 제외. 확인 ${checkedOn}.</desc></metadata>${gpxTracks.join('')}\n</gpx>\n`;
fs.writeFileSync(geojsonPath, `${JSON.stringify(geojson,null,2)}\n`, 'utf8');
fs.writeFileSync(gpxPath, gpx, 'utf8');
console.log(`Saved ${features.length} updated routes to public/gyeongju-six-theme-routes.geojson and GPX.`);
