/* 장소 그림은 places.json 재생성과 독립적으로 관리합니다.
 * 키: places.json의 정확한 장소 id.
 * 값: { src: './assets/photos/파일.webp', alt: '사진 설명', kind: 'photo' 또는 'example', credit: '제작자/라이선스', source: 'https://출처' }
 * 실제 장소 사진이 없으면 아래 장소별 고유 예시 사진을 표시하고 실제 모습이 아님을 밝힙니다.
 */
window.HANGEORUM_PLACE_MEDIA = {
  p1: {
    src: './assets/photos/yudalsan-panorama.jpg',
    alt: '유달산의 바위 능선과 산책길을 담은 실제 사진',
    kind: 'photo',
    credit: 'Matt872000 · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Yudalsan_20180415_171946.jpg'
  },
  p2: {
    src: './assets/photos/nojeokbong.webp',
    alt: '목포 유달산 노적봉의 바위와 주변 길',
    kind: 'photo',
    credit: 'Mar del Este · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Yudalsan_Mokpo_Nojeokbong_peak.jpg'
  },
  p3: {
    src: './assets/photos/mokpo-cable-car.webp',
    alt: '목포해상케이블카 북항승강장 건물과 케이블카 시설',
    kind: 'photo',
    credit: '한국관광공사 · 공공누리 제1유형',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Marine_Cable_Car_in_South_Korea_01.jpg'
  },
  p7: {
    src: './assets/photos/gatbawi.webp',
    alt: '목포 갓바위의 두 바위와 바닷가',
    kind: 'photo',
    credit: 'Steve46814 · CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Korea-Mokpo_Gatbawi_11-01716.JPG'
  },
  p8: {
    src: './assets/photos/mokpo-history-1.jpg',
    alt: '목포근대역사관 1관의 붉은 벽돌 외관과 입구 계단',
    kind: 'photo',
    credit: 'Mobius6 · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Modern_History_Museum_(Building_1)_20241005_003.jpg'
  },
  p9: {
    src: './assets/photos/mokpo-history-2.webp',
    alt: '목포근대역사관 2관 내부에 전시된 자료',
    kind: 'photo',
    credit: 'Mobius6 · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Modern_History_Museum_(Building_2)_20241005_007.jpg'
  },
  p14: {
    src: './assets/photos/peace-plaza.webp',
    alt: '목포 평화광장의 바다 쪽 산책로',
    kind: 'photo',
    credit: 'Mar del Este · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_South_Korea_Peace_Plaza_coast_side.jpg'
  },
  p15: {
    src: './assets/photos/music-fountain.webp',
    alt: '밤에 조명이 켜진 목포 춤추는 바다분수',
    kind: 'photo',
    credit: 'Mar del Este · CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Music_Fountain.jpg'
  },
  p16: {
    src: './assets/photos/natural-history-museum.webp',
    alt: '목포자연사박물관 외관과 앞뜰',
    kind: 'photo',
    credit: 'S Shamima Nasrin · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Natural_history_Museum.jpg'
  },
  p30: {
    src: './assets/photos/kim-daejung-memorial.webp',
    alt: '김대중노벨평화상기념관 내부의 전시 벽면',
    kind: 'photo',
    credit: 'Mar del Este · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Kim_Dae-jung_Nobel_Prize_Memorial_Hall3.jpg'
  },
  p32: {
    src: './assets/photos/childrens-marine-museum.webp',
    alt: '목포어린이바다과학관 건물 외관',
    kind: 'photo',
    credit: 'Mar del Este · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mokpo_Marine_Science_Museum_for_Children01.jpg'
  }
};

// 장소 자체의 사진이 확인되지 않은 119곳에 서로 다른 관련 주제 사진을 사용합니다.
window.HANGEORUM_PLACE_EXAMPLE_MEDIA = {
  "p4": {
    "src": "./assets/photos/p4-example.webp",
    "alt": "체험·해양 관련 주제 사진 예시. 목포해상케이블카 유달산승강장의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "한국관광공사 · 공공누리 제1유형",
    "source": "https://commons.wikimedia.org/wiki/File:Mokpo_Marine_Cable_Car_in_South_Korea_06.jpg"
  },
  "p5": {
    "src": "./assets/photos/p5-example.webp",
    "alt": "체험·해양 관련 주제 사진 예시. 목포해상케이블카 고하도승강장의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "한국관광공사 · 공공누리 제1유형",
    "source": "https://commons.wikimedia.org/wiki/File:Mokpo_Marine_Cable_Car_in_South_Korea_11.jpg"
  },
  "p6": {
    "src": "./assets/photos/p6-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 고하도 전망대·해안데크의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Mar del Este · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=42507969"
  },
  "p10": {
    "src": "./assets/photos/p10-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 서산동 시화골목의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=116761967"
  },
  "p11": {
    "src": "./assets/photos/p11-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 보리마당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=116761969"
  },
  "p12": {
    "src": "./assets/photos/p12-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 연희네슈퍼의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Myself · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=68072965"
  },
  "p13": {
    "src": "./assets/photos/p13-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 목포진 역사공원의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Mar del Este · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=42507970"
  },
  "p17": {
    "src": "./assets/photos/p17-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 성옥기념관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Michael Barera · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=40701702"
  },
  "p18": {
    "src": "./assets/photos/p18-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 유달산 조각공원의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=116761962"
  },
  "p19": {
    "src": "./assets/photos/p19-example.webp",
    "alt": "체험·해양 관련 주제 사진 예시. 목포스카이워크의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "bryan... · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=104712295"
  },
  "p20": {
    "src": "./assets/photos/p20-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 목포문예역사관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Christophe95 · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=99001021"
  },
  "p21": {
    "src": "./assets/photos/p21-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 목포생활도자박물관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Korea.net / Korean Culture and Information Service · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=33681641"
  },
  "p22": {
    "src": "./assets/photos/p22-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 목포대중음악의전당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Eggmoon · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=30235135"
  },
  "p23": {
    "src": "./assets/photos/p23-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 목포모자아트갤러리(옛 갑자옥모자점)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Michael Barera · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=40701680"
  },
  "p24": {
    "src": "./assets/photos/p24-example.webp",
    "alt": "체험·해양 관련 주제 사진 예시. 목포삼학도크루즈의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Negative Space · CC0 1.0",
    "source": "https://stocksnap.io/photo/sailbot-boat-80AGW3RWVH"
  },
  "p25": {
    "src": "./assets/photos/p25-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 수중유산박물관(옛 국립해양유물전시관)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Ethan Doyle White · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=90009105"
  },
  "p26": {
    "src": "./assets/photos/p26-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 삼학도 공원·이난영공원의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=18909129"
  },
  "p27": {
    "src": "./assets/photos/p27-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 외달도의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=18909140"
  },
  "p28": {
    "src": "./assets/photos/p28-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 달리도의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=18909073"
  },
  "p29": {
    "src": "./assets/photos/p29-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 노적봉예술공원미술관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by angela n. · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=3748439"
  },
  "p31": {
    "src": "./assets/photos/p31-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 소년 김대중 공부방의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=31325591"
  },
  "p33": {
    "src": "./assets/photos/p33-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 목포문학관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=31325617"
  },
  "p34": {
    "src": "./assets/photos/p34-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 국립호남권생물자원관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Jinah78 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=10314781"
  },
  "p35": {
    "src": "./assets/photos/p35-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 목포문화예술회관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "KOREA.NET - Official page of the Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=36228068"
  },
  "p36": {
    "src": "./assets/photos/p36-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 북항 노을공원의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Jasmin Causevic · CC0 1.0",
    "source": "https://stocksnap.io/photo/island-sunset-9QOAMHJ94O"
  },
  "p37": {
    "src": "./assets/photos/p37-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 유달유원지의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=18909082"
  },
  "p38": {
    "src": "./assets/photos/p38-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 양을산산림욕장의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=116761965"
  },
  "p39": {
    "src": "./assets/photos/p39-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 유달산 낙조대의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Anders Jildén · CC0 1.0",
    "source": "https://stocksnap.io/photo/island-water-16RCX69O4K"
  },
  "p40": {
    "src": "./assets/photos/p40-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 옥단이길의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=116761964"
  },
  "p41": {
    "src": "./assets/photos/p41-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 노라노미술관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "KOREA.NET - Official page of the Republic of Korea · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=36227851"
  },
  "p42": {
    "src": "./assets/photos/p42-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 남농기념관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Explicit · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=69388801"
  },
  "p43": {
    "src": "./assets/photos/p43-example.webp",
    "alt": "문화·전시 관련 주제 사진 예시. 옥공예전시관의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "pressapochista (a flickr user) · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=1164720"
  },
  "p44": {
    "src": "./assets/photos/p44-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 장좌도의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Lily Lvnatikk · CC0 1.0",
    "source": "https://stocksnap.io/photo/island-cliffs-0F3YO84EWE"
  },
  "p45": {
    "src": "./assets/photos/p45-example.webp",
    "alt": "풍경·산책 관련 주제 사진 예시. 율도(눌도)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Steve46814 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=18909095"
  },
  "p46": {
    "src": "./assets/photos/p46-example.webp",
    "alt": "음식 관련 주제 사진 예시. 영란횟집의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Mar del Este · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=42483125"
  },
  "p47": {
    "src": "./assets/photos/p47-example.webp",
    "alt": "음식 관련 주제 사진 예시. 초원음식점(초원식당)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "SEEMS to be at Flickr · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=9013869"
  },
  "p48": {
    "src": "./assets/photos/p48-example.webp",
    "alt": "음식 관련 주제 사진 예시. 장터식당 본점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "derivative work: Caspian blue (talk) Korean.cuisine-Ganjang_gejang_and_banchan-01.jpg: by LWY at flickr · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4726521"
  },
  "p49": {
    "src": "./assets/photos/p49-example.webp",
    "alt": "음식 관련 주제 사진 예시. 인동주마을의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "No machine-readable author provided. Warszk assumed (based on copyright claims). · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=117447"
  },
  "p50": {
    "src": "./assets/photos/p50-example.webp",
    "alt": "음식 관련 주제 사진 예시. 하당먹거리의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by aka_maya at Flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4599654"
  },
  "p51": {
    "src": "./assets/photos/p51-example.webp",
    "alt": "음식 관련 주제 사진 예시. 성식당(수강로 본점 후보)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "stu_spivack · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4126873"
  },
  "p52": {
    "src": "./assets/photos/p52-example.webp",
    "alt": "음식 관련 주제 사진 예시. 은빛바다회센터(율석수산)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Alex Knight · CC0 1.0",
    "source": "https://stocksnap.io/photo/seafood-octopus-43523WB3KI"
  },
  "p53": {
    "src": "./assets/photos/p53-example.webp",
    "alt": "음식 관련 주제 사진 예시. 연희네포차(항구포차 9호)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Michael Browning · CC0 1.0",
    "source": "https://stocksnap.io/photo/restaurant-kitchen-0HCMIT272C"
  },
  "p54": {
    "src": "./assets/photos/p54-example.webp",
    "alt": "음식 관련 주제 사진 예시. 목포관광오리탕(시내본점)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by DongSoo Kim (kdsoo) at Flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4688453"
  },
  "p55": {
    "src": "./assets/photos/p55-example.webp",
    "alt": "음식 관련 주제 사진 예시. 해빔의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by cube300 at Flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4689142"
  },
  "p56": {
    "src": "./assets/photos/p56-example.webp",
    "alt": "음식 관련 주제 사진 예시. 어락의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Tim Sullivan · CC0 1.0",
    "source": "https://stocksnap.io/photo/scallops-seafood-DBCBPQBRVV"
  },
  "p57": {
    "src": "./assets/photos/p57-example.webp",
    "alt": "음식 관련 주제 사진 예시. 대명춘의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Shene81 · CC BY 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=51995229"
  },
  "p58": {
    "src": "./assets/photos/p58-example.webp",
    "alt": "음식 관련 주제 사진 예시. 솜리치킨 목포점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Kjoonlee · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=175219804"
  },
  "p59": {
    "src": "./assets/photos/p59-example.webp",
    "alt": "음식 관련 주제 사진 예시. 카와루라멘의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Guilhem Vellut · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=83241683"
  },
  "p60": {
    "src": "./assets/photos/p60-example.webp",
    "alt": "음식 관련 주제 사진 예시. 너구리식당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "저작자 미상 · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=267250"
  },
  "p61": {
    "src": "./assets/photos/p61-example.webp",
    "alt": "음식 관련 주제 사진 예시. 유달콩물(호남로 본점)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "vedanti · CC0 1.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=54768085"
  },
  "p62": {
    "src": "./assets/photos/p62-example.webp",
    "alt": "음식 관련 주제 사진 예시. 소래기냉면의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Jinho Jung at Flickr from South Korea · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=9608841"
  },
  "p63": {
    "src": "./assets/photos/p63-example.webp",
    "alt": "음식 관련 주제 사진 예시. 김정림선지해장국의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "SJ Yang · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4762079"
  },
  "p64": {
    "src": "./assets/photos/p64-example.webp",
    "alt": "음식 관련 주제 사진 예시. 정성김밥의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "cutekirin · CC0 1.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=53812220"
  },
  "p65": {
    "src": "./assets/photos/p65-example.webp",
    "alt": "음식 관련 주제 사진 예시. 원조제일돌곱창의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Db9023 · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=32451483"
  },
  "p66": {
    "src": "./assets/photos/p66-example.webp",
    "alt": "음식 관련 주제 사진 예시. 야드레보쌈의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by ayustety (a flickr user) · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=1675563"
  },
  "p67": {
    "src": "./assets/photos/p67-example.webp",
    "alt": "음식 관련 주제 사진 예시. 왕새우직판장 본점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Paul Morris · CC0 1.0",
    "source": "https://stocksnap.io/photo/fish-seafood-8N1VN4U0HI"
  },
  "p68": {
    "src": "./assets/photos/p68-example.webp",
    "alt": "음식 관련 주제 사진 예시. 조선쫄복탕의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Matthew Hamilton · CC0 1.0",
    "source": "https://stocksnap.io/photo/food-soup-ZZ633JE9OT"
  },
  "p69": {
    "src": "./assets/photos/p69-example.webp",
    "alt": "음식 관련 주제 사진 예시. 춘광식당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Patryk Dziejma · CC0 1.0",
    "source": "https://stocksnap.io/photo/fryingpan-food-DFZV36VZW4"
  },
  "p70": {
    "src": "./assets/photos/p70-example.webp",
    "alt": "음식 관련 주제 사진 예시. 원조신선횟집의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Tim Sullivan · CC0 1.0",
    "source": "https://stocksnap.io/photo/seafood-dish-WRHZL4AVT0"
  },
  "p71": {
    "src": "./assets/photos/p71-example.webp",
    "alt": "음식 관련 주제 사진 예시. 관우식당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Mar del Este · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=42486178"
  },
  "p72": {
    "src": "./assets/photos/p72-example.webp",
    "alt": "음식 관련 주제 사진 예시. 미달이네집밥의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by 아침꿀물 at Flickr · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=8535444"
  },
  "p73": {
    "src": "./assets/photos/p73-example.webp",
    "alt": "음식 관련 주제 사진 예시. 서해반점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Scarlet Sappho · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=163018601"
  },
  "p74": {
    "src": "./assets/photos/p74-example.webp",
    "alt": "음식 관련 주제 사진 예시. 88포장마차(원형로)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Joanna Boj · CC0 1.0",
    "source": "https://stocksnap.io/photo/restaurant-kitchen-RE54D4GOX0"
  },
  "p75": {
    "src": "./assets/photos/p75-example.webp",
    "alt": "음식 관련 주제 사진 예시. 꼬미꼬미의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by shizu k (shezzz) at Flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4688926"
  },
  "p76": {
    "src": "./assets/photos/p76-example.webp",
    "alt": "음식 관련 주제 사진 예시. 용당반점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Tim Sullivan · CC0 1.0",
    "source": "https://stocksnap.io/photo/noodles-asian-XCRHPMMYTW"
  },
  "p77": {
    "src": "./assets/photos/p77-example.webp",
    "alt": "음식 관련 주제 사진 예시. 오두막집의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by magicinprogress at Flickr · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4601352"
  },
  "p78": {
    "src": "./assets/photos/p78-example.webp",
    "alt": "음식 관련 주제 사진 예시. 만났지식당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by Jinho Jung from South Korea · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=7760557"
  },
  "p79": {
    "src": "./assets/photos/p79-example.webp",
    "alt": "음식 관련 주제 사진 예시. 찬의여왕 식당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Clementina · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=11495155"
  },
  "p80": {
    "src": "./assets/photos/p80-example.webp",
    "alt": "음식 관련 주제 사진 예시. 어채의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Paul Morris · CC0 1.0",
    "source": "https://stocksnap.io/photo/fish-seafood-0JZI62MK8S"
  },
  "p81": {
    "src": "./assets/photos/p81-example.webp",
    "alt": "음식 관련 주제 사진 예시. 에스타시옹1913의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Serge Esteve · CC0 1.0",
    "source": "https://stocksnap.io/photo/restaurant-bar-P0B6LAPFPC"
  },
  "p82": {
    "src": "./assets/photos/p82-example.webp",
    "alt": "음식 관련 주제 사진 예시. 그때그짜장집의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by 아침꿀물 at Flickr · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=8535168"
  },
  "p83": {
    "src": "./assets/photos/p83-example.webp",
    "alt": "음식 관련 주제 사진 예시. 라멘집아저씨의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Kgw1226 · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=67662690"
  },
  "p84": {
    "src": "./assets/photos/p84-example.webp",
    "alt": "음식 관련 주제 사진 예시. 예향밥상의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "저작자 미상 · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=702785"
  },
  "p85": {
    "src": "./assets/photos/p85-example.webp",
    "alt": "음식 관련 주제 사진 예시. 금강뻘낙지장어요리전문점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by shizu k (shezzz) at Flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4688991"
  },
  "p86": {
    "src": "./assets/photos/p86-example.webp",
    "alt": "음식 관련 주제 사진 예시. 형제꼬막짬뽕의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Jungyeon · CC0 1.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=54768083"
  },
  "p87": {
    "src": "./assets/photos/p87-example.webp",
    "alt": "음식 관련 주제 사진 예시. 삼학만두의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Piotrus · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=90447109"
  },
  "p88": {
    "src": "./assets/photos/p88-example.webp",
    "alt": "음식 관련 주제 사진 예시. 압해도뻘낙지의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "L. W. Yang · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4224640"
  },
  "p89": {
    "src": "./assets/photos/p89-example.webp",
    "alt": "음식 관련 주제 사진 예시. 청호식당의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by Richy! at flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4558278"
  },
  "p90": {
    "src": "./assets/photos/p90-example.webp",
    "alt": "음식 관련 주제 사진 예시. 이가네고기국수의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "egg (Hong, Yun Seon) · CC BY 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4212821"
  },
  "p91": {
    "src": "./assets/photos/p91-example.webp",
    "alt": "음식 관련 주제 사진 예시. 구라파소년의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Skitter Photo · CC0 1.0",
    "source": "https://stocksnap.io/photo/restaurant-tavern-IWUAHEIBSE"
  },
  "p92": {
    "src": "./assets/photos/p92-example.webp",
    "alt": "음식 관련 주제 사진 예시. 트라이팟의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Popo le Chien · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=52276555"
  },
  "p93": {
    "src": "./assets/photos/p93-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 화신연쇄점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "fireskystudios.com · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-latte-LIB0TB3A8K"
  },
  "p94": {
    "src": "./assets/photos/p94-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 송자르트의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Nolan Issac · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-latte-RP0EJV51J6"
  },
  "p95": {
    "src": "./assets/photos/p95-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 유달동의로망스의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Jeff Sheldon · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-cafe-8C35014CE3"
  },
  "p96": {
    "src": "./assets/photos/p96-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 무가보의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Maciej Korsan · CC0 1.0",
    "source": "https://stocksnap.io/photo/cafe-coffee-TUIRU743JZ"
  },
  "p97": {
    "src": "./assets/photos/p97-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 달몬트의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Sergey Zolkin · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-latte-MK3VLNK8NA"
  },
  "p98": {
    "src": "./assets/photos/p98-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 쿠레레의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Daria Nepriakhina · CC0 1.0",
    "source": "https://stocksnap.io/photo/post-itnote-coffee-A78EC1EB73"
  },
  "p99": {
    "src": "./assets/photos/p99-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 석산(SUKSAN)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Lia Leslie · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-tea-4VHE7E68OE"
  },
  "p100": {
    "src": "./assets/photos/p100-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 오리진 커피 로스터스의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "David Bares · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-latte-WDJES619M1"
  },
  "p101": {
    "src": "./assets/photos/p101-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 커피창고로(평화광장점)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Chiara Pinna · CC0 1.0",
    "source": "https://stocksnap.io/photo/cafe-coffee-9QXZ4Q9PXX"
  },
  "p102": {
    "src": "./assets/photos/p102-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 혹호의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Negative Space · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-beans-X2JNLNHCT9"
  },
  "p103": {
    "src": "./assets/photos/p103-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 인스파이어링 커피의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Leeroy · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-cafe-ME0VNF7K74"
  },
  "p104": {
    "src": "./assets/photos/p104-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 아르볼의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Alex Holt · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-mug-M4PI6CXDDP"
  },
  "p105": {
    "src": "./assets/photos/p105-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 브릭레인의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "fireskystudios.com · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-beans-OTQJFKY0L7"
  },
  "p106": {
    "src": "./assets/photos/p106-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 더왈츠의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Blake Verdoorn · CC0 1.0",
    "source": "https://stocksnap.io/photo/espresso-coffee-RKVW9F72PL"
  },
  "p107": {
    "src": "./assets/photos/p107-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 산들소리찻집의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Hello Goodbye · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-cappuccino-UXO5P8KFS5"
  },
  "p108": {
    "src": "./assets/photos/p108-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 손소영갤러리앤카페의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Jordan Whitt · CC0 1.0",
    "source": "https://stocksnap.io/photo/espressomachine-coffee-C3MZGAMOKQ"
  },
  "p109": {
    "src": "./assets/photos/p109-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 아마빌레의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Caio Resende · CC0 1.0",
    "source": "https://stocksnap.io/photo/silhouette-coffee-58W79YWLRL"
  },
  "p110": {
    "src": "./assets/photos/p110-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 티하우스클리프의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Martin Vorel · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-latte-548B7JD5A7"
  },
  "p111": {
    "src": "./assets/photos/p111-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 기찻길315의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "PICSELI · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-book-8MGELU7YZK"
  },
  "p112": {
    "src": "./assets/photos/p112-example.webp",
    "alt": "커피·카페 관련 주제 사진 예시. 라니카이의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Drew Coffman · CC0 1.0",
    "source": "https://stocksnap.io/photo/coffee-latte-D322D377AD"
  },
  "p113": {
    "src": "./assets/photos/p113-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 고호의 책방의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Krzysztof Puszczyński · CC0 1.0",
    "source": "https://stocksnap.io/photo/school-books-S059QDGBOG"
  },
  "p114": {
    "src": "./assets/photos/p114-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 목포종합수산시장의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Mobius6 · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=118296428"
  },
  "p115": {
    "src": "./assets/photos/p115-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 씨엘비베이커리(원도심점)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Daria Nepriakhina · CC0 1.0",
    "source": "https://stocksnap.io/photo/donuts-bakery-IA7B7S9TSW"
  },
  "p116": {
    "src": "./assets/photos/p116-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 코롬방제과점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Drew Coffman · CC0 1.0",
    "source": "https://stocksnap.io/photo/bread-bakery-EA1243E167"
  },
  "p117": {
    "src": "./assets/photos/p117-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 작은낙의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Patrick Tomasso · CC0 1.0",
    "source": "https://stocksnap.io/photo/books-wall-ANC5ACJ7V0"
  },
  "p118": {
    "src": "./assets/photos/p118-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 물망초의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Negative Space · CC0 1.0",
    "source": "https://stocksnap.io/photo/reading-book-LXCMDRFA51"
  },
  "p119": {
    "src": "./assets/photos/p119-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 한마을떡의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "by Joseph Steinberg (Baltimoron in Korea) at Flickr · CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=4657885"
  },
  "p120": {
    "src": "./assets/photos/p120-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 목포쫀드기 본점의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Daria Shevtsova · CC0 1.0",
    "source": "https://stocksnap.io/photo/vintage-bakery-ZAG3KUMDTW"
  },
  "p121": {
    "src": "./assets/photos/p121-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 청호시장의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Ulrich Lange, Bochum, Germany · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=45591188"
  },
  "p122": {
    "src": "./assets/photos/p122-example.webp",
    "alt": "시장·간식 관련 주제 사진 예시. 목포동부시장의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Juan ignacio Tapia · CC0 1.0",
    "source": "https://stocksnap.io/photo/market-bazaar-LLDXIGFHXM"
  },
  "p123": {
    "src": "./assets/photos/p123-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 나비팩토리의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Chia Wei Ku · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=9825582"
  },
  "p124": {
    "src": "./assets/photos/p124-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 가죽공방 모닉의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "AmiraAdel93 · CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/w/index.php?curid=162594696"
  },
  "p125": {
    "src": "./assets/photos/p125-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 비팡이네의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Patryk Dziejma · CC0 1.0",
    "source": "https://stocksnap.io/photo/art-crafts-TGB4TT4K99"
  },
  "p126": {
    "src": "./assets/photos/p126-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 유유랜드의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Rystheguy · CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Wedding_Ducks_in_a_Souvenir_Store_in_Seoul.jpg"
  },
  "p127": {
    "src": "./assets/photos/p127-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 포도책방(목포점)의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Josh Felise · CC0 1.0",
    "source": "https://stocksnap.io/photo/library-books-4TDHSPIMJ6"
  },
  "p128": {
    "src": "./assets/photos/p128-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 구보책방의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Aaron Burden · CC0 1.0",
    "source": "https://stocksnap.io/photo/books-reading-CN63QSUO8C"
  },
  "p129": {
    "src": "./assets/photos/p129-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 오늘의 페이지의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Startup Stock Photos · CC0 1.0",
    "source": "https://stocksnap.io/photo/books-bookshelf-0SP70JWWOK"
  },
  "p130": {
    "src": "./assets/photos/p130-example.webp",
    "alt": "책·공방 관련 주제 사진 예시. 웨이브의 실제 모습이나 상품은 아닙니다.",
    "kind": "example",
    "credit": "Maciej Korsan · CC0 1.0",
    "source": "https://stocksnap.io/photo/cafe-coffee-0DFCQK31OQ"
  }
};
