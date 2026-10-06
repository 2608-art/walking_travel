import fs from 'node:fs';

const places = JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places;
const actual = {
  '사근진해변': {src:'./assets/photos/gangneung-sageunjin-beach.jpg',alt:'2016년에 촬영한 강릉 사근진해변의 실제 사진',kind:'photo',credit:'최광모 · CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'https://commons.wikimedia.org/wiki/File:2016%EB%85%84_5%EC%9B%94_28%EC%9D%BC_%EA%B0%95%EC%9B%90%EB%8F%84_%EA%B0%95%EB%A6%89%EC%8B%9C_%EC%82%AC%EA%B7%BC%EC%A7%84%ED%95%B4%EB%B3%80_DSC01265.jpg'},
  '사천진해변': {src:'./assets/photos/gangneung-sacheonjin-beach.jpg',alt:'2016년에 촬영한 강릉 사천진해변의 실제 사진',kind:'photo',credit:'최광모 · CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'https://commons.wikimedia.org/wiki/File:%EA%B0%95%EB%A6%89%EC%8B%9C_%EC%82%AC%EC%B2%9C%EC%A7%84%ED%95%B4%EB%B3%80_2016-08-11_13.43.05.jpg'},
  '강릉솔향수목원': {src:'./assets/photos/gangneung-solhyang-arboretum.jpg',alt:'2016년에 촬영한 강릉솔향수목원의 실제 사진',kind:'photo',credit:'최광모 · CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'https://commons.wikimedia.org/wiki/File:2016%EB%85%84_5%EC%9B%94_22%EC%9D%BC_%EA%B0%95%EC%9B%90%EB%8F%84_%EA%B0%95%EB%A6%89%EC%8B%9C_%EC%86%94%ED%96%A5%EC%88%98%EB%AA%A9%EC%9B%90_DSC00629.jpg'},
  '영진해변': {src:'./assets/photos/gangneung-yeongjin-beach.jpg',alt:'2016년에 촬영한 강릉 영진해변의 실제 사진',kind:'photo',credit:'최광모 · CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'https://commons.wikimedia.org/wiki/File:%EA%B0%95%EB%A6%89%EC%8B%9C_%EC%98%81%EC%A7%84%ED%95%B4%EB%B3%80_2016-08-15_19.50.17.jpg'},
  '등명낙가사': {src:'./assets/photos/gangneung-deungmyeongnakgasa.jpg',alt:'2007년에 촬영한 등명낙가사 영산전 내부의 불상과 청자 오백나한상',kind:'photo',credit:'parhessiastes · CC BY-SA 2.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/2.0/',source:'https://commons.wikimedia.org/wiki/File:Korea-Gangneung-Deungmyeongnakgasa-Gilt_Buddha_and_500_celadon_arahant_statues-01.jpg'},
  '주문진해변': {src:'./assets/photos/gangneung-jumunjin-beach.jpg',alt:'2022년에 촬영한 강릉 주문진해변의 실제 사진',kind:'photo',credit:'Mobius6 · CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',source:'https://commons.wikimedia.org/wiki/File:Jumunjin_Beach_20220501_034.jpg'},
  '정동진해변': {src:'./assets/photos/gangneung-jeongdongjin-beach.jpg',alt:'2008년에 촬영한 강릉 정동진해변의 실제 사진',kind:'photo',credit:'Loewelad · CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',source:'https://commons.wikimedia.org/wiki/File:Jeongdongjin_Beach.jpg'}
};

function exampleFor(place) {
  const n = place.name;
  if (place.category === 'outdoors') return /거리|골목/.test(n) ? ['g3','강릉 원도심 거리'] : /해변|항|바위|해안|모래시계|썬크루즈/.test(n) ? ['g4','강릉의 해변'] : /숲|수목원|휴양림|옛길|모정탑/.test(n) ? ['g14','강릉의 솔숲'] : ['g20','경포권 습지와 산책'];
  if (place.category === 'food') return /순두부|두부/.test(n) ? ['g29','순두부 음식'] : /칼국수|국수|막국수|짬뽕/.test(n) ? ['g28','국수 음식'] : /돈가스|경양식/.test(n) ? ['g26','한국식 돈가스 음식'] : ['g33','음식점 주방'];
  if (place.category === 'cafe') return /빵|베이커리|제과/.test(n) ? ['g44','빵'] : ['g43','카페 공간'];
  if (place.category === 'market') return /빵|도넛|과자|제과|베이크/.test(n) ? ['g44','빵'] : /고로케|튀김|닭강정/.test(n) ? ['g51','간식'] : /금성로|중앙시장/.test(place.locationText || '') ? ['g1','강릉중앙시장 통로'] : ['g2','시장 풍경'];
  if (place.category === 'books') return /도자기|소품|편집샵|망치/.test(n) ? ['g56','수공예 소품'] : ['g53','책과 문구'];
  if (place.category === 'experience') return /서프|서핑|해양|요트/.test(n) ? ['g4','강릉의 해변'] : /레일|바이크/.test(n) ? ['g14','해안가 산책'] : /퀼트|공방/.test(n) ? ['g56','수공예 재료'] : /한과/.test(n) ? ['g44','간식'] : /브랜드|체험관/.test(n) ? ['g19','실내 전시 공간'] : ['g47','가상 체험'];
  return /미술|미디어|포레스트/.test(n) ? ['g45','미디어아트'] : ['g19','전시 공간'];
}

const real = {};
const examples = [];
for (const place of places) {
  if (Number(place.id.slice(1)) <= 56) continue;
  if (actual[place.name]) real[place.id] = actual[place.name];
  else examples.push([place.id,place.name,...exampleFor(place)]);
}
const code = `/* 조사 확대 장소 사진. 실제 장소 사진만 photo, 나머지는 출처를 밝힌 주제 예시입니다. */\n`+
  `Object.assign(window.HANGEORUM_PLACE_MEDIA, ${JSON.stringify(real,null,2)});\n`+
  `for (const [id,name,reference,subject] of ${JSON.stringify(examples,null,2)}) {\n`+
  `  const base = window.HANGEORUM_PLACE_MEDIA[reference] || window.HANGEORUM_PLACE_EXAMPLE_MEDIA[reference];\n`+
  `  if (!base) throw Error('Missing Gangneung example reference: ' + reference);\n`+
  `  window.HANGEORUM_PLACE_EXAMPLE_MEDIA[id] = {...base,kind:'example',alt:subject + ' 예시 사진. ' + name + '의 실제 모습이나 상품은 아닙니다.'};\n`+
  `}\n`;
fs.writeFileSync('public/gangneung-media-expansion.js',code);
console.log(`Gangneung expansion media: ${Object.keys(real).length} actual, ${examples.length} labeled examples`);
