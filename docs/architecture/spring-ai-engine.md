# Spring AI Engine Architecture

ArchiveOS는 운영 화면과 AI/RAG 실행 계층을 분리한다.

- Node/Express backend: PM 운영, Agent 상태, Dashboard, Discord, Supabase 운영 데이터, Spring AI proxy 담당
- `archiveos-ai`: Obsidian 수집, chunking, embedding, pgvector 저장, vector search, RAG answer generation, Spring Batch Intelligent RPA 담당

## 책임 분리

```text
React Dashboard
  -> Node/Express Operations Backend
       -> archiveos-ai Spring Boot + Spring AI + Spring Batch
            -> PostgreSQL + pgvector
            -> Obsidian Markdown Vault
            -> OpenAI ChatModel / EmbeddingModel
```

### React Dashboard

- Overview, Workflows, Knowledge, History, Settings를 표시한다.
- API key, DB password, webhook URL, 로컬 vault 절대 경로를 표시하지 않는다.
- shell, MCP, Codex, process control을 직접 실행하지 않는다.

### Node/Express Operations Backend

- 기존 PM 운영 API와 Supabase 기반 운영 데이터를 유지한다.
- RAG 및 Intelligent RPA 요청은 `archiveos-ai`로 proxy한다.
- `archiveos-ai`가 꺼져 있으면 fake healthy를 반환하지 않고 HTTP 503 또는 명확한 unavailable 상태를 반환한다.

### archiveos-ai Spring Boot Module

- Obsidian Markdown vault를 읽는다.
- heading-aware chunking을 수행한다.
- Spring AI `EmbeddingModel`로 embedding을 생성한다.
- PostgreSQL + pgvector에 chunk와 vector를 저장한다.
- cosine similarity search를 수행한다.
- Spring AI `ChatModel`로 references 기반 답변을 생성한다.
- Spring Batch Job으로 Intelligent RPA 작업을 분류하고 PM 승인 필요 여부를 기록한다.

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

## Spring Batch Intelligent RPA

`archiveos-ai`는 Node/Express에 남아 있던 batch/scheduler 책임을 Spring 쪽으로 이전하기 위한 첫 단계로 `archiveosRpaClassifyJob`을 제공한다.

이 Job은 실제 shell, MCP, Codex, git, 배포 명령을 실행하지 않는다. 대신 PM 승인 전에 작업을 분류하고 위험도와 권장 조치를 DB에 기록한다.

### API

- `POST /api/rpa/classify`
- `GET /api/rpa/tasks/recent`
- `GET /api/rpa/tasks/{id}`
- `POST /api/rpa/tasks/{id}/decision`

### 저장 테이블

- `archiveos_rpa_tasks`
- `archiveos_rpa_decisions`

주요 필드:

- `status`
- `category`
- `risk_level`
- `recommendation`
- `approval_required`
- `classification_source`
- `metadata`

### 상태 흐름

```text
queued
  -> Spring Batch archiveosRpaClassifyJob
  -> running
  -> pm_approval_required
  -> approved | rejected | hold | queued(request_retry)
```

Spring AI ChatModel이 설정되어 있으면 AI 분류를 사용한다. ChatModel이 없거나 호출이 실패하면 rule-based fallback을 사용하되 `classification_source`에 이를 기록한다.

위험 실행, 배포, destructive DB 작업, secret/token 노출 가능성이 감지되면 `risk_level=high`, `recommendation=PM_APPROVAL_REQUIRED`로 기록한다.

## API

`archiveos-ai` API:

- `GET /api/health`
- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
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
- `POST /api/rpa/classify`
- `GET /api/rpa/tasks/recent`
- `GET /api/rpa/tasks/:id`
- `POST /api/rpa/tasks/:id/decision`

## Runtime Observability

`GET /api/ai/runtime`은 추정값이 아니라 `archiveos-ai`가 관측한 실제 상태를 반환한다.

반환 항목:

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

`POST /api/ai/runtime/check`는 명시적으로 호출될 때만 실제 ChatModel/EmbeddingModel smoke check를 수행한다.

## Vector Database

기본 로컬 개발 환경은 Docker Compose PostgreSQL + pgvector다.

- image: `pgvector/pgvector:pg16`
- database: `archiveos`
- tables:
  - `public.obsidian_documents`
  - `public.obsidian_chunks`
  - `public.archiveos_rpa_tasks`
- embedding column:
  - `embedding vector(1536)`
- index:
  - HNSW cosine index
- function:
  - `public.match_obsidian_chunks(query_embedding vector(1536), match_count integer)`

Supabase PostgreSQL + pgvector는 운영 또는 원격 검증용 선택지로 유지한다.

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
- `/api/rag/ask`가 answer + references 반환
- `/api/rpa/classify`가 Spring Batch Job 결과 반환
- `/api/rpa/tasks/{id}/decision`이 PM decision record를 저장
- Node backend proxy 성공

## Security Boundaries

- `OPENAI_API_KEY`는 frontend에 노출하지 않는다.
- DB password와 전체 DB URL은 API 응답에 포함하지 않는다.
- 로컬 Obsidian vault 절대 경로는 frontend에 노출하지 않는다.
- RAG 실패 시 fake success가 아니라 unavailable/degraded 상태로 반환한다.
- RPA classify는 실행이 아니라 판단 기록이며, 위험 작업은 PM 승인 전 실행하지 않는다.
- RPA decision API도 실행이 아니라 승인/반려/보류/재시도 상태와 사유를 기록한다.
