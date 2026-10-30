# 2026-10-29 — GameOps 기존 화면에 Steam PC 개발 진척 연결

> **2026-10-30 사용자 최상위 수정:** 이 변경은 ArchiveOS 메인 대시보드나 일반 운영 메뉴에 표시하지 않는다. 기존 OCI의 **'개발 관제' 전용 라우트**에만 적용한다. 현재 운영 소스 기준의 최종 실행 절차는 `docs/operations/OCI_GAME_MONITORING_ONLY_20261030.md`이며, 이 문서의 과거 상충 지침보다 우선한다. GitHub main이 최신 운영 소스가 아니므로 PR 전체를 그대로 OCI에 배포하지 않는다.

## 실제 OCI 공개 파일 확인

2026-10-29 15:57 KST, GitHub Actions 40832390692, Public HTTP fingerprint:
- ArchiveOS root HTTP 200, 새 진입 번들 /assets/index-CJRnWjWC.js (675752 bytes, SHA256 prefix c4a6eabd343baddc).
- 동일한 실제 번들에 기존 GameOps 제목 DEVELOPMENT / RELEASE, 전체 목표 구현률, 원본 기준 부재, 독립 플레이 E2E 문자열과 새 위젯 Steam PC MVP, Steam Windows PC 작업영역별 추정, 원본 72건 상태 분포, ds-workstream-chart 문자열이 **모두 포함**.
- 공개 /deepstake-progress.json HTTP 200, application/json, 스키마 deepstake-steam-progress-v1 검증.
- /api/health HTTP 200, 비인증 /api/schedule/overview HTTP 401.
- 사용자가 본 실제 GameOps 카드에는 여전히 전체 목표 '산정 불가', 6개 NOT_VERIFIED, 과거 72건과 10/23 EditMode 기록이 표시됨.

=> OCI 번들 및 데이터 파일 배포는 됐으나, 기존 GameOps 화면을 새 위젯으로 교체/통합했다는 증거가 없음. 같은 JS 파일에 코드가 있다는 사실이 같은 라우트에서 렌더된다는 뜻은 아님.

## 현재 충돌의 원인

PR #17은 2026-07-31 상태의 GitHub main을 기준으로 ConsoleDashboardPage에 compact 위젯을 추가하고 ConsoleOperationsPage에 'Steam 개발' 상세 탭을 추가했다. 실제 운영의 GameOps 'DEVELOPMENT / RELEASE' 카드와 SchedulePage/V47은 이후 만들어진 운영 소스로 보이며, PR #17은 그 카드 코드를 수정하지 않았다. 따라서 옛 GameOps 패널은 그대로 남을 수 있다.

## 현재 운영 소스에서 한 번만 수정할 작업

1. 로컬 ArchiveOS 배포자 소스의 실제 Git HEAD/dirty 상태와 OCI 현재 운영 이미지/작업 잠금을 확인. 이미 쓰기 중이면 중복 시작 금지. DeepStake Unity MAIN/세이브/타 프로젝트 무관.
2. 현재 로컬 소스에서 'DEVELOPMENT / RELEASE', '전체 목표 구현률', '원본 기준 부재', '플레이 수용 6개 운영 게이트'를 검색하여 실제 GameOps React 컴포넌트/라우트를 찾는다. 이 실제 코드를 소유한 단일 작업자만 수정한다.
3. 기존 코드의 주요 KPI에 이미 배포된 DeepStakeProgressBoard 및 deepstakeProgress 가중 모델을 재사용, 동일 GameOps 화면에서 Steam PC MVP **추정 점수/평가 시각/9개 영역 그래프/72개 과거 상태 분포/Native gate/실측 이력**을 바로 볼 수 있게 통합한다. 다른 페이지 추가만으로 이 작업을 완료 처리하지 않는다. 중복 그래프/원본 UI 복제 금지.
4. 정식 전체 게임 완료율과 원본72 채점 기준은 복구되지 않았으므로 공식 수치로 조작하지 않는다. 원래 72개 기준선 완료10/진행10/미구현47/외부5, 과거24%는 역사 기록. 9개 영역 MVP 추정률은 별도 모델로 표기.
5. 6단계(create, move, wage, purchase, save, different PID reopen)를 MAIN native 자가검증과 독립 QA라는 **두 레일**로 시각화. v286은 사용자 제공 Codex 화면에서 E2E/테스트 PASS 보고가 있으나 실제 Native PID/해시/영수증 확인 전에는 독립 QA PASS로 승격 금지. 고정 NOT_VERIFIED 6칸만 반복하지 말고 자체 검증 증거의 개선을 함께 보여 준다.
6. 과거 EditMode 1112/1112 (10/23)와 별도로 v286 자체 테스트 71/71, 59/59, 격리 33/33을 원본 로그 확인 후 **범위별**로 표시하고 수집시각과 검증시각 구분.
7. /deepstake-progress.json은 지금 정상 응답하지만 최초 v271 시점의 보수적 추정 모델이다. 리뷰어가 동일한 가중 기준에서 재평가했을 때만 26.4%를 갱신. 스크린샷의 v286 '첫 마을 MVP 증거점수 56/100'은 서로 다른 점수이므로 전체 게임 56%로 둔갑 금지.
8. 현행 SchedulePage/V47/일정 7개 마일스톤, TODO, 인증, 서비스 메뉴 보존. 구형 GitHub main 소스 전체로 운영 프런트를 재빌드하지 않는다.
9. 현행 운영 소스 기준 frontend-only 후보 빌드, 테스트, 실제 화면 시각 QA, 전후 이미지 digest, 롤백 가능성 확인 후 OCI 승격.
10. **완료 판정**은 사용자가 지금 보는 기존 DEVELOPMENT / RELEASE 화면에 새 추정%와 차트가 실제로 나타나고, 원래 일정/권한/모든 기존 API가 정상인 경우만. 단순 JSON HTTP200이나 새 탭 존재만으로 완료 아님.

## 권한 경계

이 ChatGPT 대화에는 OCI SSH 및 현재 운영 소스의 로컬 파일 접근 경로가 없고, Remote Desktop Commander의 월간 호출 제한이 있다. 따라서 개발 지시/검증 자료 작성은 가능하지만 로컬 GameOps 구현 파일 수정 및 OCI 승격 실행을 완료한 것으로 주장할 수 없다. 사용자 로컬 Codex Archive Project의 단일 운영 소유자가 이 기존 PR #17과 실제 현행 운영 소스에서 이식·배포해야 한다.


## 2026-10-29 v287/v288 로컬 Codex 사용자 스크린샷 추가

- v287: 신규 Native PID 44712 및 재진입 PID 30340 모두 exit0, 근무→급여→물 구매→저장→별도 PID 복원을 로컬 Codex가 보고.
- v288: 저장 경로 분리·잘못된 설정 거부 검사 통과 및 수동 이어하기 런처 준비 보고, 상태 전송 주기 관련 테스트 66/66.
- 동일 소스 로컬 보고로 이동 17개 경로 정지 34곳 0.03m 미만, 종료 후 불필요 이동 없음.
- '첫 마을 MVP 증거점수 56/100'은 9영역 가중 추정 26.4%, 과거 72건 24% 및 전체 게임 완성률과 전부 별도.
- 현재 증거는 사용자가 제공한 DeepStake Project Codex 화면이므로 Native 원본 종료 영수증 및 TestResult XML 독립 재검증이 필요. 실제 사람의 키/마우스 테스트, 거리 시각 품질, 체감 입력 지연, P18 GPU 1px, 출시 승인은 아직 미확정.
- ArchiveOS GameOps 기존 카드에서는 v287/288 **개발자 자체 보고를 최신 동향으로 표시**하고, 오래된 v271 원본 Native FAIL은 그 당시 검증으로만 라벨링. 독립 QA 카드의 상태는 그대로 미승인으로 둔다.
- GitHub PR #17의 public/deepstake-progress.json에 developerReport를 별도 보존. **단 이 PR은 운영에 자동 배포되지 않으므로 최신 OCI 운영 소스에 단일 패치로 통합해야 실제 표시됨.**
