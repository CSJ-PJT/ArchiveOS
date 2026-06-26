# RPA Workflows UI

Workflows 화면은 PM이 작업 상태와 승인 필요 항목을 확인하는 운영 화면이다.

## 표시해야 할 정보

- Running
- Waiting
- Review
- Approval Required
- Failed
- Completed

작업 상세에는 다음 정보를 연결한다.

- Runtime Flow
- Agent
- Batch execution
- Architecture review
- RPA classification
- Reviewer verdict
- PM decision
- Retry / Approve / Reject / Hold 기록

## Spring Batch 연결

Workflows는 다음 API를 통해 batch 상태를 확인한다.

- `GET /api/batch/jobs`
- `GET /api/batch/executions`
- `GET /api/batch/executions/{id}`

수동 실행이 필요한 경우에도 UI는 실행 가능 Job만 노출해야 한다. `archiveosRpaClassifyJob`처럼 전용 파라미터가 필요한 Job은 PM task 흐름을 통해서만 실행한다.

## 직접 실행 금지

Workflows 화면은 다음 작업을 직접 실행하지 않는다.

- shell command
- MCP command
- Codex control
- process start/stop
- git push
- deployment

PM action button은 승인/반려/보류/재시도 같은 상태 기록만 수행한다.
