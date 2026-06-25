# ArchiveOS AX 구현 상태

현재 ArchiveOS는 PM 운영 backend와 Spring AI RAG engine을 분리한 AX knowledge platform foundation 단계다.

## 책임 분리

- Node/Express backend: PM 운영, Agent 상태, MCP visibility, Dashboard, Discord, Supabase 운영 데이터, Spring AI proxy.
- `archiveos-ai` Spring Boot module: Obsidian ingestion, heading-aware chunking, embedding, pgvector storage, vector search, RAG answer generation, 향후 AI Agent layer.

## 구현 완료

### Spring AI module

- Java 21 Spring Boot service: `archiveos-ai`
- Gradle Wrapper 포함
- Spring AI BOM 구성
- OpenAI ChatModel dependency 구성
- OpenAI EmbeddingModel dependency 구성
- PgVectorStore dependency 구성
- Runtime API:
  - `GET /api/health`
  - `GET /api/ai/runtime`
  - `POST /api/ai/runtime/check`

### Obsidian ingestion

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- local Markdown vault 읽기
- heading-aware chunking
- content hash 기반 증분 sync
- 변경 문서만 재색인

### Vector RAG

- Spring AI `EmbeddingModel`로 chunk embedding 생성
- `public.obsidian_chunks.embedding vector(1536)` 저장
- PostgreSQL/pgvector cosine similarity search
- HNSW cosine index
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
- Spring AI `ChatModel` 기반 답변 생성
- references 반환:
  - title
  - path
  - heading
  - score

### Safe disabled mode

- `OPENAI_API_KEY`가 없어도 서버 시작은 가능하다.
- RAG sync/search/ask는 HTTP 503 또는 명확한 unavailable 상태를 반환한다.
- fake success 응답은 반환하지 않는다.

### Database

기본 로컬 개발 Vector DB:

- Docker Compose PostgreSQL + pgvector
- image: `pgvector/pgvector:pg16`
- `archiveos-ai`는 compose 내부에서 `postgres` host로 연결
- `./docs`는 기본 vault로 `/vault`에 read-only mount

선택 가능한 원격 DB:

- Supabase PostgreSQL + pgvector

Schema:

- `public.obsidian_documents`
- `public.obsidian_chunks`
- HNSW cosine index
- `public.match_obsidian_chunks(query_embedding vector(1536), match_count integer)`

### Node backend integration

Node/Express backend는 RAG를 직접 구현하지 않고 `archiveos-ai`로 proxy한다.

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search`
- `POST /api/rag/ask`

`archiveos-ai`가 꺼져 있으면 fake healthy 대신 HTTP 503을 반환한다.

### Frontend integration

Overview와 Knowledge 화면은 `/api/ai/runtime`의 실제 telemetry를 사용한다.

더 이상 사용하지 않는 대체값:

- Embeddings = Knowledge Graph totalNodes
- Vector Index = Knowledge Graph totalEdges 여부
- References = Knowledge Graph totalEdges
- Last RAG Check = AX readiness generatedAt
- pgvector status = Knowledge relation count
- ChatModel/EmbeddingModel status = endpoint 존재 여부

## 검증 완료

최근 로컬 검증:

- `docker --version`: Docker 29.5.3
- `docker compose version`: v5.1.4
- `docker info`: 성공
- `docker compose up --build -d`: 성공
- `postgres`: running / healthy
- `archiveos-ai`: running
- `backend`: running
- `frontend`: running
- pgvector extension: `vector 0.8.3`
- vector index: HNSW
- Obsidian sync: 15 documents scanned
- chunk/embedding: 107 chunks, 107 embedded chunks
- vector search: score 포함 결과 반환
- RAG ask: answer + 5 references 반환
- runtime telemetry: lastSearchAt, lastAskAt, latency, reference count 기록
- Node proxy `GET /api/ai/runtime`: 정상

테스트/빌드:

- `npm run test`: 성공
- `npm run build`: 성공
- `cd backend && npm run test`: 성공
- `cd backend && npm run typecheck`: 성공
- `cd backend && npm run build`: 성공
- `cd archiveos-ai && .\gradlew.bat test --no-daemon`: 성공
- `cd archiveos-ai && .\gradlew.bat bootJar --no-daemon`: 성공

## Docker 기반 검증 절차

```powershell
docker compose config
docker compose up --build -d
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1 -KeepRunning
```

`verify-rag-e2e.ps1`는 secret 노출을 막기 위해 compose config 원문을 출력하지 않고 성공 여부만 표시한다.

성공 기준:

- PostgreSQL container running
- `vector` extension installed
- obsidian tables/index present
- Obsidian sync creates documents/chunks
- embedding vectors stored
- vector similarity search returns scored references
- `/api/rag/ask` returns answer + references
- Node proxy returns Spring AI runtime data

## 남은 개선 항목

- RAG 답변/문서 인코딩이 콘솔 환경에서 깨져 보이는 경우 PowerShell 출력 인코딩을 UTF-8로 고정한다.
- Obsidian vault 문서의 원본 인코딩이 섞여 있는 경우 UTF-8 정규화 절차를 추가한다.
- Spring AI runtime check 결과를 UI에서 수동 점검 버튼과 더 명확히 연결한다.
