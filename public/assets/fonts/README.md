# 앱 글꼴

- **Pretendard Variable 1.3.9**: 기본 UI, 제목·본문·입력·지도·탭·버튼. [공식 저장소](https://github.com/orioncactus/pretendard), `Pretendard-LICENSE.txt`(SIL OFL 1.1). 이름은 CSS에서 Pretendard로 사용한다. 400/500/600/700 굵기를 사용한다.
- **Gowun Dodum**: 홈 히어로·여행 메모 제목, 목포 소개 카피, 여행 팁 제목에 한정한다. [공식 Google Fonts 소스](https://github.com/google/fonts/tree/main/ofl/gowundodum), `GowunDodum-OFL.txt`(SIL OFL 1.1). Google Fonts가 생성한 현재 포인트 문구용 서브셋 `GowunDodum-Accent.ttf`를 자체 제공한다. 나머지 글자는 Pretendard로 대체한다. 새 지역의 감성 문구가 달라지면 이 서브셋도 갱신한다.
- Gowun Dodum의 원본은 Regular 한 굵기다. 홈 큰 문구만 브라우저의 굵기 합성으로 Bold를 표현하며 본문·버튼에는 적용하지 않는다.
- 모두 `font-display: swap`, 같은 출처의 로컬 파일 제공 및 서비스 워커 캐시를 사용한다. 글꼴 로딩 실패 시 시스템 한글 폰트로 대체한다.
