import fs from 'node:fs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'));
const places = {
  mokpo: new Map(read('places.json').places.map((place) => [place.id, place])),
  gangneung: new Map(read('gangneung-places.json').places.map((place) => [place.id, place])),
  gyeongju: new Map(read('gyeongju-places.json').places.map((place) => [place.id, place]))
};
const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];

// Only recurring closures supported by the saved place research belong here.
// Conflicting accounts, temporary closures and holiday exceptions remain unverified.
const recurringClosures = {
  mokpo: {
    p8:[1],p9:[1],p16:[1],p25:[1],p30:[1],p31:[1],p32:[1],p33:[1],p43:[1],
    p95:[1],p96:[1],p102:[1],p103:[0,6]
  },
  gangneung: {
    g24:[0,1],g25:[4],g27:[1],g33:[3],g49:[1],g73:[3],g88:[2],g98:[2],
    g121:[2],g171:[1],g181:[3],g193:[2],g195:[3],g223:[2],g258:[4]
  },
  gyeongju: {
    j42:[0],j74:[1],j77:[1,2],j130:[1],j153:[2]
  }
};

function baseCourses() {
  const mokpo = read('theme-courses.json').courses.map((course) => ({
    region:'mokpo', themeId:course.theme, title:course.title,
    stops:course.stops.map((stop) => ({placeId:stop.placeId,mealRole:stop.mealSlot || null}))
  }));
  const gangneung = read('gangneung-theme-review-routes.json').routes.map((course) => ({
    region:'gangneung',themeId:course.themeId,title:course.title,
    stops:course.placeIds.map((placeId) => ({placeId,mealRole:course.mealSlots?.[placeId] || null}))
  }));
  const gyeongju = read('gyeongju-six-theme-routes.geojson').features.map(({properties:course}) => {
    const stops=course.stops.map((stop) => ({placeId:stop.placeId,sequence:stop.sequence,mealRole:stop.mealRole || null}));
    for (const meal of course.meals || []) if (!stops.some((stop) => stop.placeId===meal.placeId))
      stops.push({placeId:meal.placeId,sequence:meal.sequence,mealRole:meal.slot || null});
    stops.sort((a,b)=>a.sequence-b.sequence);
    return {region:'gyeongju',themeId:course.themeId,title:course.title,stops};
  });
  return [...mokpo,...gangneung,...gyeongju];
}

const courses=baseCourses().map((course) => {
  const placeMap=places[course.region], closures=recurringClosures[course.region];
  const weekdays=weekdayNames.map((name,day) => {
    const closed=course.stops.filter((stop)=>{
      const listed=placeMap.get(stop.placeId)?.hours?.closedWeekdays;
      return (Array.isArray(listed)?listed:closures[stop.placeId]||[]).includes(day);
    }).map((stop)=>{
      const place=placeMap.get(stop.placeId);
      return {placeId:stop.placeId,name:place?.name || stop.placeId,reason:place?.closureText || '저장된 휴무 안내',source:place?.scheduleSource || place?.source || ''};
    });
    const excluded=new Set(closed.map((stop)=>stop.placeId));
    const remaining=course.stops.filter((stop)=>!excluded.has(stop.placeId));
    return {day,name,closed,remainingPlaceIds:remaining.map((stop)=>stop.placeId),
      remainingCount:remaining.length,
      meals:remaining.filter((stop)=>stop.mealRole && /아침|점심|저녁|lunch|dinner/.test(stop.mealRole)).length,
      cafes:remaining.filter((stop)=>placeMap.get(stop.placeId)?.category==='cafe').length};
  });
  const grouped=new Map();
  for (const day of weekdays) {
    const signature=day.remainingPlaceIds.join(',');
    if (!grouped.has(signature)) grouped.set(signature,{days:[],dayNames:[],remainingPlaceIds:day.remainingPlaceIds,
      closed:day.closed,remainingCount:day.remainingCount,meals:day.meals,cafes:day.cafes,
      geometryStatus:day.closed.length?'needs-new-walking-geometry':'original-saved-geometry',
      scheduleStatus:'weekday-closure-audit-only'});
    grouped.get(signature).days.push(day.day);
    grouped.get(signature).dayNames.push(day.name);
  }
  return {...course,stops:course.stops.map((stop)=>({placeId:stop.placeId,name:placeMap.get(stop.placeId)?.name || stop.placeId,
    category:placeMap.get(stop.placeId)?.category || null,mealRole:stop.mealRole})),
    variants:[...grouped.values()]};
});
const result={version:1,checkedOn:'2026-10-08',dayIndex:'JavaScript Sunday=0',
  status:'research-audit; not published as validated weekday routes',
  caveats:[
    'Unconfirmed business hours and temporary closures are not interpreted as open.',
    'Removing a closed stop changes the walking path; those variants require new geometry and visit-time validation.',
    'Holiday, seasonal and month-specific closures need the actual travel date.'
  ],courses};
const output=new URL('../verification/qa/theme-weekday-audit-2026-10-08.json',import.meta.url);
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({courses:courses.length,groups:courses.reduce((count,course)=>count+course.variants.length,0),
  changedGroups:courses.reduce((count,course)=>count+course.variants.filter((variant)=>variant.closed.length).length,0)}));
