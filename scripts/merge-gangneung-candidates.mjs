import fs from 'node:fs';

const root = '한걸음/docs/지역/강릉/';
const files = [
  '추가후보-음식시장.json',
  '추가후보-카페책방.json',
  '추가후보-자연문화체험.json',
  '추가후보-음식시장-2.json',
  '추가후보-카페책방-2.json',
  '추가후보-자연문화체험-2.json',
  '추가후보-음식시장-3.json',
  '추가후보-카페책방-3.json',
  '추가후보-자연문화체험-3.json',
  '추가후보-음식시장-4.json',
  '추가후보-카페책방-4.json',
  '추가후보-자연문화체험-4.json',
  '추가후보-카카오누락-5.json',
  '평점4이상-시장먹거리-추가조사.json',
  '평점4이상-음식점-추가조사.json',
  '평점4이상-음식점-후속승격.json',
  '평점4이상-음식점-추가교체-2곳.json',
  '평점4이상-음식점-저평점교체-승격후보.json'
];
const output = 'public/gangneung-places.json';
const data = JSON.parse(fs.readFileSync(output,'utf8'));
// 중복·접근 미확인 장소 및 사용자가 요청한 최저 평점 음식·시장 장소 교체.
const replacedLowRated = new Set([
  '현대장칼국수 본점', '금학칼국수', '이만구교동짬뽕', '정남미명과 강릉본점',
  '명성오징어순대', '형제칼국수', '강릉불고기 초당점', '모자호떡',
  '삼교리동치미막국수 강릉포남점',
  '두리튀김', '유성상회', '차현희순두부청국장', '이화국수 강릉본점',
  '브뤼셀프라이 강릉중앙점', '수제 어묵 고로케', '벌집칼국수',
  '강릉옥수수빵', '강릉감자닭강정', '바로방 중앙시장직영점',
  '초당토박이할머니순두부', '고고횟집', '강원옥', '커피러버스',
  '다연', '안목애', '머구리횟집', '호수정 강릉본점', '정은숙 초당순두부',
  '동화가든 본점', '농촌순두부', '단아생선구이', '종수반점',
  '까치칼국수', '남산막국수', 'OODD', '송파회식당', '독도수산', '여수횟집'
]);
data.places = data.places.filter(place => !['장미경양식','강릉 해운정','강릉향교','강릉 굴산사지'].includes(place.name) && !replacedLowRated.has(place.name));
const ratingAudit = JSON.parse(fs.readFileSync(root+'카카오맵-평점-대조.json','utf8'));
const ratingMap = new Map([...ratingAudit.verified,...ratingAudit.checkedBelowFour].map(item => [item.candidateName || item.name,item]));
const marketResearch = JSON.parse(fs.readFileSync(root+'평점4이상-시장먹거리-추가조사.json','utf8'));
for (const item of marketResearch.candidates) {
  ratingMap.set(item.name,{score:item.kakao.rating,reviewCount:item.kakao.reviewCount,url:item.kakao.url});
}
const marketExisting = JSON.parse(fs.readFileSync(root+'카카오맵-시장기존장소-평점조사.json','utf8'));
for (const item of marketExisting.matched) {
  if (['below_4_review','at_least_4'].includes(item.status) && item.rating && item.kakaoUrl) {
    ratingMap.set(item.appName,{score:item.rating,reviewCount:item.reviewCount,url:item.kakaoUrl});
  }
}
const foodEarly = JSON.parse(fs.readFileSync(root+'카카오맵-음식점기존장소-g1-g99-평점조사.json','utf8'));
for (const item of foodEarly.matched) {
  if (['below_4_review','at_least_4'].includes(item.status) && item.rating && item.kakaoUrl) {
    ratingMap.set(item.appName,{score:item.rating,reviewCount:item.reviewCount,url:item.kakaoUrl});
  }
}
const foodLater = JSON.parse(fs.readFileSync(root+'기존-음식점-카카오평점-감사-g100-g256.json','utf8'));
for (const item of foodLater.records) {
  if (['rating_4_plus','rating_below_4'].includes(item.classification) && item.rating && item.mapUrl) {
    ratingMap.set(item.name,{score:item.rating.score,reviewCount:item.rating.reviewCount,url:item.mapUrl});
  }
}
const foodResearch = JSON.parse(fs.readFileSync(root+'평점4이상-음식점-추가조사.json','utf8'));
for (const item of foodResearch.candidates) {
  ratingMap.set(item.name,{score:item.rating.score,reviewCount:item.rating.reviewCount,url:item.mapUrl});
}
const foodFollowup = JSON.parse(fs.readFileSync(root+'평점4이상-음식점-후속승격.json','utf8'));
for (const item of foodFollowup.promoted) {
  ratingMap.set(item.name,{score:item.rating.score,reviewCount:item.rating.reviewCount,url:item.mapUrl});
}
const finalFood = JSON.parse(fs.readFileSync(root+'평점4이상-음식점-추가교체-2곳.json','utf8'));
for (const item of finalFood.candidates) {
  ratingMap.set(item.name,{score:item.rating.score,reviewCount:item.rating.reviewCount,url:item.mapUrl});
}
const replacementFood = JSON.parse(fs.readFileSync(root+'평점4이상-음식점-저평점교체-승격후보.json','utf8'));
for (const item of replacementFood.candidates.slice(0,15)) {
  ratingMap.set(item.name,{score:item.rating.score,reviewCount:item.rating.reviewCount,url:item.mapUrl});
}
const existing = new Set(data.places.map(place => place.name.replaceAll(/\s/g,'')));
const excluded = new Set([
  ...replacedLowRated,
  '강릉 길감자', // 자료 간 주소 충돌
  '동녘댁', '옛 태광식당', // 후보 문서도 주소·운영시간 추가 확인 요구
  '안목바다식당', // 이전 주소와 상호의 권역 불일치
  '강릉오징어순대', // 같은 시장의 점포와 상호 구별 미확인
  '중화짬뽕빵', // 휴무 충돌과 점포 구별 재확인 필요
  '장미경양식', // 기존 장미경양식 강릉중앙시장점과 같은 주소의 동일 점포
  '중앙닭강정', // 기존 놀랄호떡군만두와 동일 주소여서 독립 점포 구별 미확인
  '소담낙지', // 최근 운영 중인지 자료가 충돌하여 보류
  '강릉 해운정','강릉향교','강릉 굴산사지' // 관람 접근·개방 시각 확인 전 보류
]);
const accepted = [];
const skipped = [];
let nextId = Math.max(...data.places.map(place => Number(place.id.slice(1)))) + 1;

function sourceOf(value) {
  return Array.isArray(value) ? value.find(item => typeof item === 'string' && item.startsWith('https://')) : value;
}
function menuOf(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === 'string') {
      const match = item.match(/^(.*?)[\s:·-]*(\d[\d,]*(?:\s*[~～-]\s*\d[\d,]*)?\s*원.*)$/);
      return match ? {label:match[1].trim(),price:match[2].trim()} : null;
    }
    if (!item || typeof item !== 'object') return null;
    const label = item.label || item.name;
    const price = item.price || (Number.isFinite(item.priceKRW) ? `${item.priceKRW.toLocaleString('ko-KR')}원` : null);
    return label && price ? {label,price} : null;
  }).filter(item => item?.label && item?.price);
}

for (const file of files) {
  if (!fs.existsSync(root+file)) continue;
  const research = JSON.parse(fs.readFileSync(root+file,'utf8'));
  const candidates = file === '평점4이상-시장먹거리-추가조사.json'
    ? research.candidates.map(raw => ({
      name:raw.name, category:'market',
      locationText:`${raw.area}, ${raw.address}`,
      scheduleText:raw.hours || '카카오맵에 영업시간 미등록',
      closureText:raw.closure || '정기휴무 확인되지 않음',
      description:`${raw.area}에서 ${raw.menu[0]?.name || '간식'}을 판매하는 점포.`,
      menuItems:raw.menu.filter(menu => Number.isFinite(menu.priceKRW)).map(menu => ({name:menu.name,priceKRW:menu.priceKRW})),
      source:[raw.kakao.url,...raw.priceSources,...raw.otherSources],
      priceSource:raw.priceSources[0] || raw.kakao.url,
      scheduleSource:raw.hours?.includes('카카오맵') || raw.closure?.includes('카카오맵') ? raw.kakao.url : (raw.priceSources[0] || raw.kakao.url),
      uncertainty:raw.uncertainty
    }))
    : ['평점4이상-음식점-추가조사.json','평점4이상-음식점-후속승격.json','평점4이상-음식점-추가교체-2곳.json','평점4이상-음식점-저평점교체-승격후보.json'].includes(file)
      ? (file === '평점4이상-음식점-후속승격.json' ? research.promoted : file === '평점4이상-음식점-저평점교체-승격후보.json' ? research.candidates.slice(0,15) : research.candidates).map(raw => ({
        name:raw.name, category:raw.category, locationText:raw.locationText,
        scheduleText:raw.scheduleText || '카카오맵에 영업시간 미등록',
        closureText:raw.closureText || '정기휴무 확인되지 않음',
        description:`${raw.mapCategory || '음식점'}에서 ${raw.menuItems?.[0]?.name || '식사 메뉴'}를 제공하는 강릉 점포.`,
        menuItems:raw.menuItems || [],
        source:[raw.mapUrl,...(raw.snsLinks || [])],
        priceSource:raw.priceSource || raw.mapUrl,
        scheduleSource:raw.mapUrl,
        uncertainty:raw.uncertainty || '영업·가격은 방문 전 확인 필요'
      }))
      : research.candidates || [];
  for (const item of candidates) {
    const key = item.name?.replaceAll(/\s/g,'');
    const source = sourceOf(item.source);
    if (!key || existing.has(key) || excluded.has(item.name) || !source?.startsWith('https://') || !item.locationText || !item.scheduleText || !item.closureText || !item.description) {
      if (!existing.has(key)) skipped.push(`${item.name || '(unnamed)'}: excluded or incomplete`);
      continue;
    }
    if (data.places.length >= 300) {
      skipped.push(`${item.name}: 300-place cap`);
      continue;
    }
    const menuItems = menuOf(item.menuItems);
    const place = {
      id:`g${nextId++}`, name:item.name, category:item.category,
      lat:null, lon:null, unrestrictedAccess:false,
      locationText:item.locationText, source,
      description:item.description,
      scheduleText:item.scheduleText,
      closureText:item.closureText,
      scheduleSource:item.scheduleSource || source,
      ...(Array.isArray(item.source) && item.source.length > 1 ? {researchSources:item.source} : {}),
      ...(item.access ? {accessText:item.access} : {}),
      ...(item.uncertainty ? {researchCaveat:item.uncertainty} : {})
    };
    if (menuItems.length) {
      const priceSource = sourceOf(item.priceSource) || source;
      place.menuItems = menuItems;
      place.priceInfo = {label:menuItems[0].label,price:menuItems[0].price,source:priceSource,checked:'2026-10-06',note:'조사 자료에 게시된 가격. 주문·방문 전 현행 가격 확인'};
    } else if (typeof item.priceInfo === 'string' && /(무료|\d[\d,]*\s*원)/.test(item.priceInfo)) {
      place.priceInfo = {label:'입장·이용',price:item.priceInfo,source,checked:'2026-10-06',note:'프로그램·할인·시기별 변동 가능'};
    }
    const rating = ratingMap.get(item.name);
    if (rating) place.mapRating = {score:rating.score,reviewCount:rating.reviewCount,source:rating.url,checked:'2026-10-06'};
    data.places.push(place);
    existing.add(key);
    accepted.push(`${place.id} ${place.name}`);
  }
}

for (const place of data.places) {
  const rating = ratingMap.get(place.name);
  if (rating) place.mapRating = {score:rating.score,reviewCount:rating.reviewCount,source:rating.url,checked:'2026-10-06'};
  if (Number(place.id.slice(1)) <= 56) continue;
  const sources = new Set(place.researchSources || []);
  for (const field of ['scheduleText','closureText','researchCaveat']) {
    if (typeof place[field] !== 'string') continue;
    const links = place[field].match(/https?:\/\/[^\s,;]+/g) || [];
    links.forEach(link => sources.add(link));
    place[field] = place[field].replace(/https?:\/\/[^\s,;]+/g,'').replace(/\s{2,}/g,' ').replace(/[:;,\s]+$/,'').trim();
    if (field === 'scheduleText' && links.length) place.scheduleSource = links[0];
  }
  if (typeof place.priceInfo?.price === 'string') {
    const links = place.priceInfo.price.match(/https?:\/\/[^\s,;]+/g) || [];
    links.forEach(link => sources.add(link));
    place.priceInfo.price = place.priceInfo.price.replace(/https?:\/\/[^\s,;]+/g,'').replace(/\s{2,}/g,' ').replace(/[:;,\s]+$/,'').trim();
    if (links.length && links[0] !== place.priceInfo.source) place.priceInfo.comparisonSource = links[0];
  }
  if (sources.size) place.researchSources = [...sources];
}
// 가격 필드에는 출처 링크나 여러 상품의 긴 설명을 넣지 않는다.
// 전체 요금·추가 조건은 방문 안내에 남기고 대표 가격만 구조화한다.
const priceOverrides = {
  '강릉시청소년해양수련원 해양레포츠': {label:'SUP 강습·대여',price:'35,000원'},
  '브라보서프 금진점': {label:'입문 강습 예약가',price:'55,000원'},
  '정동진 썬크루즈 요트투어': {label:'요트투어 1인',price:'20,000원'},
  '강릉자수박물관': {label:'성인 관람',price:'6,000원'},
  '처음처럼&새로 브랜드 체험관': {label:'성인 투어 정가',price:'15,000원'},
  '런닝맨 강릉점': {label:'60분 정가',price:'19,000원'},
  '리고엠 퀼트 공방': {label:'크로스백 만들기',price:'70,000원'},
  '김동명문학관': {label:'입장',price:'무료'}
};
for (const place of data.places) {
  const override = priceOverrides[place.name];
  if (override && place.priceInfo) Object.assign(place.priceInfo,override);
  if (['경포플라워가든','국립대관령자연휴양림','강릉 모래내 한과마을 체험전시관','강릉 남산공원'].includes(place.name)) delete place.priceInfo;
  if (place.name === '강릉자수박물관') place.researchCaveat = '운영사 직접 안내와 방문일 개관은 확인하지 못했다. 한국관광공사 시설 기록과 공공데이터의 주소·요금을 대조했다.';
  if (place.name === '국립대관령자연휴양림') place.researchCaveat = '휴양림별 일일 입장료는 최종 확인이 필요하다. 목공예 체험은 운영사 프로그램 안내에 1시간 10,000원, 3~11월·화요일 제외로 표시된다.';
  if (place.name === '강릉이래요') {
    place.priceInfo = {label:'수제 꿀감자빵 1개',price:'3,500원',source:'https://place.map.kakao.com/1004538025',checked:'2026-10-06',note:'카카오맵 메뉴 표시. 주문·방문 전 현행 가격 확인'};
  }
  if (place.name === '삼양닭집') {
    place.menuItems = [
      {label:'오륜미쌀닭강정',price:'22,000~24,000원'},
      {label:'오륜미 후라이드',price:'20,000~22,000원'},
      {label:'매콤후라이드',price:'20,000~22,000원'},
      {label:'옛날통닭',price:'18,000·20,000·22,000원'}
    ];
    place.priceInfo = {label:'오륜미쌀닭강정',price:'22,000~24,000원',source:'https://place.map.kakao.com/9094999',checked:'2026-10-06',note:'카카오맵의 가격 범위. 크기별 구분은 확인되지 않음'};
  }
  if (place.name === '강릉감자빵') delete place.priceInfo; // 대표 상품 감자빵 가격 미확인, 커피값을 대표가로 표시하지 않음
  if (place.id === 'g174') place.researchCaveat = '카카오맵은 중앙시장 지하동 65호, 기존 조사 출처는 49호로 점포 호수가 충돌한다. 정확한 방문 위치 확인 전 지도 핀·자동 코스에서 제외한다. 휴무 표기도 출처 안에서 상충한다.';
  if (place.id === 'g233') place.researchCaveat = '카카오맵은 금성로13번길 12-1, 기존 조사 출처는 12로 주소가 충돌한다. 정확한 방문 위치 확인 전 지도 핀·자동 코스에서 제외한다. 부정기 휴무 가능.';
  if (place.id === 'g40') place.researchCaveat = '기존 조사 출처는 2층, 카카오맵 같은 상호는 1층으로 표시돼 동일 점포인지 확인되지 않았다. 카카오 점수는 이 항목에 연결하지 않았다.';
  if (place.id === 'g65') place.researchCaveat = '카카오맵에서 해당 상호를 직접 찾지 못했고 같은 주소의 다른 순두부점이 표시된다. 기존 조사 출처의 운영 여부를 방문 전 확인해야 한다.';
  if (place.id === 'g171') place.researchCaveat = '카카오맵에서 정확한 상호·주소가 일치하는 독립 장소 결과를 확인하지 못했다. 운영 여부와 위치 재확인 필요.';
  if (place.id === 'g186') place.researchCaveat = '카카오맵에서 같은 도로명 주소에 다른 업장도 표시된다. 점포 출입 위치와 운영 정보를 방문 전 확인.';
  if (place.id === 'g241') place.researchCaveat = '카카오맵에서 같은 도로명 주소에 다른 업장도 표시된다. 점포 출입 위치와 운영 정보를 방문 전 확인.';
}
data.updated = '2026-10-06';
data.note = '강릉 장소 후보를 최대 300곳 범위에서 조사 중. 실제 등재 장소는 주소·방문정보 출처 확인 뒤 추가하며, 현장 영업·요금과 일부 지도 위치·사진은 재확인이 필요하다. 지도앱 평점 4.0 이상을 우선 확인하지만 등재의 유일한 조건은 아니다. 좌표가 없는 장소는 지도·자동 코스에서 제외된다.';
fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
console.log(`Added ${accepted.length}: ${accepted.join(' | ')}`);
console.log(`Skipped ${skipped.length}: ${skipped.join(' | ')}`);
console.log(`Total ${data.places.length}`);
