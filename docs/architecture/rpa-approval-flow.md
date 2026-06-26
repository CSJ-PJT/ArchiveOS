# RPA 승인 흐름

ArchiveOS RPA는 자동 실행 엔진이 아니라 PM 승인 전 판단과 기록을 담당하는 운영 레이어다.

## 흐름

```text
PM task
  -> POST /api/rpa/classify
  -> archiveosRpaClassifyJob
  -> archiveos_rpa_tasks
  -> PM decision required
  -> approve | reject | hold | request_retry
  -> archiveos_rpa_decisions
```

## 저장 데이터

`archiveos_rpa_tasks`

- title
- description
- target_project
- status
- category
- risk_level
- recommendation
- approval_required
- summary
- classification_source
- metadata

`archiveos_rpa_decisions`

- task_id
- action
- reason
- decided_by
- previous_status
- next_status
- metadata

## 화면

Workflows 화면의 `RPA Decision History` 영역에서 최근 RPA task와 PM decision history를 확인한다.

## 안전 원칙

- approve/reject/hold/retry는 상태와 이력을 기록한다.
- Codex, MCP, shell, process, deployment, git push를 실행하지 않는다.
- rejected task는 reason이 필요하다.
- failed task는 자동 retry하지 않는다.
