# 한걸음

**차 없이 떠나는 하루 여행, 장소 탐색부터 나만의 계획표까지.**

목포를 시작으로 뚜벅이 여행을 계획하는 웹앱입니다. 이 저장소에서 앱 원본과 지역 조사, 기획·검증 기록을 함께 관리합니다.

[공개 사이트](https://mokpo-day-planner.sooyeon-jun-0389.chatgpt.site/) · [문서 안내](docs/README.md) · [발표자료](<뚜벅이여행 발표.pptx>) · [작업기록](한걸음/포트폴리오-작업기록.md)

## 어떤 프로젝트인가요?

- **장소 탐색** — 지역별 여행지·식당·카페 정보와 지도에서 갈 곳을 살펴봅니다.
- **루트 비교** — 맞춤·테마 루트를 참고해 여행 동선을 검토합니다.
- **내 계획표** — 장소와 방문 시각을 조정하고 기기에 계획을 저장합니다.
- **지역 확장** — 목포에서 시작해 강릉·경주 자료와 테마 루트를 함께 관리합니다.

운영시간·휴무와 이동 경로에는 미확인 정보가 포함될 수 있습니다. 추천은 방문일의 실제 영업·입장 가능 여부나 버스 운행을 보장하지 않습니다.

## 빠르게 시작하기

Node.js와 npm, 로컬 미리보기용 Python 3가 필요합니다. 현재 Worker 검증에는 `node:sqlite`를 지원하는 Node.js가 필요합니다(Node 26에서 실행 확인).

```sh
git clone https://github.com/2608-art/walking_travel.git
cd walking_travel
npm ci
npm run sync:preview
npm run build
npm test
```

### 로컬 미리보기

저장소 루트에서 실행한 뒤 터미널에 표시되는 주소를 엽니다.

```sh
python3 server.py
```

화면을 먼저 살펴보는 데 API 키는 필요하지 않습니다. 실제 주소 검색·경로 API는 서버의 `KAKAO_REST_API_KEY` 등 별도 설정이 필요합니다. 키나 `.env`, 로컬 DB는 커밋하지 않습니다. 자세한 경계는 [배포 안내](HOSTING.md)와 [카카오맵 연결](docs/specs/카카오맵-연결.md)을 참고하세요.

## 저장소 구조

| 경로 | 역할 |
| --- | --- |
| [`public/`](public/) | **화면·장소 데이터의 기준 원본** |
| [`worker/`](worker/) | 배포용 주소 검색·경로 API |
| [`db/`](db/), [`drizzle/`](drizzle/) | DB 스키마와 마이그레이션 |
| [`scripts/`](scripts/README.md) | 빌드·동기화·데이터 제작·운영 점검 |
| [`verification/`](verification/README.md) | 동선·지도·계획표 검증과 근거 자료 |
| [`docs/`](docs/README.md) | 기획 명세, 앱 운영 안내, 지역 문서 |
| [`research/`](research/) | 지역 조사와 출처 자료 |
| [`한걸음/`](한걸음/) | PRD, 작업기록, 발표자료, 기존 로컬 프로젝트 |
| [`dist/`](dist/) | 빌드로 생성하는 Worker·클라이언트 배포 산출물 |

> 화면 수정은 `public/`에서 합니다. `한걸음/travel-app/dist/`는 `npm run sync:preview`로 갱신하는 미리보기 복사본입니다. 오래된 복사본을 원본에 덮어쓰지 않습니다. 기존 배포·미리보기 구조는 유지합니다.

루트의 JSON·TSV는 기존 제작 도구가 참조하는 입력 자료입니다. 이번 정리에서는 데이터 내용과 저장 위치를 바꾸지 않았습니다.

## 주요 명령어

모든 명령은 **저장소 루트**에서 실행합니다.

| 명령 | 용도 |
| --- | --- |
| `npm run sync:preview` | 원본 화면을 로컬 미리보기로 복사 |
| `npm run build` | 테마 루트 갱신·검사 후 배포 파일 생성 |
| `npm test` | Worker·SQLite·캐시 정책 검증 |
| `npm run test:visits` | 경주 방문 자료 검증 |
| `npm run test:theme-refresh` | 장소 변경에 따른 테마 루트 갱신 검증 |
| `node verification/verify-plan-audit.cjs` | 계획표 동선 경계 검증 |

추가 검증과 과거 시나리오의 범위는 [검증 안내](verification/README.md)에 구분했습니다. 데이터 제작 명령은 파일을 덮어쓰거나 외부 API를 호출할 수 있으므로 [스크립트 안내](scripts/README.md)를 먼저 확인하세요.

## 문서와 발표

- [문서 목차](docs/README.md): 기획·운영·지역 자료의 시작점
- [PRD](한걸음/prd.md): 제품 목표와 후속 아이디어
- [포트폴리오 작업기록](한걸음/포트폴리오-작업기록.md): 사용자 판단, AI 수행, 검증과 한계
- [수업 발표 PPT](한걸음/발표자료/한걸음-7분-발표-최종.pptx) · [발표문](한걸음/발표자료/한걸음-7분-발표문-최종.docx)

## 변경과 배포

작업 전 [프로젝트 지침](AGENTS.md)을 확인하고, 의미 있는 변경과 검증 결과를 작업기록에 남깁니다.

Sites 배포는 [HOSTING.md](HOSTING.md)와 `.openai/hosting.json`의 **기존 Site ID**를 따릅니다. **GitHub에 병합해도 사이트가 자동 배포되지는 않습니다.**

[장소 운영정보 자동 점검](docs/앱/운영시간-자동점검.md)은 공개 출처를 조회해 검토 이슈를 남기는 작업입니다. 앱 데이터 수정이나 사이트 배포를 자동으로 수행하지 않습니다.
