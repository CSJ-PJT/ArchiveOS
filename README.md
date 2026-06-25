# ArchiveOS

ArchiveOS는 Spring Boot 3 + Spring AI 중심의 AX 운영 플랫폼이다. PM 운영 화면, Agent 상태 가시화, Obsidian 기반 장기 기억, PostgreSQL + pgvector RAG 엔진을 분리된 런타임으로 구성한다.

## 기술 우선순위

1. Spring Boot 3
2. Spring AI
3. ChatModel
4. EmbeddingModel
5. VectorStore
6. PostgreSQL + pgvector
7. Obsidian RAG
8. Node/Express Operations Backend
9. React Dashboard

## 런타임 책임

- `archiveos-ai`: Obsidian sync, heading-aware chunking, OpenAI embeddings, pgvector 저장, vector search, RAG answer generation, 향후 AI Agent engine.
- `backend`: PM operations, Agent/runtime visibility, MCP visibility, Discord notifications, Supabase 운영 이력, Spring AI proxy.
- `frontend`: Overview, Workflows, Knowledge, History, Settings 화면.

핵심 RAG 흐름:

```text
Markdown -> Chunking -> Embedding -> VectorStore -> Retriever -> ChatModel -> Answer + References
```

## 로컬 개발 환경

### 1. 환경 파일 준비

```powershell
Copy-Item .env.example .env
```

필수 값:

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
```

실제 Obsidian vault를 사용할 때는 `HOST_OBSIDIAN_VAULT_PATH`를 해당 경로로 바꾼다. API key, DB password, webhook URL은 Git에 커밋하지 않는다.

### 2. Docker Desktop / Docker CLI 확인

Windows 기준으로 먼저 아래를 확인한다.

```powershell
Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe"
docker --version
docker compose version
docker info
```

Docker Desktop이 설치되어 있는데 PATH만 빠진 경우 현재 세션에 임시로 추가한다.

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
```

영구 등록은 Windows 환경 변수의 사용자 또는 시스템 `Path`에 아래 경로를 추가한다.

```text
C:\Program Files\Docker\Docker\resources\bin
```

Docker Desktop이 설치되어 있지 않으면 관리자 PowerShell에서 설치한다.

```powershell
choco install docker-desktop -y
```

설치 후 Docker Desktop을 실행하고 `docker info`가 성공하는지 확인한다.

### 3. Docker Compose 실행

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

성공 조건:

- `postgres` 컨테이너 running
- `archiveos-ai` 컨테이너 running
- `backend` 컨테이너 running
- `frontend` 컨테이너 running 또는 접근 가능

기본 포트:

| 서비스 | 포트 | 역할 |
|---|---:|---|
| Frontend | 5173 | 운영 대시보드 |
| Node backend | 4000 | PM/Agent/운영 API |
| archiveos-ai | 4100 | Spring AI/RAG API |
| PostgreSQL | 5432 | pgvector 저장소 |

## RAG End-to-End 검증

Docker가 정상 설치되어 있으면 아래 스크립트로 전체 흐름을 확인한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1
```

스크립트가 수행하는 검증:

1. Docker CLI, Compose, Docker daemon 확인
2. `docker compose config`
3. `docker compose up --build -d`
4. PostgreSQL 접속 및 `vector` extension 확인
5. `obsidian_documents`, `obsidian_chunks`, embedding index 확인
6. `GET /api/health`
7. `GET /api/ai/runtime`
8. `POST /api/ai/runtime/check`
9. `POST /api/obsidian/sync`
10. `GET /api/rag/search?query=ArchiveOS&limit=5`
11. `POST /api/rag/ask`
12. Node proxy `GET/POST /api/ai/runtime`

수동 검증 명령:

```powershell
curl http://localhost:4100/api/health
curl http://localhost:4100/api/ai/runtime
curl -X POST http://localhost:4100/api/ai/runtime/check
curl -X POST http://localhost:4100/api/obsidian/sync
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
curl -X POST http://localhost:4100/api/rag/ask -H "Content-Type: application/json" -d "{\"question\":\"ArchiveOS의 Spring AI RAG 구조를 요약해줘\"}"
curl http://localhost:4000/api/ai/runtime
curl -X POST http://localhost:4000/api/ai/runtime/check
```

성공 기준:

- `/api/ai/runtime`이 실제 DB 연결 상태를 반환한다.
- `vectorStore.databaseConnected=true`
- `vectorStore.extensionInstalled=true`
- Obsidian sync 후 `knowledge.documents`, `knowledge.chunks`, `knowledge.embeddedChunks`가 증가한다.
- RAG search가 `score`가 있는 references를 반환한다.
- RAG ask가 `answer`와 `references`를 반환한다.
- runtime telemetry에 latency와 reference count가 기록된다.
- 응답에 API key, DB password, webhook URL, 로컬 vault 절대 경로가 노출되지 않는다.

## 개발 명령

Frontend:

```powershell
npm install
npm run test
npm run build
```

Node backend:

```powershell
cd backend
npm install
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

## 문서

- [Spring AI Engine Architecture](docs/architecture/spring-ai-engine.md)
- [Spring AI Dashboard UI](docs/ui/spring-ai-dashboard.md)
- [Developer Guide](docs/operations/developer-guide.md)
- [AX 구현 상태](docs/AX_IMPLEMENTATION_STATUS.md)
- [전체 아키텍처](docs/ARCHITECTURE_FULL.md)

## 운영 원칙

- ArchiveOS UI는 visibility-first 원칙을 유지한다.
- shell, MCP, Codex, process control을 UI에서 직접 실행하지 않는다.
- PM decision 기능은 ArchiveOS task state와 decision log를 기록하는 용도다.
- Secret 값은 backend/local runtime에서만 사용하고 frontend에 노출하지 않는다.
- RAG 실패는 fake success가 아니라 명확한 unavailable/degraded 상태로 표시한다.
