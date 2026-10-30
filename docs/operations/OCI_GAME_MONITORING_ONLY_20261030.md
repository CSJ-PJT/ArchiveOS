# 2026-10-30 최상위 사용자 수정 — DeepStake는 기존 "개발 관제"에만

## 직접 확인한 현재 운영 구조

2026-10-30 11:03 KST 연결된 운영 브라우저의 ArchiveOS 왼쪽 내비게이션에는 **"개발 관제"** 메뉴가 이미 존재한다. 설명은 "DeepStake 개발 상태를 읽기 전용으로 확인합니다."이고, 별개로 **대시보드 / 서비스 / 운영 / 일정 / 재무 / 기록 / 메일 / 설정** 메뉴도 있다. 사용자는 현재 채용 관련 업무를 하고 있으며, **게임 개발 정보가 메인 대시보드와 운영 탭에 섞이는 것을 명확히 철회**했다.

- 이 PR #17의 기존 개발 코드가 구형 Github main을 기준으로 `ConsoleDashboardPage.tsx`에 `<DeepStakeProgressBoard compact />`를 삽입하고, `ConsoleOperationsPage.tsx`에 "Steam 개발" 탭을 만들었던 것은 **잘못된 배치**였다.
- 2026-10-30 PR #17의 새 커밋에서 두 위치의 import·JSX·탭 타입/항목을 실제 제거했다. `scripts/test-deepstake-progress.mjs`는 이 배치를 다시 만들면 테스트가 실패하도록 변경했다.
- 실제 운영판은 GitHub main(2026-07-31)과 달리 2026-10-22 이후의 **SchedulePage/V47**와 2026-10-30까지의 **Mail** 및 **개발 관제** 기능을 포함한다. PR #17 전체를 오래된 main 기준으로 직접 병합해 OCI에 덮어씌우면 운영 기능 롤백 위험이 크다.
- 본 지시가 닿은 범위: GitHub PR #17 브랜치, CI. 운영 OCI의 최신 로컬 소스/서버 SSH 권한은 이 ChatGPT chat에 연결되지 않음(Desktop Commander 잔여 원격 사용량 0%). **브랜치 변경=운영 배포 아님**.

## 최신 OCI 소스의 단일 개발 관제 메뉴만 수정

**전체 수정은 현재 운영 소스 단일 소유자에서 수행할 것.** 사용자가 실행 중인 채용·Mail·Schedule/일정·재무/핵심 메뉴·기존 auth/API/DB는 변경하지 않는다.

1. 실제 OCI에 배포된 최신 소스의 branch/HEAD/dirty state와 배포 소유자/프로세스 락을 우선 확인. 이미 게임 관제 이식 작업이 진행 중이면 중복 수정/배포하지 않는다.
2. `rg -n -F "DEVELOPMENT / RELEASE" src`, `rg -n -F "전체 목표 구현률" src`, `rg -n "개발 관제|DeepStake" src`로 현행 **게임 개발 관제** 컴포넌트와 route/navigation을 찾는다. 해당 파일이 정확한 원본이며 GitHub main에 없을 수 있다. 사용자가 현재 보고 있는 화면과 컴포넌트 경로를 실제 확인한다.
3. 기존 `src/pages/ConsoleDashboardPage.tsx`에 DeepStakeProgressBoard import나 JSX가 남아 있으면 **제거**, `src/pages/ConsoleOperationsPage.tsx`의 추가 게임 탭과 import도 **제거**. 다른 `src/pages`에서 게임 진행 위젯이 중복 노출되지 않도록 검증.
4. 기존 전용 **"개발 관제"** route의 화면에 **하나**의 `DeepStakeProgressBoard`(PR #17의 `src/components/console/DeepStakeProgressBoard.tsx`, `src/components/console/deepstake-progress.css`, `src/lib/deepstakeProgress.ts`)를 연결. 새 내비게이션/탭/중복 게임 관제 페이지 추가 금지. 기존 `DEVELOPMENT / RELEASE` 화면의 소스·테스트·실행 상태와 합쳐 단일 페이지에서 직관적으로 표시. 원래 개발 관제 기능을 통째로 삭제하지 않는다.
5. `public/deepstake-progress.json`은 9영역 가중 추정 및 과거72 기준과 개발자 자체 보고를 구분한다. 현재 공개 배포 스냅샷은 v271 시점 평가값 26.4%를 기반으로 하므로 최신 개발 성과/자체 검증은 원본 영수증에 따라 시간/빌드별로 별도 기록. 전체 게임 완성률과 독립 QA 승격은 금지. 현재 기준선 72개 개별 ID 미복원 표시는 정직하게 유지하되 **가중 MVP 추정치·근거 그래프**가 반드시 표출되어야 한다.
6. 전용 페이지 실제 GUI 수용: 개발 추정치·9영역 막대/가중치·72건 상태 분포·최근 native/Windows 테스트·독립 QA 6 게이트/출시 차단·변경 이력·마지막 검증 시각. 모든 데이터는 운영 프로덕션에서 독립 QA/단순 Codex 합성 테스트 출처가 정확히 구별되어야 한다.
7. `npm ci && npm test && npm run build` 후 다음 **라우트 스코프 회귀**를 실행: **메인 대시보드에 DeepStake/Steam 진행 수치·그래프 0, 운영 일반 탭 중복 0, 개발 관제에만 새 그래프 1세트**. 실제 로그인 세션/모바일 레이아웃/화면 크기에서도 확인.
8. 현재 릴리스의 frontend 이미지를 불변 digest/태그로 보존하고 **프런트엔드만** 후보 빌드. 현행 운영 소스/승인된 기존 OCI 릴리스 스크립트로 후보 배포→라우트·인증·기능 smoke→승격. Docker 전체 재시작/DB 마이그레이션/AI·백엔드 리빌드/구형 main 덮어쓰기 금지. 어떤 server script가 실제 운영인지 모르면 추측해서 배포하지 말 것.
9. 운영 검증: `https://archiveos.kr/#/dashboard` 정상·게임 위젯 0, `https://archiveos.kr/#/operations` 일반 운영 정상·게임 탭 0, **실제 존재하는 '개발 관제' 메뉴의 route**에서 게임 영역 그래프 표시 확인, `/deepstake-progress.json` HTTP 200 application/json + schema/시각, `#/schedule` TODO/7마일스톤, `#/mail` 현행 메일, `/api/health` 200, 인증된/비인증 API 권한 정합성. 메인 서비스가 기존 그대로여야 PASS.
10. 완료 영수증: 변경 파일/테스트 결과/새 frontend bundle SHA256/운영 이미지 digest/이전 릴리스 롤백 키/개발 관제·메인 대시보드·운영 메뉴 각각 실제 UI 스크린샷. **OCI 실서비스 검증 없이 완료 주장 금지.**

## PR 배포 정책

- 이 PR은 **기능·데이터·테스트를 제공하는 소스 패치 기준**이다. GitHub main(7/31)은 운영 사이트의 최신 소스가 아니므로 **PR #17을 그대로 merge/deploy 금지**.
- GUI 전용 개발 관제 페이지는 최신 OCI 로컬 소스에 존재하므로, 이 오래된 GitHub 브랜치에서 임의로 신규 route를 추가하지 않는다.
- 기존의 비공개 Source/Git 작업·사용자 채용 화면·게임 원본·메일·개인정보는 보존.
- 현장 접근 없는 GitHub Actions CI 성공은 실제 OCI UI 배포 성공과 구별.

