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

코드 검사가 통과해도 실제 브라우저 클릭, 방문일의 운영시간, 현장 출입, 보행 안전과 버스 배차가 보장되지는 않습니다. 사이트 배포 확인은 [별도 절차](../HOSTING.md)입니다.
