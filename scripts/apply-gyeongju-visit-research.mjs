import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function applyGyeongjuVisitResearch(data) {
  const files=['혼자여행-음식점-조사.json','혼자여행-카페-조사.json'];
  const seen=new Set();
  for(const file of files){
    const src=path.join(root,'한걸음/docs/지역/경주',file);
    if(!fs.existsSync(src)) throw Error('Missing research '+file);
    const report=JSON.parse(fs.readFileSync(src,'utf8'));
    const rows=Array.isArray(report)?report:report.rows;
    if(rows?.length!==48)throw Error('Expected48 '+file);
    for(const r of rows){
      const p=data.places.find(p=>p.id===r.id);
      if(!p || p.name!==r.name || seen.has(r.id) || !['food','cafe'].includes(p.category))throw Error('Invalid solo research '+r.id);
      seen.add(r.id);p.soloResearch=r;
      // Keep independent source evidence in soloResearch; compatibility fields only describe the finding.
      p.soloVerdict=r.verdict;p.soloMenu=r.menu?.text;p.minimumOrder=r.minimumOrder?.text;
      p.soloSeat=r.seat?.status==='confirmed'?r.seat.type:null;
      p.soloChecked='2026-10-06';p.soloNote=r.note;
    }
  }
  const booking=JSON.parse(fs.readFileSync(path.join(root,'한걸음/docs/지역/경주/예약-조사.json'),'utf8'));
  for(const r of booking.rows){const p=data.places.find(p=>p.id===r.id);if(!p)throw Error('Invalid reservation '+r.id);p.reservation={checkedAt:booking.checkedAt,items:r.items};}
  return data;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=path.join(root,'public/gyeongju-places.json');
  const data=applyGyeongjuVisitResearch(JSON.parse(fs.readFileSync(file,'utf8')));
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  console.log('Applied Gyeongju96solo research and scoped reservations');
}
