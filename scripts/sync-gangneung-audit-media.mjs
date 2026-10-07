import fs from 'node:fs';

const places = JSON.parse(fs.readFileSync('public/gangneung-places.json','utf8')).places;
const auditedFood = places.filter(place => Number(place.id.slice(1)) >= 267 && ['food','market'].includes(place.category));
const lines = [
  '/* 카카오맵 음식점 재조사: 실제 점포 사진 사용권을 확인하지 못해 주제 예시로 표시. */',
  "for (const id of ['g42','g51','g52','g61','g67','g68','g76','g77','g78','g80','g86','g89','g90','g140','g142','g165','g166','g167','g172','g179','g182','g184','g185','g229','g232','g237','g239','g240','g246']) {",
  '  delete window.HANGEORUM_PLACE_MEDIA[id];',
  '  delete window.HANGEORUM_PLACE_EXAMPLE_MEDIA[id];',
  '}',
  'for (const [id,name,reference,subject] of '+JSON.stringify(auditedFood.map(place => {
    const menu = (place.menuItems || []).map(item => item.label).join(' ');
    const reference = /닭강정|후라이드/.test(menu) ? 'g257' : /순두부|두부/.test(menu) ? 'g29' : /장칼국수|막국수|옹심이|국수/.test(menu) ? 'g28' : 'g33';
    const subject = reference === 'g257' ? '닭강정' : reference === 'g29' ? '순두부 음식' : reference === 'g28' ? '국수 음식' : '음식점 주방';
    return [place.id,place.name,reference,subject];
  }),null,2)+') {',
  '  const base = window.HANGEORUM_PLACE_MEDIA[reference] || window.HANGEORUM_PLACE_EXAMPLE_MEDIA[reference];',
  "  if (!base) throw Error('Missing Gangneung example reference: ' + reference);",
  "  window.HANGEORUM_PLACE_EXAMPLE_MEDIA[id] = {...base,kind:'example',alt:subject + ' 예시 사진. ' + name + '의 실제 모습이나 상품은 아닙니다.'};",
  '}',
  ''
];
fs.writeFileSync('public/gangneung-media-audit.js',lines.join('\n'));
console.log(`Prepared ${auditedFood.length} labeled food examples.`);
