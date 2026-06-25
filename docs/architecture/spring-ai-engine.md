# Spring AI Engine Architecture

ArchiveOS는 운영 화면과 AI/RAG 실행 계층을 분리한다. Node/Express backend는 PM 운영과 Agent 상태를 담당하고, `archiveos-ai` Spring Boot 모듈은 Obsidian 지식 수집, embedding, pgvector 저장, vector search, RAG answer generation을 담당한다.

## 책임 분리

```text
React Dashboard
  -> Node/Express Operations Backend
       -> archiveos-ai Spring Boot + Spring AI
            -> PostgreSQL + pgvector
            -> Obsidian Markdown Vault
            -> OpenAI ChatModel / EmbeddingModel
```

### React Dashboard

- Overview, Workflows, Knowledge, History, Settings를 표시한다.
- API key, DB password, webhook URL, 로컬 vault 절대 경로를 표시하지 않는다.
- shell, MCP, Codex, process control을 직접 실행하지 않는다.

### Node/Express Operations Backend

- PM operations, Agent/runtime visibility, Discord notifications, Supabase 운영 이력, Task Queue 상태를 담당한다.
- RAG 관련 요청은 `archiveos-ai`로 proxy한다.
- `archiveos-ai`가 꺼져 있으면 fake healthy 응답 대신 HTTP 503과 unavailable 상태를 반환한다.

### archiveos-ai Spring Boot Module

- Obsidian Markdown vault를 읽는다.
- heading-aware chunking을 수행한다.
- Spring AI `EmbeddingModel`로 embedding을 생성한다.
- PostgreSQL + pgvector에 chunk와 vector를 저장한다.
- cosine similarity search를 수행한다.
- Spring AI `ChatModel`로 references 기반 답변을 생성한다.

## RAG Flow

```text
Markdown
  -> Heading-aware chunking
  -> EmbeddingModel
  -> VectorStore / pgvector
  -> Retriever
  -> ChatModel
  -> Answer + References
```

## API

`archiveos-ai`가 제공하는 주요 API:

- `GET /api/health`
- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`

Node backend proxy:

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search`
- `POST /api/rag/ask`

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

`POST /api/ai/runtime/check`는 명시적으로 호출할 때만 실제 ChatModel/EmbeddingModel smoke check를 수행한다. Overview 화면 조회만으로 유료 모델 호출이 발생하지 않는다.

## Vector Database

기본 로컬 개발 환경은 Docker Compose PostgreSQL + pgvector다.

- image: `pgvector/pgvector:pg16`
- database: `archiveos`
- tables:
  - `public.obsidian_documents`
  - `public.obsidian_chunks`
- embedding column:
  - `embedding vector(1536)`
- index:
  - HNSW cosine index
- function:
  - `public.match_obsidian_chunks(query_embedding vector(1536), match_count integer)`

Supabase PostgreSQL + pgvector는 운영 또는 원격 검증용 선택지로 유지한다.

## Docker E2E 검증

Docker Desktop이 설치되어 있고 `docker info`가 성공하면 아래 명령으로 전체 RAG 흐름을 검증한다.

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
- Node backend proxy 성공

## Security Boundaries

- `OPENAI_API_KEY`는 frontend에 노출하지 않는다.
- DB password와 전체 DB URL은 API 응답에 포함하지 않는다.
- 로컬 Obsidian vault 절대 경로는 frontend에 노출하지 않는다.
- RAG 실패는 fake success가 아니라 unavailable/degraded 상태로 반환한다.
- ArchiveOS UI는 visibility-first 원칙을 유지한다.

## RAG Ready 기준

다음 조건이 충족될 때 RAG ready로 판단한다.

- OpenAI API key가 설정되어 있다.
- ChatModel Bean을 사용할 수 있다.
- EmbeddingModel Bean을 사용할 수 있다.
- PostgreSQL에 연결된다.
- pgvector extension과 vector index가 준비되어 있다.
- Obsidian sync가 documents/chunks를 생성했다.
- embedding이 저장된 chunk가 있다.
- vector search가 scored references를 반환한다.
- `/api/rag/ask`가 answer와 references를 반환한다.
