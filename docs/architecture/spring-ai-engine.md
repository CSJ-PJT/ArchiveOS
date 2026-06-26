# Spring AI Engine Architecture

ArchiveOS는 운영 화면과 AI/RAG 실행 계층을 분리한다.

```text
React frontend
  -> Node/Express operations backend
       -> archiveos-ai Spring Boot + Spring AI + Spring Batch
            -> PostgreSQL + pgvector
            -> Obsidian Markdown Vault
            -> OpenAI ChatModel / EmbeddingModel
```

## 책임 분리

### React frontend

- Overview, Workflows, Knowledge, History, Settings 화면을 제공한다.
- API key, DB password, webhook URL, 로컬 vault 절대 경로를 표시하지 않는다.
- shell, MCP, Codex, process control을 직접 실행하지 않는다.

### Node/Express operations backend

- PM 운영 API, Agent 상태, Discord, Supabase 운영 데이터를 유지한다.
- RAG, Spring Batch, Intelligent RPA 요청은 `archiveos-ai`로 proxy한다.
- `archiveos-ai`가 꺼져 있으면 fake healthy 대신 unavailable/proxy error를 반환한다.

### archiveos-ai Spring Boot module

- Obsidian Markdown vault를 읽는다.
- heading-aware chunking을 수행한다.
- Spring AI `EmbeddingModel`로 chunk embedding을 생성한다.
- PostgreSQL + pgvector에 chunk와 vector를 저장한다.
- cosine similarity search를 수행한다.
- Spring AI `ChatModel`로 references 기반 RAG 답변을 생성한다.
- Spring Batch Job으로 RPA 분류와 운영성 점검 작업을 실행한다.

## RAG Flow

```text
Markdown
  -> Heading-aware chunking
  -> EmbeddingModel
  -> pgvector
  -> Vector Search
  -> ChatModel
  -> Answer + References
```

## Runtime Observability

`GET /api/ai/runtime`은 추정값이 아니라 `archiveos-ai`가 실제로 관측한 상태를 반환한다.

포함 항목:

- Spring Boot 상태와 version
- Spring AI 상태와 version
- ChatModel configured/beanAvailable/lastCallSucceeded/lastError
- EmbeddingModel configured/beanAvailable/dimensions/lastCallSucceeded/lastError
- PostgreSQL databaseConnected
- pgvector extensionInstalled
- vector indexReady/indexType
- Obsidian document/chunk/embedding/pending/failed count
- 최근 sync/search/ask 시각
- 최근 latency
- 최근 reference count

`POST /api/ai/runtime/check`는 명시적으로 호출할 때만 실제 ChatModel/EmbeddingModel smoke check를 수행한다.

## Spring Batch 운영 Job

`archiveos-ai`는 Spring Batch를 사용해 반복 가능한 운영 작업을 Job/Step 단위로 관리한다.

현재 Job:

- `archiveosRpaClassifyJob`
  - PM 작업 설명을 RPA task로 저장하고 분류한다.
  - 전용 파라미터가 필요하므로 범용 실행 API에서는 직접 실행할 수 없다.
- `obsidianSyncJob`
  - Obsidian 문서를 읽고 chunking, embedding, pgvector 저장을 수행한다.
- `ragHealthCheckJob`
  - 유료 모델 호출 없이 runtime/DB/vector/RAG readiness 상태를 관측한다.

운영 API:

- `GET /api/batch/jobs`
- `POST /api/batch/jobs/{jobName}/run`
- `GET /api/batch/executions`
- `GET /api/batch/executions/{id}`

## Intelligent RPA

RPA classify는 실행이 아니라 판단과 기록 단계다.

```text
queued
  -> Spring Batch archiveosRpaClassifyJob
  -> running
  -> pm_approval_required
  -> approved | rejected | hold | queued(request_retry)
```

저장 테이블:

- `archiveos_rpa_tasks`
- `archiveos_rpa_decisions`

직접 실행하지 않는 항목:

- shell command
- MCP command
- Codex control
- process start/stop
- git push
- deployment

## API

`archiveos-ai` API:

- `GET /api/health`
- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
- `GET /api/batch/jobs`
- `POST /api/batch/jobs/{jobName}/run`
- `GET /api/batch/executions`
- `GET /api/batch/executions/{id}`
- `POST /api/rpa/classify`
- `GET /api/rpa/tasks/recent`
- `GET /api/rpa/tasks/{id}`
- `POST /api/rpa/tasks/{id}/decision`

Node backend proxy:

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search`
- `POST /api/rag/ask`
- `GET /api/batch/jobs`
- `POST /api/batch/jobs/:jobName/run`
- `GET /api/batch/executions`
- `GET /api/batch/executions/:id`
- `POST /api/rpa/classify`
- `GET /api/rpa/tasks/recent`
- `GET /api/rpa/tasks/:id`
- `POST /api/rpa/tasks/:id/decision`

## Vector Database

기본 로컬 개발 환경은 Docker Compose PostgreSQL + pgvector다.

- image: `pgvector/pgvector:pg16`
- database: `archiveos`
- embedding column: `embedding vector(1536)`
- index: HNSW cosine index
- function: `public.match_obsidian_chunks(query_embedding vector(1536), match_count integer)`

Supabase PostgreSQL + pgvector는 원격 검증 또는 운영 옵션으로 유지한다.

## Docker E2E 검증

```powershell
docker compose config
docker compose up --build -d
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1 -KeepRunning
```

검증 항목:

- PostgreSQL container running
- `vector` extension 설치
- schema/table/index 존재
- Obsidian sync 성공
- embedding 저장 성공
- vector similarity search 성공
- `/api/rag/ask` answer + references 반환
- `/api/batch/jobs` Job catalog 반환
- `ragHealthCheckJob` 실행 성공
- `/api/rpa/classify` Spring Batch Job 결과 반환
- `/api/rpa/tasks/{id}/decision` PM decision record 저장
- Node backend proxy 성공

## Security Boundaries

- `OPENAI_API_KEY`는 frontend에 노출하지 않는다.
- DB password와 전체 DB URL은 API 응답에 포함하지 않는다.
- 로컬 Obsidian vault 절대 경로는 frontend에 노출하지 않는다.
- RAG 실패 시 fake success가 아니라 unavailable/degraded 상태를 반환한다.
- RPA classify는 실행이 아니라 판단 기록이다.
- RPA decision API는 승인/반려/보류/재시도 상태와 사유만 기록한다.
