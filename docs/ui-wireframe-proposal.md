# UI 와이어프레임 제안

## 탭 구조

ArchiveOS는 다음 탭 구조를 기준으로 합니다.

```text
Dashboard | Decisions | Operators | Timeline | GitHub | Settings
```

## Dashboard

목적: 5초 안에 현재 상태를 판단합니다.

표시 항목:

- PM Status Snapshot
- Current Workflow State
- Live Pipeline Map
- Pipeline Warnings
- Latest Builder Result
- Latest Reviewer Result
- Screenshot Freshness 요약
- 최근 타임라인 3개

Dashboard에는 상세 프로세스 카드보다 고수준 요약을 둡니다.

## Decisions

목적: PM 결정과 승인/반려 기록을 관리합니다.

표시 항목:

- Recorded Decisions
- Record Approval
- Record Rejection
- decision count badge
- task/result/review 연결 정보
- source label

승인/반려 버튼은 기록 전용입니다. MCP나 Codex를 실행하지 않습니다.

## Operators

목적: 구현자, 리뷰어, 루프, 브리지의 실제 감지 상태를 확인합니다.

표시 항목:

- Implementer Codex card
- Reviewer Codex card
- MCP Loop card
- Reviewer Bridge card
- Queue details
- PID, CPU, detected/not detected
- latest builder result file
- latest reviewer result file
- 사람 말로 된 해석

시작/종료 버튼은 아직 두지 않습니다.

## Timeline

목적: 상태 변화의 시간 흐름을 이해합니다.

표시 항목:

- 오늘 이벤트 기본 표시
- Show more / Show less
- 상대 시간과 정확한 timestamp tooltip
- source label
- event type badge

## GitHub

목적: 향후 GitHub 연동 위치를 확보합니다.

현재는 read-only placeholder입니다.

향후 표시 예정:

- repo
- branch
- latest commit
- recent PRs
- CI status

GitHub API 호출은 명시 구현 전까지 하지 않습니다.

## Settings

목적: 로컬 설정과 보안 원칙을 안내합니다.

표시 항목:

- frontend URL
- backend URL
- Supabase configured/unknown
- `ARCHIVEOS_PROJECT_PATH`
- `CODEX_IMPLEMENTER_PID`
- `CODEX_REVIEWER_PID`
- runtime source 설명
- service role key backend-only 원칙
- commands are recording-only 원칙
- local actions are allowlisted 원칙

비밀값은 표시하지 않습니다.

## DeepStake3D 표시 방식

DeepStake3D는 별도 게임 프로젝트이므로 ArchiveOS UI에서는 다음처럼 표시합니다.

- Dashboard: 최신 작업과 verdict 요약
- Operators: 구현자/리뷰어/루프 감지 상태
- Timeline: 빌더 결과, 리뷰 결과, PM 결정 이벤트
- Decisions: milestone 승인/보류/반려 기록

Unity 실행 화면이나 게임 에디터 제어는 ArchiveOS UI에서 하지 않습니다.
