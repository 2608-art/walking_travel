/* 지역별 화면·자료 설정. 장소와 경로 근거는 각 지역 파일에서 따로 관리한다. */
window.HangeoreumRegions = Object.freeze({
  mokpo: Object.freeze({
    id: 'mokpo', name: '목포', province: '전라남도', ready: true, center: [34.7913, 126.3854],
    station: {id: 'station', name: '목포역', lat: 34.7914, lon: 126.3859},
    image: './mokpo-card.webp', imageAlt: '목포의 바다와 항구, 유달산을 그린 여행 일러스트',
    imageLabel: '목포 풍경 일러스트', teaser: '유달산과 바다가 만나는 항구 도시',
    description: '유달산과 항구가 어우러진 목포. 근대역사거리와 해상케이블카가 기다려요.',
    introTitle: '천천히 만나는 항구 도시', introLine: '골목을 지나, 바다 곁으로.',
    tags: ['바다', '역사·골목', '뚜벅이 여행'], placesFile: './places.json?v=11',
    lodgingsFile: './lodgings.json?v=1', featuredIds: ['p1','p8','p10','p12'],
    themeCount: 6, dataChecked: '2026-10-01'
  }),
  gangneung: Object.freeze({
    id: 'gangneung', name: '강릉', province: '강원특별자치도', ready: false, center: [37.786, 128.909],
    station: {id: 'gangneung-station', name: '강릉역 1번 출구', lat: 37.7641331, lon: 128.8997106,
      pinBasis: '카카오 장소검색의 강릉역 1번 출구 지점', pinSource: 'https://mokpo-day-planner.sooyeon-jun-0389.chatgpt.site/api/place-search?q=%EA%B0%95%EB%A6%89%EC%97%AD%201%EB%B2%88%20%EC%B6%9C%EA%B5%AC'},
    image: './gangneung-card.png', imageAlt: '경포대와 경포호, 검은 대나무와 동해, 안목 커피거리를 함께 그린 강릉 상징 일러스트',
    imageLabel: '강릉 상징 일러스트', teaser: '호수와 바다, 시장을 잇는 강릉',
    description: '강릉역에서 시장 골목과 동해 바다로. 오죽헌·선교장의 역사도 천천히 만나요.',
    introTitle: '바다와 골목을 걷는 강릉', introLine: '시장 길을 지나, 동해 곁으로.',
    tags: ['바다·커피', '시장·골목', '뚜벅이 여행'], placesFile: './gangneung-places.json?v=7',
    lodgingsFile: null, featuredIds: ['g1','g3','g4','g9'], themeCount: 5, dataChecked: '2026-10-06'
  }),
  gyeongju: Object.freeze({
    id: 'gyeongju', name: '경주', province: '경상북도', ready: false, center: [35.84, 129.22],
    station: {id:'gyeongju-station',name:'경주역',lat:35.7983772522824,lon:129.138999419567},
    image: './gyeongju-card.png', imageAlt: '경주의 역사 유적과 동궁과 월지 풍경을 그린 상징 일러스트',
    imageLabel: '경주 상징 일러스트', teaser: '천년의 유적과 동네 골목을 잇는 경주',
    description: '황리단길과 왕경 유적, 보문과 동해안까지 권역마다 다른 풍경을 만나요.',
    introTitle: '천천히 걷는 신라의 시간', introLine: '골목과 유적, 가까운 풍경부터. ',
    tags: ['왕경 유적', '골목·시장', '동해안'], placesFile: './gyeongju-places.json?v=1',
    lodgingsFile: './gyeongju-lodgings.json?v=1', featuredIds: ['j3','j1','j2','j17'], themeCount: 8, dataChecked: '2026-10-06'
  })
});
