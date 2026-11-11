# 스크립트 안내

[프로젝트 홈](../README.md) · [검증 안내](../verification/README.md)

모든 명령은 저장소 루트에서 실행합니다. `package.json`에 등록된 명령을 우선 사용하세요.

## 일상 작업

| 명령 | 역할·주의 |
| --- | --- |
| `npm run sync:preview` | `public/`을 `한걸음/travel-app/dist/`로 복사 |
| `npm run build` | 테마 루트 갱신 후 `dist/` 재생성. 생성 파일이 바뀔 수 있음 |
| `npm test` | Worker·DB·API 대역 검증 |
| `npm run test:visits` | 경주 방문 자료 검사 |
| `npm run test:theme-refresh` | 테마 변경 갱신 검사 |
| `npm run db:generate` | DB 마이그레이션 생성. 이미 적용한 SQL은 수정하지 않음 |
| `npm run data:prices` | 가격 자료 반영. 입력과 변경 결과를 먼저 확인 |

## 파일 이름으로 찾기

- `build*`, `generate*`: 지역·테마 데이터 및 산출물 제작
- `apply*`, `merge*`, `prepare*`: 조사 자료 가공·반영
- `fetch*`, `import*`: 외부 자료·사진·보행 경로 수집
- `verify*`: 빌드·방문·테마 갱신 검증
- `audit-place-hours.py`, `publish-hours-audit.py`: 운영정보 조회와 GitHub 검토 이슈 작성. [운영 안내](../docs/앱/운영시간-자동점검.md) 참고

## 루트에서 이동한 Python 도구

| 이전 위치 | 현재 위치 | 실행 시 주의 |
| --- | --- | --- |
| `build-data.py` | [`scripts/build-data.py`](build-data.py) | 목포 조사 문서로 장소 데이터를 재생성·덮어씀 |
| `geocode-places.py` | [`scripts/geocode-places.py`](geocode-places.py) | 카카오 API·비밀키 필요. 과거 `dist/places.json` 입력 구조를 사용 |
| `make-icons.py` | [`scripts/make-icons.py`](make-icons.py) | Pillow 필요. 과거 `dist/` 아이콘 제작 도구 |

파일 이동에 맞춰 저장소 루트를 찾는 경로만 조정했습니다. 과거 제작 도구를 현재 데이터에 일괄 실행하지 마세요. 주소 변환·아이콘 도구의 과거 출력 구조는 이번에 바꾸지 않았으며 일반 빌드 절차에도 포함하지 않았습니다.

`한걸음/travel-app/` 안의 동명 파일은 기존 로컬 프로젝트의 별도 복사본입니다. 이번 정리는 그 파일을 합치거나 삭제하지 않습니다. 현재 화면의 기준 원본은 `public/`입니다.
