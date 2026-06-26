# Spring Batch 운영 구조

ArchiveOS는 반복 가능한 운영 작업을 Spring Batch Job/Step으로 이동한다.

## 목표

- 배치 실행 이력을 Spring Batch metadata schema에 남긴다.
- RAG sync, RAG health check, RPA classification을 독립 Job으로 실행한다.
- PM 승인 전 위험 작업은 실제 실행하지 않는다.
- Node backend는 batch 실행 주체가 아니라 proxy와 운영 화면 API 역할만 유지한다.

## 현재 Job

| Job | 역할 | 범용 실행 |
| --- | --- | --- |
| `obsidianSyncJob` | Obsidian Markdown sync, chunking, embedding, pgvector 저장 | 가능 |
| `ragHealthCheckJob` | Spring AI, pgvector, RAG readiness 관측 | 가능 |
| `archiveosRpaClassifyJob` | PM task 분류와 승인 필요 여부 판단 | 전용 API만 가능 |

`archiveosRpaClassifyJob`은 `rpaTaskId` JobParameter가 필요하므로 `/api/batch/jobs/{jobName}/run`에서 직접 실행하지 않는다.

## API

Spring:

- `GET /api/batch/jobs`
- `POST /api/batch/jobs/{jobName}/run`
- `GET /api/batch/executions?limit=20`
- `GET /api/batch/executions/{id}`

Node proxy:

- `GET /api/batch/jobs`
- `POST /api/batch/jobs/:jobName/run`
- `GET /api/batch/executions?limit=20`
- `GET /api/batch/executions/:id`

## 안전 원칙

- batch API는 Codex, MCP, shell, git, deployment를 실행하지 않는다.
- secret은 JobExecution exit description과 API 응답에서 마스킹한다.
- 유료 OpenAI smoke check는 `POST /api/ai/runtime/check`에서만 수행한다.
- `ragHealthCheckJob`은 runtime telemetry 조회만 수행한다.

## 향후 이전 대상

- NightlyReviewJob
- DailyReportJob
- KnowledgeMaintenanceJob
- PipelineAuditJob
- DiscordDailyReportJob
- RuntimeSnapshotJob
