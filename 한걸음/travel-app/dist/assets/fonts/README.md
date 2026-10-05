# 앱 글꼴

- **Pretendard Variable 1.3.9**: 기본 UI, 제목·본문·입력·지도·탭·버튼. [공식 저장소](https://github.com/orioncactus/pretendard), `Pretendard-LICENSE.txt`(SIL OFL 1.1). 이름은 CSS에서 Pretendard로 사용한다. 400/500/600/700 굵기를 사용한다.
- **Cafe24 Dongdong (카페24 동동)**: 사용자가 최우선으로 지정한 감성 폰트. 홈 큰 문구·감성 섹션 제목·지역명·여행 메모·말풍선·팁 제목에 한정한다. `Cafe24Dongdong.woff2` 전체 파일을 자체 제공하며 Regular 400을 사용한다. [공식 배포처](https://fonts.cafe24.com/), [사용자가 제공한 웹폰트 저장소](https://github.com/fonts-archive/Cafe24Dongdong), [다운로드 당시 안내와 라이선스](Cafe24Dongdong-source.md).
- 정보성 장소명·지역 설명 본문·운영시간·주소·검색·탭·버튼·지도는 Pretendard를 유지한다. Cafe24의 글자 크기가 작게 보이는 특성을 고려해 감성 제목만 UI 제목보다 큰 크기를 사용한다.
- 이전 Gowun Dodum 파일과 OFL은 이전 디자인 이력으로 보존하지만 현행 CSS와 필수 오프라인 캐시에서는 사용하지 않는다.
- 모두 `font-display: swap`, 같은 출처의 로컬 파일 제공 및 서비스 워커 캐시를 사용한다. 글꼴 로딩 실패 시 시스템 한글 폰트로 대체한다.
