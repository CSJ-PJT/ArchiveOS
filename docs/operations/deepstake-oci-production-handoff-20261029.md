# ArchiveOS OCI 운영판에 DeepStake Steam PC 진행 관제 반영

> **2026-10-30 사용자 최상위 수정:** 이 변경은 ArchiveOS 메인 대시보드나 일반 운영 메뉴에 표시하지 않는다. 기존 OCI의 **'개발 관제' 전용 라우트**에만 적용한다. 현재 운영 소스 기준의 최종 실행 절차는 `docs/operations/OCI_GAME_MONITORING_ONLY_20261030.md`이며, 이 문서의 과거 상충 지침보다 우선한다. GitHub main이 최신 운영 소스가 아니므로 PR 전체를 그대로 OCI에 배포하지 않는다.

## 적용 원칙

현재 보고된 운영판은 **2026-10-22 OCI 정적 릴리스 `archiveos-ui-schedule-20261022-v1`** 이다. 2026-10-22 검증 보고서에 따르면 `#/schedule` 화면과 `src/pages/SchedulePage.tsx`, `archiveos-ai/.../db/migration/V47__create_schedule_control.sql`, `/api/schedule/overview` 등이 존재한다. 개발 당시 Git 워크트리의 기존 변경과 분리한 PR은 없었다.

반면 `CSJ-PJT/ArchiveOS` 공개 `main`의 확인된 커밋은 **2026-07-31** 이고 `SchedulePage.tsx`/V47가 없다. 따라서 이 PR을 `main`에 병합하고 그 소스를 그대로 OCI 운영판에 `docker compose up --build`로 덮어쓰면 안 된다. 사용자 일정·TODO·에이전트 관리 기능을 잃을 위험이 있다. **현재 운영 소스를 먼저 확인할 때까지 병합과 배포를 보류한다.**

이 문서는 기존 릴리스·Git 작업·백엔드·데이터베이스를 보존하면서 Steam PC 대시보드 영역만 포팅하는 단일 실행 계약이다.

## 1. 반드시 실물부터 확인

OCI 접속은 기존 승인된 SSH/배포 계정으로만 한다. 숨겨진 토큰·개인키·비밀번호를 출력하거나 새 인증을 우회하지 않는다. 실제 OCI 접근 권한이 없으면 배포 불가를 정직하게 보고한다.

1. 운영 사이트 `https://archiveos.kr/#/schedule` 및 `/api/health`, `/api/schedule/overview` 실제 응답 상태를 확인한다. 비인증 일정 API가 401인 것은 정상일 수 있다.
2. 현재 운영 `frontend/backend/AI` 컨테이너·정적 릴리스의 태그, 이미지 digest, 마운트 위치, 배포 스크립트, CNAME/NGINX 연결, 데이터 저장소와 백업 가능 여부를 읽기 전용으로 기록한다.
3. 실제 현재 소스 워크트리와 Git 브랜치/HEAD, 미커밋 변경, 최근 변경 파일·크기를 확인한다. 2026-08-04 메일에 보존된 `C:\ArchivePJT\ArchiveOS`는 **과거 위치 참조**일 뿐 현재 소스라고 가정하지 않는다.
4. `src/pages/SchedulePage.tsx`, V47 마이그레이션, 현행 라우트, `/api/schedule/agent-events` 권한 검증이 존재함을 확인한다. 없으면 소스 불일치로 중단한다. 최신 사용자 기능을 옛 소스로 대체하지 않는다.
5. 현재 운영 이미지/정적 아티팩트와 기존 `#/schedule` 루트의 롤백 후보를 불변 SHA256 및 태그로 확보한다.

## 2. 실제 운영 소스에만 필요한 최소 이식

PR #17의 아래 모듈은 독립 컴포넌트이므로 **현재 운영판 소스 구조와 타입에 맞게 선택적으로 이식**한다.

- `src/lib/deepstakeProgress.ts` — Steam MVP 가중 평가/72개 원본 항목 검증
- `src/components/console/DeepStakeProgressBoard.tsx` 및 `deepstake-progress.css` — 차트/표/UI
- `public/deepstake-progress.json` — 2026-10-29 최초 검토용 스냅샷
- `scripts/sync-deepstake-progress.mjs`, `scripts/test-deepstake-progress.mjs` — 증거 갱신 및 시험

기존 `src/app/AppShell.tsx`, `src/app/navigation.ts`, `Sidebar`, `SchedulePage.tsx`를 PR #17의 과거 버전 파일로 통째로 교체하지 않는다. 현행 스케줄/에이전트 UI를 유지하면서 **대시보드에 요약**, 운영 메뉴의 **Steam 개발** 세부 보기만 현행 라우트/탭 방식으로 연결한다.

변경 영역을 사전에 확인하고 현재 게임 PM/Unity 소스는 수정하지 않는다. 새 DB 마이그레이션, 구매·경제·세이브·네트워크 API 변경 금지.

## 3. 배포 전 증거 및 소스 스냅샷 검증

- `npm ci && npm run test && npm run build` (현재 소스의 실제 스크립트를 확인해 조정).
- 원래 현행 사용자 기능 smoke: `#/schedule` 월·주·일·TODO/필터/상세/권한, 기존 다른 6개 핵심 메뉴, 기존 서비스 이벤트.
- 근거 JSON: `Steam PC MVP 26.4%`는 9개 작업 영역 **검토용 추정**, 원래 72건의 **과거 24%**와 분리. 테스트 `30/30` 통과, Native `48668 exit1`, P18 GPU 도로 1px FAIL을 왜곡하지 않는다.
- 에이전트 실제 작업을 72개 행에 임의로 매핑하지 않는다. V47 `project_schedule` 및 `schedule_milestone`의 기존 72/7 데이터 변경 금지.
- JSON 공개 범위는 비밀키/로그인/세이브·주민/사용자 파일 절대 포함 금지. 권한이 필요한 상세 목록은 기존 인증 API 계약을 활용.

## 4. 안전한 OCI 롤아웃

1. 현재 OCI 런타임 및 운영 소스에 대한 배포 파이프라인과 검증 스크립트가 **실제로 존재하는지** 확인한다. 임의로 가짜 배포 명령·경로를 만들지 않는다.
2. 현재 운영 소스를 기준으로 새 **frontend만** 빌드하여 불변 태그/manifest를 생성한다. API/AI/DB는 무관하므로 무조건 전부 재빌드·재시작하지 않는다.
3. 기존 프런트 아티팩트/운영 NGINX 설정을 보존한 상태에서 별도의 후보 슬롯/이미지에 배치하고, 정적 HTML·JS/CSS 해시/경로·API 응답 확인 후 승격한다. OCI 이미지 구성 또는 서비스 변경이 불명확하면 승격하지 않는다.
4. 실제 운영 UI에서 `#/dashboard` Steam 스냅샷 표출, `운영 → Steam 개발` 상세, JSON fetch/network/반응형 렌더링을 눈으로 검증한다. **`#/schedule` 월·주·일·TODO와 사용자 인증/권한은 그대로 작동**해야 한다.
5. `/api/schedule/overview` 인증 사용자에 기존 baseline72/milestones7이 변경 없는지 검증한다. 비인증 401은 허용된 보안 동작.
6. 배포 성공은 **운영 응답 200+실제 새 마크업/JS+스크린샷+현재 이미지 digest+Schedule 회귀 PASS+rollback 확인**의 조합으로만 판정한다. GitHub merge, CI 성공, 정적 JSON만 응답 200은 실서비스 UI 완료 근거가 아니다.
7. 실패하면 기존 보존된 frontend 릴리스만 원복. 사용자 데이터/스케줄 DB를 복원·재기동할 필요가 없는 구조를 유지하고, 실행 중인 다른 프로젝트 세션은 건드리지 않는다.

## 5. 원본 72건이 더 이상 정체되지 않게 하려면

2026-10-22 보고서에는 `project_schedule` 원본 72 항목별 명세가 아니라 **집계 총량**과 `schedule_milestone` 7개, `schedule_task` 일반 TODO 0건이 기록돼 있다. 새 PM 증거는 `POST /api/schedule/agent-events`(내부 서비스 + codex-agent + schedule:ingest 권한)로 받아서 task/evidence/history를 검증·기록해야 한다.

단, 자동 에이전트가 기존 72 기준을 임의로 완료 처리하거나 `VERIFIED/DONE`을 통과시키면 안 된다. 실제 원본 72 ID가 확보된 후에만 수용조건과 최신 증거 매칭을 승인 흐름으로 처리한다. Steam MVP 추정치에는 9개 작업영역의 검토된 점수만 반영한다. 동기화가 미연결이면 최근 결과와 점수의 평가일을 표시하고 **정적 수치임을 명시**한다.

## 현재 상태 / 블로커

- GitHub PR #17 CI 통과 및 재사용 가능한 UI/가중 모델/검증 스크립트 존재.
- OCI 프런트 실제 운영 소스·SSH/배포 실행기가 이 대화의 도구에 연결되지 않았고 Remote Desktop Commander 월간 호출이 차단되어 **현장 포팅/실서비스 승격/운영 UI 검증 미실행**.
- 정직한 다음 단계: 현재 운영 배포 작업자가 이 계약을 받아 실제 OCI 배포 출처를 확인하고, 현행 코드에 최소 변경만 이식한 뒤 후보→검증→승격→롤백 영수증을 남기는 것.
