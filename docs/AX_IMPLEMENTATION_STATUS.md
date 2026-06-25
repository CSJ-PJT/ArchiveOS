# ArchiveOS AX Implementation Status

Baseline commit before this phase:

- `3d1b89d9c8c0fd97d5ca3a244de694323fafa05e`

Current responsibility split:

- Node/Express backend: PM operations, Agent state, MCP visibility, Dashboard, Discord, existing Supabase operational data.
- `archiveos-ai` Spring Boot module: Obsidian ingestion, Markdown chunking, embedding, pgvector storage, vector search, RAG answer generation, future AI Agent layer.

## Implemented

### Spring AI module

- Java 21 Spring Boot service: `archiveos-ai`
- Gradle Wrapper included: `archiveos-ai/gradlew`, `archiveos-ai/gradlew.bat`
- Spring AI BOM configured
- OpenAI ChatModel dependency configured
- OpenAI EmbeddingModel dependency configured
- PgVectorStore dependency configured
- Runtime status endpoint:
  - `GET /api/health`
  - `GET /api/ai/runtime`

### Obsidian ingestion

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- Reads local Markdown vault from `OBSIDIAN_VAULT_PATH`
- Heading-aware Markdown chunking
- Code-block aware section splitting
- Content hash based incremental sync
- Re-indexes changed documents only

### Vector RAG

- Embeds chunks with Spring AI `EmbeddingModel`
- Stores embeddings in `public.obsidian_chunks.embedding vector(1536)`
- Uses PostgreSQL / pgvector cosine similarity search
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
- RAG answers are generated through Spring AI `ChatModel`
- Answers include references:
  - title
  - path
  - heading
  - score

### Safe disabled mode

- If `OPENAI_API_KEY` is missing:
  - server startup still succeeds
  - RAG sync/search/ask returns HTTP 503
  - no fake successful RAG answer is returned

### Database

Default development Vector DB:

- Docker Compose PostgreSQL + pgvector
- `docker-compose.yml` starts `pgvector/pgvector:pg16`
- `archiveos-ai` connects to the compose `postgres` service
- `./docs` is mounted as `/vault` by default

Optional production-like Vector DB:

- Supabase PostgreSQL + pgvector

Schema includes:

- `public.obsidian_documents`
- `public.obsidian_chunks`
- HNSW cosine index
- `public.match_obsidian_chunks(query_embedding vector(1536), match_count integer)`

### Node backend integration

Node/Express no longer owns RAG logic.

The existing Node endpoints now proxy to `archiveos-ai`:

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search`
- `POST /api/rag/ask`

Set:

```bash
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
```

## Required environment

For real RAG execution:

```bash
OPENAI_API_KEY=
OBSIDIAN_VAULT_PATH=
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
```

Supabase PostgreSQL is the recommended default target for production-like use.

## Validation status

Completed locally:

- `npm run test`
- `npm run build`
- `cd backend && npm run test`
- `cd backend && npm run typecheck`
- `cd backend && npm run build`
- `cd archiveos-ai && .\gradlew.bat test --no-daemon`
- `cd archiveos-ai && .\gradlew.bat bootJar --no-daemon`
- `archiveos-ai` jar startup smoke test
- `POST /api/rag/ask` without key returns HTTP 503
- OpenAI ChatModel smoke call succeeded with the configured local `OPENAI_API_KEY`
- OpenAI EmbeddingModel smoke call succeeded and returned 1536 dimensions
- Obsidian vault path was found through local backend env and copied to `archiveos-ai/.env`
- Obsidian vault exists and contains Markdown files
- Obsidian vault auto-discovery was implemented in `archiveos-ai`
- Local auto-discovery selected the project `docs` directory as the highest-scoring ArchiveOS AX/RAG Markdown vault
- OpenAI ChatModel smoke call succeeded again after vault discovery changes
- OpenAI EmbeddingModel smoke call succeeded again and returned 1536 dimensions

Blocked locally:

- pgvector sync/search/RAG storage cannot complete until a reachable PostgreSQL/pgvector connection is configured.
- `localhost:5432` was not reachable.
- Direct Supabase database host/password were not available in local env files.
- Supabase API URL and service role exist for the Node backend, but Spring JDBC requires direct PostgreSQL settings:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
- `DB_PASSWORD`

Not executable in this local environment:

- Docker build / compose execution, because `docker` is not installed or not on PATH.

Expected Docker development flow:

```bash
cp .env.example .env
# set OPENAI_API_KEY in .env
docker compose up --build
curl -X POST http://localhost:4100/api/obsidian/sync
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
```

Static Docker assets are present:

- root frontend `Dockerfile`
- backend `Dockerfile`
- `archiveos-ai/Dockerfile`
- `docker-compose.yml`

## Spring AI Runtime Observability

`archiveos-ai`는 `GET /api/ai/runtime`으로 실제 runtime telemetry를 반환한다.

반환 항목:

- Spring Boot 상태와 버전
- Spring AI 상태와 버전
- ChatModel 설정 여부, Bean 사용 가능 여부, 최근 호출 성공/실패
- EmbeddingModel 설정 여부, Bean 사용 가능 여부, 차원, 최근 호출 성공/실패
- PostgreSQL 연결 상태
- pgvector extension 설치 여부
- vector index 존재 여부와 index 방식
- `obsidian_documents` 실제 행 수
- `obsidian_chunks` 실제 행 수
- embedded/pending/failed chunk 수
- 마지막 sync 시각
- 최근 RAG search/ask/sync 시각
- 최근 RAG latency
- 최근 reference 수

`POST /api/ai/runtime/check`는 명시적으로 호출할 때만 ChatModel과 EmbeddingModel smoke check를 수행한다.

Node backend는 다음 endpoint를 proxy한다.

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`

React Overview와 Knowledge 화면은 Spring AI Engine 지표를 이 runtime API에 연결한다.

더 이상 사용하지 않는 대체값:

- Embeddings = Knowledge Graph totalNodes
- Vector Index = Knowledge Graph totalEdges 존재 여부
- References = Knowledge Graph totalEdges
- Last RAG Check = AX readiness generatedAt
- pgvector status = Knowledge relation count
- ChatModel/EmbeddingModel status = endpoint 존재 여부

## Remaining work

- Run real Obsidian sync with a configured vault.
- Verify Supabase pgvector connection with real DB credentials.
- Verify real OpenAI embeddings and ChatModel answer generation with `OPENAI_API_KEY`.
- Add richer integration tests using Testcontainers or a dedicated pgvector test database.
