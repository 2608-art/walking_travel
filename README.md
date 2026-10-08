# 한걸음

목포를 시작으로 뚜벅이 하루 여행을 계획하는 웹앱입니다. 이 저장소는 배포 코드와 기획·조사·검증 기록을 함께 관리하는 GitHub 기준 저장소입니다.

## 바로가기

- [뚜벅이여행 발표.pptx](<뚜벅이여행 발표.pptx>)
- [한걸음 공개 사이트](https://mokpo-day-planner.sooyeon-jun-0389.chatgpt.site/)

## 구성

- `public/`: 사이트 화면·장소 데이터의 기준 원본
- `worker/`, `db/`, `drizzle/`: 배포용 API와 저장 구조
- `dist/`: `npm run build`가 만드는 Worker·클라이언트 배포 산출물
- `한걸음/`: PRD, 지역 조사, 로컬 Python 미리보기, 포트폴리오 작업기록
- `한걸음/travel-app/dist/`: `public/`에서 복사하는 로컬 미리보기 화면

화면을 바꿀 때는 `public/`을 수정하고 `npm run sync:preview`로 로컬 미리보기 복사본을 갱신합니다. 오래된 로컬 복사본을 `public/`에 덮어쓰지 않습니다.

## 확인과 배포

```sh
npm run sync:preview
npm run build
npm test
```

Sites 배포는 [HOSTING.md](HOSTING.md)의 절차와 `.openai/hosting.json`의 기존 Site ID를 따릅니다. GitHub에 병합하는 것만으로 사이트가 자동 배포되지는 않습니다.
