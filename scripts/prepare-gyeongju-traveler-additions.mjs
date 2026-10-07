import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const folder = '한걸음/docs/지역/경주/';
const foods = read(folder + '여행객추천-음식점-추가데이터.json').eligible;
const cafes = read(folder + '여행객추천-카페-조사.json').verified;
const menu = [
  ['꼬막무침비빔밥 2인', '31,000원'], ['청도미나리육회비빔밥', '14,500원'],
  ['한우물회 보통', '14,000원'], ['육회비빔밥', '17,000원'], ['고마소바', '12,000원'],
  ['짬뽕', '12,000원'], ['손말이고기 기본', '16,500원'], ['돼지두루치기 소', '17,000원'],
  ['칼낙지 (2인 이상)', '13,000원'], ['늘곰탕', '13,000원'], ['물밀면+숯불', '8,500원'],
  ['뒷고기', '현행 가격 미확인'], ['한우구이', '부위·중량별 변동']
];
if (foods.length !== menu.length || cafes.length !== 25) throw Error('Review source changes need a new integration audit');
const expectedFoodNames = ['향화정','청온채','함양집 북군','소향몽','료미','남정부일기사식당','단향회','승진식당','신라제면','늘곰탕','경주밀면 본점','빼돌린숯불뒷고기','물천한우'];
if (foods.some((p,i) => p.name !== expectedFoodNames[i])) throw Error('Food/menu order needs review');
const rows = foods.map((p, i) => ({
  name:p.name, category:'food', lat:p.lat, lon:p.lng, locationText:p.address.replace(/^경상북도 /, ''),
  source:p.travelerSource, rating:p.rating, ratingCount:p.reviewCount, ratingSource:'Google 지도',
  ratingUrl:p.ratingUrl, ratingChecked:p.checkedAt, mapPinBasis:'Google 지도에 등록된 장소의 대표 위치',
  scheduleText:p.hours + (p.breakTime ? ` · 브레이크: ${p.breakTime}` : ''),
  closureText:p.closed, deadlineText:p.lastOrder || '마지막 주문 미확인.', scheduleSource:p.infoSource,
  description:`${p.travelerSummary} ${p.caveat || ''}`, researchOnly:true,
  reviewSources:[{url:p.travelerSource,date:p.posted,author:p.travelerAuthor,recommendation:p.travelerSummary,sponsorship:p.disclosure}],
  priceInfo:{label:menu[i][0],price:menu[i][1],source:p.infoSource,checked:p.checkedAt,note:`${p.priceGuide}. ${p.caveat || ''}`}
}));
for (const p of cafes) {
  const {photo, ...row} = p;
  const ratingUrl = p.ratingSource === 'Google 지도' && !p.ratingUrl.includes('/maps/place/')
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + p.locationText)}` : p.ratingUrl;
  const scheduleSource = p.scheduleSource || p.source;
  rows.push({...row, source:p.reviewSources[0].url,
    scheduleSource: scheduleSource.includes('google.com/maps/') ? ratingUrl : scheduleSource,
    ratingUrl,
    mapPinBasis:p.mapPinBasis?.includes('카카오') ? '카카오맵에 등록된 장소의 대표 위치' : 'Google 지도에 등록된 장소의 대표 위치', researchOnly:true});
}
const schumann = rows.find(p => p.name === '슈만과클라라 본점');
schumann.priceInfo = {label:'케냐 핸드드립 HOT',price:'9,000원',source:'https://place.map.kakao.com/7967241',checked:'2026-10-06',note:'카카오맵 등록 메뉴. 에이징 탄자니아 HOT 10,000원·ICE 11,000원, 아이스 핸드드립 9,000원. 원두별 가격 확인.'};
const venzamas = rows.find(p => p.name === '벤자마스');
venzamas.priceInfo = {label:'아메리카노 HOT',price:'5,000원',source:'https://place.map.kakao.com/21655553',checked:'2026-10-06',note:'카카오맵 등록 메뉴. 디카페인 아메리카노 HOT 5,500원. 동명 건물별 메뉴·가격은 현장 확인.'};
for (const [name, condition] of [
  ['향화정','꼬막무침비빔밥은 2인 구성 메뉴. 혼자 주문 가능한지와 다른 단품의 1인 조건은 확인되지 않았습니다.'],
  ['신라제면','칼낙지·칼낙새는 2인 이상 주문 안내. 바지락칼국수의 혼자 주문 가능 여부는 별도 확인.'],
  ['료미','2인 세트가 있으나 고마소바·후토마키 단품도 등록. 혼자 주문 가능한지와 좌석 배정은 확인되지 않았습니다.']
]) {
  const p = rows.find(p => p.name === name);
  p.minimumOrder = condition;
  p.minimumOrderSource = p.priceInfo.source;
}
rows.forEach((p, i) => { p.id = `j${139 + i}`; });
for (const p of rows) {
  if (!p.locationText.startsWith('경주시 ') || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || p.rating < 4 || !p.reviewSources[0].url) throw Error(`Invalid source row ${p.name}`);
}
fs.writeFileSync('scripts/gyeongju-traveler-additions.json', JSON.stringify(rows, null, 2) + '\n');
const actual = {
  '향화정':{file:'gyeongju-hyanghwajeong-blog.jpg',alt:'향화정에서 촬영된 실제 꼬막비빔밥 사진(2022년). 현재 메뉴 모습은 달라질 수 있습니다.',credit:'its-memory · CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',source:'https://its-memory.tistory.com/16'},
  '료미':{file:'gyeongju-ryomi-blog.jpg',alt:'료미에서 촬영된 실제 고마소바 사진(2022년). 현재 메뉴 모습은 달라질 수 있습니다.',credit:'지리오타쿠 · CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',source:'https://teacherso.tistory.com/841'},
  '아레나피나':{file:'gyeongju-arenapina-official.jpg',alt:'아레나피나의 실제 바다 전망 테라스 사진(경주시 2025년 관광 자료)',credit:'경주시청 · 공공누리 제1유형',licenseUrl:'https://www.kogl.or.kr/info/license.do',source:'https://www.gyeongju.go.kr/tour_bak/page.do?mnu_uid=4121'},
  '바이닐바이브':{file:'gyeongju-vinylvibe-official.jpg',alt:'바이닐바이브의 실제 턴테이블과 음료 사진(경주시 2026년 관광 자료)',credit:'경주시청 · 공공누리 제1유형',licenseUrl:'https://www.kogl.or.kr/info/license.do',source:'https://www.gyeongju.go.kr/tour_bak/page.do?mnu_uid=4186'}
};
let media = '\n/* 여행객 추천 추가 사진: prepare-gyeongju-traveler-additions.mjs에서 생성 */\n';
for (const p of rows) {
  if (actual[p.name]) {
    const {file, ...info} = actual[p.name];
    if (!fs.existsSync('public/assets/photos/' + file)) throw Error(`Missing actual photo ${file}`);
    media += `window.HANGEORUM_PLACE_MEDIA.${p.id} = ${JSON.stringify({src:'./assets/photos/'+file,kind:'photo',...info})};\n`;
  } else {
    const kind = p.category === 'cafe' ? 'cafe' : /밀면|제면/.test(p.name) ? 'noodle' : /뒷고기|한우|승진|단향회/.test(p.name) ? 'food' : p.name === '료미' ? 'noodle' : 'food';
    media += `gyeongjuExamples.${p.id} = {...researchExampleBase.${kind},kind:'example',alt:${JSON.stringify(`${p.category === 'cafe' ? '카페' : '음식'} 주제 예시 사진. ${p.name}의 실제 공간이나 메뉴 사진은 아닙니다.`)}};\n`;
  }
}
const marker = '\n/* 여행객 추천 추가 사진:';
const mediaPath = 'public/gyeongju-media.js';
fs.writeFileSync(mediaPath, fs.readFileSync(mediaPath,'utf8').split(marker)[0] + media);
console.log(`Prepared ${foods.length} food + ${cafes.length} cafe additions; 4 actual photos + ${rows.length - 4} labeled examples.`);
