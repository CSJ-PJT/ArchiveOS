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
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
- Spring AI `ChatModel` 기반 답변 생성
- references 반환:
  - title
  - path
  - heading
  - score

### Safe disabled mode

- `OPENAI_API_KEY`가 없으면 서버 시작은 가능하다.
- RAG sync/search/ask는 HTTP 503 또는 명확한 unavailable 상태를 반환한다.
- fake success 응답을 반환하지 않는다.

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

- `npm run test`
- `npm run build`
- `cd backend && npm run test`
- `cd backend && npm run typecheck`
- `cd backend && npm run build`
- `cd archiveos-ai && .\gradlew.bat test --no-daemon`
- `cd archiveos-ai && .\gradlew.bat bootJar --no-daemon`
- `archiveos-ai` jar startup smoke test
- `POST /api/rag/ask` without key returns HTTP 503
- OpenAI ChatModel smoke call 성공
- OpenAI EmbeddingModel smoke call 성공, 1536 dimensions 확인
- Obsidian vault auto-discovery 구현
- project `docs` 디렉터리를 기본 local vault로 사용 가능
- `archiveos-ai` 미실행 상태에서 Node proxy `GET /api/ai/runtime` HTTP 503 확인
- `archiveos-ai` 미실행 상태에서 Node proxy `POST /api/ai/runtime/check` HTTP 503 확인

## 이번 Docker 진단 결과

현재 로컬 세션에서 확인한 Docker 상태:

- `C:\Program Files\Docker\Docker\resources\bin\docker.exe`: 없음
- `C:\Program Files\Docker\Docker\Docker Desktop.exe`: 없음
- `C:\ProgramData\DockerDesktop`: 없음
- 사용자 PATH 내 Docker 경로: 없음
- 시스템 PATH 내 Docker 경로: 없음
- Docker 관련 Windows service: 없음
- WSL 배포판: 설치되지 않음
- `where docker`: 실패
- `where docker-compose`: 실패
- Chocolatey는 설치되어 있으나 현재 PowerShell은 관리자 권한이 아님
- `choco install docker-desktop -y`는 `C:\ProgramData\chocolatey\lib\docker-desktop` 접근 권한 부족으로 실패

따라서 현재 세션에서는 실제 `docker compose up` 기반 pgvector E2E 검증을 실행할 수 없다.

## Docker 설치 후 검증 절차

관리자 PowerShell에서 Docker Desktop을 설치한다.

```powershell
choco install docker-desktop -y
```

Docker Desktop 실행 후:

```powershell
docker --version
docker compose version
docker info
```

ArchiveOS 루트에서:

```powershell
docker compose config
docker compose up --build -d
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1 -KeepRunning
```

성공 기준:

- `postgres` container running
- `archiveos-ai` container running
- `backend` container running
- `frontend` container running 또는 접근 가능
- pgvector extension installed
- obsidian tables/index present
- Obsidian sync creates documents/chunks
- embedding vectors stored
- vector similarity search returns scored references
- `/api/rag/ask` returns answer + references
- Node proxy returns Spring AI runtime data

## 남은 검증 항목

Docker Desktop 설치 후 다음 항목을 실제 실행으로 확인해야 한다.

- `docker compose config`
- `docker compose up --build -d`
- PostgreSQL + pgvector container health
- `/api/obsidian/sync`
- embedding 저장
- vector search
- `/api/rag/ask`
- Node proxy 정상/503 전환
- frontend Overview/Knowledge 실제 runtime 표시
