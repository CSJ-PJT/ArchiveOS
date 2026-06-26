# ArchiveOS

ArchiveOS는 AI Agent 운영, Spring Batch 기반 RPA, Obsidian/RAG 지식 엔진, PM 승인 흐름을 한 화면에서 관제하는 AX 운영 플랫폼이다.

목표는 사람이 모든 반복 운영을 직접 처리하는 구조에서 벗어나, AI와 배치 시스템이 판단 자료를 만들고 PM이 중요한 승인과 의사결정에 집중하는 구조를 만드는 것이다.

## 현재 구성

```text
React frontend
  -> Node/Express operations backend
       -> archiveos-ai Spring Boot + Spring AI + Spring Batch
            -> PostgreSQL + pgvector
            -> Obsidian Markdown Vault
            -> OpenAI ChatModel / EmbeddingModel
```

역할:

- `frontend`: Overview, Workflows, Knowledge, History, Settings 화면
- `backend`: PM 운영, Agent/runtime visibility, Discord, Supabase 운영 데이터, Spring API proxy
- `archiveos-ai`: Obsidian sync, chunking, embedding, pgvector 저장, vector search, RAG answer, Spring Batch RPA
- `postgres`: local PostgreSQL + pgvector 개발 Vector DB

## 운영 화면

### Overview

- 시스템 상태
- 현재 작업
- Queue 요약
- 승인 필요 항목
- 최근 경고
- Knowledge/RAG 요약

### Workflows

- PM task queue
- Runtime flow
- PM decision record
- Spring Batch Jobs
- Batch execution detail
- RPA decision history
- RAG health check job result

### Knowledge

- Obsidian status
- Documents / chunks / embeddings
- RAG search / answer
- Operational memory graph

### History

- Events
- Commands
- Agent runs
- Decisions
- Errors
- KPI history

### Settings

- Backend / Spring AI / Database / Docker 상태
- Discord / Supabase / Obsidian 설정 여부
- Public access
- Security
- Build information

## 현재 운영 흐름

```text
PM request
  -> Workflows
  -> RPA classify
  -> Spring Batch archiveosRpaClassifyJob
  -> PM approval history
  -> Knowledge/RAG context
```

Spring Batch 운영 Job:

- `obsidianSyncJob`: Obsidian 문서 동기화, chunking, embedding, pgvector 저장
- `ragHealthCheckJob`: Spring AI, pgvector, RAG readiness 점검
- `archiveosRpaClassifyJob`: PM task 분류와 approval gate 판단

`archiveosRpaClassifyJob`은 전용 task id가 필요하므로 Batch Jobs 화면에서 직접 실행하지 않고 RPA classify API를 통해 실행한다.

## 주요 API

### Spring AI / RAG

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=ArchiveOS&limit=5`
- `POST /api/rag/ask`

### Spring Batch

- `GET /api/batch/jobs`
- `POST /api/batch/jobs/{jobName}/run`
- `GET /api/batch/executions`
- `GET /api/batch/executions/{id}`

### RPA

- `POST /api/rpa/classify`
- `GET /api/rpa/tasks/recent`
- `GET /api/rpa/tasks/{id}`
- `POST /api/rpa/tasks/{id}/decision`

## 환경 변수

실제 secret은 커밋하지 않는다.

```env
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
DB_HOST=localhost
DB_PORT=5432
DB_NAME=archiveos
DB_USER=archiveos
DB_PASSWORD=archiveos
HOST_OBSIDIAN_VAULT_PATH=./docs
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
DISCORD_WEBHOOK_URL=
```

## Docker Compose 실행

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

정상 상태:

- `postgres`: running / healthy
- `archiveos-ai`: running
- `backend`: running
- `frontend`: running

## RAG / Batch / RPA E2E 검증

자동 검증:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1
```

이미 compose가 실행 중이면:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1 -SkipComposeUp -KeepRunning
```

수동 검증:

```powershell
curl http://localhost:4100/api/health
curl http://localhost:4100/api/ai/runtime
curl -X POST http://localhost:4100/api/ai/runtime/check
curl -X POST http://localhost:4100/api/obsidian/sync
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
curl -X POST http://localhost:4100/api/rag/ask -H "Content-Type: application/json" -d "{\"question\":\"Summarize the ArchiveOS Spring AI RAG architecture.\"}"

curl http://localhost:4100/api/batch/jobs
curl -X POST http://localhost:4100/api/batch/jobs/ragHealthCheckJob/run
curl "http://localhost:4100/api/batch/executions?limit=5"

curl -X POST http://localhost:4100/api/rpa/classify -H "Content-Type: application/json" -d "{\"title\":\"Verify RAG deployment\",\"description\":\"Check pgvector schema and deployment risk before running any shell commands.\",\"targetProject\":\"ArchiveOS\"}"
curl -X POST http://localhost:4100/api/rpa/tasks/{taskId}/decision -H "Content-Type: application/json" -d "{\"action\":\"approve\",\"reason\":\"PM approved the classification record only.\",\"decidedBy\":\"pm\"}"

curl http://localhost:4000/api/ai/runtime
curl http://localhost:4000/api/batch/jobs
```

성공 기준:

- `vectorStore.databaseConnected=true`
- `vectorStore.extensionInstalled=true`
- `vectorStore.indexReady=true`
- sync 후 documents/chunks/embeddedChunks 증가
- RAG search가 score 포함 결과 반환
- RAG ask가 answer와 references 반환
- Batch job catalog에 `obsidianSyncJob`, `ragHealthCheckJob`, `archiveosRpaClassifyJob` 표시
- `ragHealthCheckJob` 실행 이력이 Spring Batch metadata에 기록
- RPA classify가 `pm_approval_required`와 risk/recommendation 기록
- RPA decision이 `archiveos_rpa_decisions`에 기록
- API key, DB password, webhook URL, vault 절대 경로 미노출

## Test / Build

Frontend:

```powershell
npm run test
npm run build
```

Node backend:

```powershell
cd backend
npm run test
npm run typecheck
npm run build
```

Spring AI backend:

```powershell
cd archiveos-ai
.\gradlew.bat test --no-daemon
.\gradlew.bat bootJar --no-daemon
```

## 운영 원칙

- UI는 visibility-first 원칙을 유지한다.
- shell, MCP, Codex, process control은 UI에서 직접 실행하지 않는다.
- PM decision은 task state와 decision log를 기록하는 용도다.
- secret 값은 backend/local runtime에서만 사용하고 frontend에는 노출하지 않는다.
- RAG 실패 시 fake success를 반환하지 않고 unavailable/degraded 상태를 표시한다.
- 위험 작업은 PM Approval Gate 이전에 실행하지 않는다.

## 문서

- [Spring AI Engine Architecture](docs/architecture/spring-ai-engine.md)
- [Spring Batch 운영 구조](docs/architecture/spring-batch.md)
- [RPA 승인 흐름](docs/architecture/rpa-approval-flow.md)
- [RAG 점검 흐름](docs/architecture/rag-health-check-flow.md)
- [Backend Migration Plan](docs/architecture/backend-migration-plan.md)
- [RPA Workflows UI](docs/ui/rpa-workflows.md)
- [Spring AI Dashboard UI](docs/ui/spring-ai-dashboard.md)
- [Developer Guide](docs/operations/developer-guide.md)
- [AX 구현 상태](docs/AX_IMPLEMENTATION_STATUS.md)
- [전체 아키텍처](docs/ARCHITECTURE_FULL.md)

## Roadmap

- NightlyReviewJob / DailyReportJob Spring Batch 이전
- KnowledgeMaintenanceJob / PipelineAuditJob 추가
- Workflows 화면의 batch execution filter 강화
- PM Approval Gate와 future execution boundary 강화
- MCP/Tool execution allowlist 설계
