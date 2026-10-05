/* 장소 그림은 places.json 재생성과 독립적으로 관리합니다.
 * 키: places.json의 정확한 장소 id.
 * 값: { src: './assets/places/파일.webp', alt: '그림 설명', kind: 'illustration' 또는 'photo', credit: '제작자/출처', source: 'https://출처' }
 * 등록 전에는 유형별 장식만 표시하며 실제 장소 사진으로 표현하지 않습니다.
 */
window.HANGEORUM_PLACE_MEDIA = {
  p1: {
    src: './assets/photos/yudalsan-panorama.jpg',
    alt: '유달산의 바위 능선과 산책길을 담은 실제 사진',
    kind: 'photo',
    credit: 'Matt872000 · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Yudalsan_20180415_171946.jpg'
  },
  p8: {
    src: './assets/photos/mokpo-history-1.jpg',
    alt: '목포근대역사관 1관의 붉은 벽돌 외관과 입구 계단',
    kind: 'photo',
    credit: 'Mobius6 · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Modern_History_Museum_(Building_1)_20241005_003.jpg'
  }
};
