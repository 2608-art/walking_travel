import fs from 'node:fs';
export function applyGyeongjuRouteReadiness(data) {
  const rows=JSON.parse(fs.readFileSync(new URL('./gyeongju-route-readiness.json',import.meta.url),'utf8'));
  for (const row of rows) {
    const p=data.places.find(p=>p.id===row.id);
    if(!p || p.name!==row.name || !row.source || !row.checkedAt)throw Error('Invalid route readiness '+row.id);
    p.hours={...row.hours,source:row.source,checkedAt:row.checkedAt,note:row.note};
    if(row.weeklyHours)p.weeklyHours=row.weeklyHours;
    p.routeReadiness={source:row.source,checkedAt:row.checkedAt,scope:row.scope || '일반 방문',note:row.note};
    if(row.verifiedLegs?.length) {
      p.researchOnly=false;
      p.routeReadiness.verifiedLegs=row.verifiedLegs;
    }
  }
  return data;
}
