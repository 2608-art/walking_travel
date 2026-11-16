# 검증 안내

[프로젝트 홈](../README.md) · [스크립트 안내](../scripts/README.md)

명령은 저장소 루트에서 실행합니다. `verification/qa/`와 `fixtures/`는 기존 검증 근거·시험 입력입니다. 과거 실행 기록을 현재 검증 완료로 해석하지 않습니다.

## 주요 검사

```sh
npm test
npm run test:visits
npm run test:theme-refresh
node verification/verify-plan-audit.cjs
node verification/verify-route-quality.cjs
node verification/verify-route-repair.cjs
```

기본 검사는 외부 API 대신 대역이나 저장 자료를 사용합니다. 이름에 `live`가 포함된 검사는 코드와 환경을 먼저 확인하세요. 실제 외부 요청은 API 키·네트워크·이용 한도에 영향을 받을 수 있습니다.

## 루트에서 이동한 검사

- `verify-custom-address.cjs`
- `verify-live-route.cjs`
- `verify-route-cache.py`
- `verify-route-conditions.cjs`
- `verify-route-improvements.cjs`
- `verify-routes.cjs`
- `verify-theme-day.cjs`

이제 `node verification/<파일명>` 또는 `python3 verification/verify-route-cache.py`로 실행합니다. JavaScript 검사는 배포 복사본 대신 `public/` 원본을 참조합니다. `load-public-engine.cjs`는 ESM 패키지 안의 브라우저 UMD 엔진을 기존 CommonJS 검사에 연결하는 보조 파일입니다.

일부 검사는 과거 특정 날짜·장소·추천 결과를 고정한 회귀 시나리오입니다. 전체 파일이 현재 데이터로 통과한다고 가정하지 말고 실행 결과와 실패 원인을 구분하세요. 이번 정리에서는 추천 규칙이나 고정 기대값을 바꿔 검사를 억지로 통과시키지 않습니다.

Python 캐시 검사는 루트 `server.py`를 불러오고 임시 시험 DB를 생성·정리합니다. 실제 API와 기존 사용자 DB를 변경하는 검사가 아닙니다.

## 검증의 경계

### 2026-11-17 기존 실패 3건 확인

- 경주 방문: 최신 GitHub main에서는 수정 전부터 통과한다. Sites v67의 `solo-travel.js`는 메뉴 출처를 요구하지만 GitHub는 기존 단품/방문 근거 정책을 유지해 서로 다르다. 이번 작업은 GitHub 정책과 앱 파일을 변경하지 않으며, 경주 방문 및 혼자 여행 검사를 함께 실행한다. 사이트까지 같은 소스라고 해석하지 않는다.
- 테마 갱신: 2026-10-08~09 휴업 자료를 실행일 기준으로 처리해 과거 이벤트가 제외됐다. 격리된 자식 프로세스에서만 시계를 10월 8일 KST로 고정한다. 운영용 현재 날짜 계산은 유지하며, 휴업 대체·후보 교체·기존 대체안 보존·반복 빌드 재사용을 검사한다.
- 경로 복구: 2026-10-04 저장 이동 구간을 최신 장소 자료와 변경된 후보 선택 엔진에 연결하고, 예전 12/10/11곳 및 탐색 중 누락 0개를 고정 기대했다. 당시 장소 스냅샷(`ab77fba:public/places.json`)을 `fixtures/route-repair-places-2026-10-04.json`에 보존한다. 현재 엔진/운영시간 판정을 사용하며 반환된 모든 이동 구간의 실제 기록·거리·시간을 대조한다. 기록 없는 탐색 요청은 계속 실패시키고, 결과에 섞이면 검사가 실패한다. 방문 개수 보존/축소는 통제된 3곳 입력으로 정확히 3곳/2곳을 검증한다. 필수 방문·시간·거리 상한·오프라인 추정 표시는 유지한다.

추가로 예전 검사의 11:30 종료 조건은 현재 엔진에서 필수 장소 1곳을 방문하고 정확히 11:30에 돌아올 수 있다. 이 경계는 허용하고 11:29는 거부하는 양쪽 검증으로 바꿨다. API 실패 시에도 현재 계약에 따라 확정 추천은 비어 있어야 하고, 별도 `generateReviewRoute`만 검토용·미확인 경로를 반환하도록 검사한다.

실시간 경로 API나 현장 운영정보를 재조사한 결과는 아니다. 현재 장소 자료는 별도의 테마·동선·경로 품질 검사로 확인한다.

코드 검사가 통과해도 실제 브라우저 클릭, 방문일의 운영시간, 현장 출입, 보행 안전과 버스 배차가 보장되지는 않습니다. 사이트 배포 확인은 [별도 절차](../HOSTING.md)입니다.
