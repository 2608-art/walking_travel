import fs from 'node:fs';

const root = '한걸음/docs/지역/강릉/';
const audits = [
  '지도핀-음식시장-검증.json',
  '지도핀-카페책방-검증.json',
  '지도핀-자연문화체험-검증.json',
  '지도핀-음식재검증.json',
  '지도핀-카페소품-재검증.json',
  '지도핀-권역체험-재검증.json'
];
const path = 'public/gangneung-places.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const byId = new Map(data.places.map(place => [place.id, place]));
const seen = new Set();
let added = 0;

for (const file of audits) {
  if (!fs.existsSync(root + file)) throw Error(`Missing pin audit: ${file}`);
  const audit = JSON.parse(fs.readFileSync(root + file, 'utf8'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.checked)) throw Error(`Missing checked date: ${file}`);
  for (const match of audit.matches) {
    const place = byId.get(match.id);
    if (!place || place.name !== match.name || seen.has(match.id)) throw Error(`Pin identity conflict: ${match.id}`);
    seen.add(match.id);
    if (!Number.isFinite(match.mapLat) || !Number.isFinite(match.mapLon) ||
        match.mapLat < 37.3 || match.mapLat > 38.1 || match.mapLon < 128.5 || match.mapLon > 129.3) {
      throw Error(`Pin outside Gangneung: ${match.id}`);
    }
    const kakaoId = String(match.kakaoId || match.confirmid || '');
    if (!/^\d+$/.test(kakaoId) || match.source !== `https://place.map.kakao.com/${kakaoId}`) {
      throw Error(`Pin source mismatch: ${match.id}`);
    }
    if (place.lat !== null || place.lon !== null) throw Error(`Existing route point must be preserved: ${match.id}`);
    if (place.mapLat != null || place.mapLon != null) {
      if (place.mapLat === match.mapLat && place.mapLon === match.mapLon && place.mapPinSource === match.source) continue;
      throw Error(`Existing map point must be preserved: ${match.id}`);
    }
    place.mapLat = match.mapLat;
    place.mapLon = match.mapLon;
    place.mapPinBasis = match.basis || `카카오맵 장소 ${kakaoId}의 대표 위치`;
    place.mapPinSource = match.source;
    place.mapPinChecked = audit.checked;
    added++;
  }
}

const checked = '2026-10-06';
for (const [id, score, reviewCount] of [
  ['g233', 4.2, 13], ['g234', 4.5, 26],
  ['g215', 4.3, 666], ['g221', 5.0, 2]
]) {
  const place = byId.get(id);
  place.mapRating = {score, reviewCount, source: place.mapPinSource, checked};
}
delete byId.get('g149').mapRating; // 현행 지도 상호·전화가 달라 기존 이름의 평점으로 단정하지 않음.
byId.get('g233').locationText = '강릉시 금성로13번길 12-1(카카오맵 표기, 일부 방문 자료는 12)';
byId.get('g233').researchCaveat = '카카오맵 장소 ID와 고로케 업종, 방문 자료를 대조해 점포 대표 핀을 사용한다. 카카오맵은 금성로13번길 12-1, 일부 방문 자료는 12로 표기하므로 실제 출입문은 현장에서 확인. 부정기 휴무 가능.';
byId.get('g149').researchCaveat = '카카오맵에는 같은 주소의 휴가카페로 표시된다. 과거·최근 방문 자료의 장소 설명이 일치하지만 전화번호가 달라 현행 상호·운영시간은 방문 전 확인.';
byId.get('g215').researchCaveat = '카카오맵 도로명은 창해로 346, 관광공사·방문 자료는 348이다. 상호·지번 강문동 159-34·전화·층수가 일치해 동일 점포 대표 핀을 채택했다. 현행 가격과 심야 운영은 직접 확인 필요.';
byId.get('g221').researchCaveat = '카카오맵과 방문 자료의 상호·전화는 일치하지만 지번이 각각 교동 828-18과 828-17로 다르다. 카카오 장소 대표 핀을 쓰되 정확한 출입문·현행 운영은 방문 전 확인.';
byId.get('g41').researchCaveat = '카카오맵의 동일 상호·주소·전화 점포를 확인했으나 공개 평점은 등록되지 않았다. 초당토박이 할머니순두부와 다른 점포.';
byId.get('g65').researchCaveat = '업체 게시와 집계 페이지는 초당순두부길 57을 가리키지만 카카오맵에는 같은 주소의 다른 업소가 표시된다. 현행 영업과 정확한 점포 위치는 재확인 필요.';
byId.get('g144').researchCaveat = '과거 자료의 난설헌로 228에는 현재 다른 업소가 표시된다. 박종주반죽소의 다른 지점은 확인되지만 초당점은 이전·폐업 가능성이 있어 이 주소로 방문하기 전 현행 운영 확인 필요.';
byId.get('g100').researchCaveat = '2025년 방문기와 과거 지도 링크는 임영로 187 2층을 가리키지만 카카오맵 현행 장소검색에서 점포를 확인하지 못했다. 현재 입점·영업 여부 확인 필요.';
byId.get('g109').researchCaveat = '2025년 방문 주소 율곡로 2910 1층에는 카카오맵 기준 다른 업소가 등록돼 있다. 도자기별의 현행 영업·위치 확인 전 방문지로 확정하지 말 것.';

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(`Applied ${added} Gangneung map-only pins; total ${(data.places.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) || Number.isFinite(p.mapLat) && Number.isFinite(p.mapLon))).length}.`);
