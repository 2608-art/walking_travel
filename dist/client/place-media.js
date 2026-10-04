/* 장소 그림은 places.json 재생성과 독립적으로 관리합니다.
 * 키: places.json의 정확한 장소 id.
 * 값: { src: './assets/places/파일.webp', alt: '그림 설명', kind: 'illustration' 또는 'photo', credit: '제작자/출처', source: 'https://출처' }
 * 등록 전에는 유형별 장식만 표시하며 실제 장소 사진으로 표현하지 않습니다.
 */
window.HANGEORUM_PLACE_MEDIA = {};
