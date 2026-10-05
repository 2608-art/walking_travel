# 한걸음 배포 구조

2026-10-04: 기존 정적 배포를 같은 Site ID의 Worker 배포로 전환했다. 공개 범위는 변경하지 않는다.

- `public/`: 화면·데이터·마스코트·서비스 워커의 기준 원본. `한걸음/travel-app/dist/`는 로컬 Python 미리보기용 복사본이며 `npm run sync:preview`로 갱신한다. 오래된 로컬 복사본을 `public/`에 덮어쓰지 않는다.
- `worker/index.js`: 배포용 주소 검색, 도보/대중교통 API 중계. 로컬 `한걸음/travel-app/server.py`의 동작을 Worker 환경에 맞게 옮겼다. 키는 서버 비밀값 `KAKAO_REST_API_KEY`로만 읽는다.
- `db/schema.ts`, `drizzle/`: 등록 구간 캐시와 일별 API 사용량의 D1 스키마/마이그레이션. 개인 계획표는 기존 기기 저장 흐름을 유지한다.
- `scripts/build.mjs`: 최신 장소 데이터의 등록 ID·좌표를 서버 코드에 넣고 `dist/server/index.js`, `dist/client/`, `dist/.openai/hosting.json`을 생성한다.
- `scripts/verify-worker.mjs`: 실제 SQLite에 마이그레이션을 적용하고 API 대역으로 등록 구간 저장, 임의 주소 제외, 중복·일일 한도·정적 파일 전달을 검사한다.

등록 장소 사이의 방향별 구간만 D1에 저장한다. 임의 주소·현재 위치·좌표 불일치 구간은 저장하거나 읽지 않는다. 동일 Worker의 동시 조회는 합치며 다른 Worker 간에도 기본키로 중복 행을 방지한다. 주소 요청 자체는 저장하지 않고 일별 API 횟수만 센다. 일일 안전 한도는 각 종류별 200회이며 검색은 실제 외부 요청당 센다. 도보 API 한도 이후에도 이미 저장된 등록 구간은 재사용한다.

업데이트 순서: GitHub `walking_travel`에서 `public/` 수정 → `npm run sync:preview`로 로컬 화면 갱신 → 서버 변경이 있으면 Worker에도 반영 → 스키마 변경 시 `drizzle-kit generate`와 SQL 검사 → `npm run build` → `npm test` → 기존 Site 소스를 열고 검증된 배포 파일을 동기화 → Sites workflow로 소스·아카이브 저장 → 기존 접근 범위로 배포 → 공식 배포 상태 성공 확인. GitHub 병합만으로 사이트가 자동 배포되지는 않는다.

배포 아카이브에는 `.env`, 로컬 SQLite, 사용자 계획, 시험 로그를 넣지 않는다. 이미 적용한 마이그레이션은 수정하지 않고 새 파일로 추가한다. 데이터는 새 지역이 늘 때 지역 데이터와 함께 갱신하며, 모든 외부 주소 주변의 관광 정보를 자동 조사하는 기능은 아니다.
