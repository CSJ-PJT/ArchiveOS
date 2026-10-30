# DeepStake Steam PC 개발 관제 — 추정 진척 / 원본 72 / 증거 동기화

> **2026-10-30 사용자 최상위 수정:** 이 변경은 ArchiveOS 메인 대시보드나 일반 운영 메뉴에 표시하지 않는다. 기존 OCI의 **'개발 관제' 전용 라우트**에만 적용한다. 현재 운영 소스 기준의 최종 실행 절차는 `docs/operations/OCI_GAME_MONITORING_ONLY_20261030.md`이며, 이 문서의 과거 상충 지침보다 우선한다. GitHub main이 최신 운영 소스가 아니므로 PR 전체를 그대로 OCI에 배포하지 않는다.

> 적용 대상: **Steam용 Windows PC 게임만**. 다른 개발 범위는 사용자 지시에 따라 보류하며 이 관제에 섞지 않는다.

## 왜 "산정불가"가 나오는가

기존 원본 72개 기준의 항목별 ID, 수용 조건, 가중치와 현재 상태를 포함한 원장이 연결돼 있지 않다. 확보된 과거 ArchiveOS 총괄 영수증(2026-10-22 기준, 10-24 재확인)은 **총72 = 완료10 + 진행10 + 미구현47 + 외부5**, 당시 화면의 **24%**라는 집계뿐이다. 24%의 원래 계산식은 확인되지 않았다. 따라서 새로운 PM_P* 테스트 결과를 임의의 72개 ID에 연결하는 것은 금지한다.

2026-10-29 현재 마지막 확인된 별도 Native 결과:
- v271 Windows 내부 빌드 성공, 관련 EditMode **30/30 PASS** (전체 회귀 아님).
- Native PID **48668**, exit **1**: 실제 `SkipOptionalArrival` 버튼의 active actionable 상태 확인에 실패해 create 단계에서 중단.
- 근무·구매·저장·별도 PID 재접속은 해당 최신 실행에서 **미실행**.
- P13에서는 Home floor RGB differential 0/0으로 개선. P18 엄격 도로 1px loss가 남아 strict GPU FAIL.
- 원본 D5 v230/사용자 데이터 보호. 실제 사람 키보드·화면 전체·독립 QA·Steam 릴리스 승인 없음.

이 자료를 **"Steam Windows PC MVP 개발 추정"**과 **"72건 과거 집계"**로 나눈다. 서로의 분모와 상태를 합치거나, 72건 진행률이 새 개발 결과 때문에 자동으로 올랐다고 말하지 않는다.

## Steam PC MVP 추정 계산

`public/deepstake-progress.json`에는 9개 작업영역 `weight`(합계100), `estimate`(0~100), `gate`(PASS/PARTIAL/FAIL/NOT_RUN/BLOCKED), `note`, `evidence`를 기록한다.

```text
Steam MVP 추정% = Σ(작업영역 가중치 × 검토된 영역 점수) ÷ Σ(가중치)
현재 평가 모델: 26.4% (최종 게임 완성률 아님)
```

각 영역 점수는 보수적 검토 점수이며 사용자의 원본 72건 기준에서 나온 값이 아니다. 매 수정마다 UI에 가중치·영역 점수·기여 퍼센트포인트·근거가 공개되도록 했다. 이 모델은 목표 달성용 점수 부풀리기 수단이 아니며, PASS가 아닌 게이트를 PASS로 승격시킬 수 없다. 실제 72개 ID가 복구될 경우에만 원본 상태를 별도 계산한다.

72개 이력 자체를 작업 가중치로 환산하지 않는다. 현재의 경우 단순 항목 수 기준으로 완료 하한 10/72 = 13.9%, 진행10건을 모두 완료로 가정한 상한 20/72 = 27.8% 정도만 참고할 수 있다. 이 값들은 **원래 24% 공식이 아니라 다른 가정의 민감도 예시**다.

## 화면 제공

- **기존 개발 관제 전용 메뉴:** 게임 개발 추정치, 9개 영역 가중 막대, 기존 72건 보고치/분포, 최근 Native 증거, 출시/독립 QA 게이트, 작업 타임라인을 **단일 전용 페이지**에 표시한다. 현재 운영 사이트에 이미 있는 '개발 관제' 라우트에만 통합한다.
- **ArchiveOS 메인 대시보드 및 일반 운영 탭:** 게임 개발 진행률·위젯 **절대 표시하지 않는다**. 2026-10-30 사용자 최상위 정정으로 이전 배치 지시를 철회한다.
- 모바일 폭에서도 4 KPI는 2열, 영역별 상세는 1열로 배치한다.
- 데이터가 24시간 이상 오래되면 *오래된 스냅샷*으로 표시한다.
- 추정 이력은 같은 모델로 측정된 스냅샷이 2개 이상 있을 때만 차트화한다. 과거 72 보고치와 새로운 Steam MVP 추정치를 가짜 시계열로 연결하지 않는다.
- 파일 가져오기는 **해당 브라우저의 임시 미리보기**일 뿐 서버 값이나 원본 72 원장은 바꾸지 않는다.

## 증거 동기화

기본 피드는 Vite에 포함된 `/deepstake-progress.json`이며, 브라우저는 매 60초 `cache: no-store`로 조회한다. **기본 정적 피드는 새 빌드가 생겨도 자동으로 변하지 않는다.** 운영 환경에서 실시간 자동 갱신을 원하면 승인된 증거 배포기가 JSON을 정기 발행하도록 연결해야 한다.

정식 배포기의 동일 출처 URL이 있다면 환경 변수 `VITE_DEEPSTAKE_PROGRESS_FEED_URL`로 설정한다. 클라이언트에 노출되는 `VITE_*` 값이나 JSON에 토큰·비밀번호·세이브·개인 정보·내부 접속 주소를 넣지 않는다. 안전한 공개/권한관리된 읽기 전용 응답만 제공한다.

### 신규 MAIN 결과 수집

IT13에서 Codex MAIN의 실제 최종 결과 JSON을 검증한 뒤, ArchiveOS 체크아웃에서 아래처럼 사용한다.

```powershell
node scripts/sync-deepstake-progress.mjs --result "C:\path\to\verified-PM_RESULT.json"
npm run test
npm run build
```

이 게시기는 한 개의 **더 최신** DeepStake MAIN result를 받아 source/task ID, 테스트 분모, Native PID·exit·첫 실패를 검증해 이벤트와 최신 스냅샷에 반영한다. 한 번 통과한 과거 테스트를 새로운 테스트처럼 더하지 않는다. Native exit0만으로 전체 생활 E2E나 Steam 릴리스를 PASS 처리하지 않는다. 원본72 항목과 가중 추정 점수는 자동 증가시키지 않는다.

새로운 **MVP 영역 점수**를 인정하려면 별도 `deepstake-steam-review-v1` JSON에서 전체 9개 영역의 동일 가중치, 수정 점수, 상태, 근거, 리뷰어, 출처, 리뷰 시각을 함께 제시한다.

```powershell
node scripts/sync-deepstake-progress.mjs --review "C:\path\to\approved-steam-review.json"
```

점수를 변경했다면 이전 모델과 동일 가중치로 날짜별 스냅샷 추세가 생성된다.

### 원본 72개 기준 복구

실제 기준 목록이 확보되면 `deepstake-original72-authoritative-v1` 스키마로 **72개 고유 ID**, 각 ID의 `status`와 원본 출처를 제공한다.

```powershell
node scripts/sync-deepstake-progress.mjs --original72 "C:\path\to\authoritative-72-rows.json"
```

72개의 실제 원본 ID가 중복/누락되면 변환을 거부한다. 별도 근거가 확인될 때만 개별 상태를 수정하고, 24%의 당시 보고치는 불변 이력으로 보존한다. 원본 72개와 추정 MVP 작업영역 간 대응표는 별도 승인 전에는 만들지 않는다.

## 배포 및 책임 경계

1. 새 스냅샷은 코드 리뷰 가능한 브랜치에서 변경한다. `main` 직접 수정/무승인 배포는 금지한다.
2. `npm run test`와 `npm run build`가 통과해야 한다. GitHub PR의 Actions도 확인한다.
3. 리포트 증거 및 실측값과 해시를 교차 확인한 후 PR을 리뷰·병합한다.
4. 사용 중인 실제 `archiveos.kr` 서비스의 배포 소스·런타임이 이 GitHub 저장소와 같은지 운영자가 먼저 확인한다. 2026-07-31 마지막 메인 브랜치 기록은 2026-10 실사용 화면의 배포 상태를 증명하지 않는다.
5. 자동 동기화 또는 배포를 별도로 연결하기 전에는 **PR 코드 제공 상태이지 실제 운영 대시보드 갱신 완료가 아니다**.

이번 기능은 기존 ArchiveOS 핵심 서비스 KPI(Market/Nexus/Logistics/Ledger/ArchiveOS)의 분모나 safe-mode를 변경하지 않는다. DeepStake Steam PC 개발 상태를 독립 운영 섹션으로 표시한다.
