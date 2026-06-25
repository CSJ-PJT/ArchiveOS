# ArchiveOS

ArchiveOS는 개인 AI 운영체제를 목표로 하는 AX 운영 플랫폼이다. React 운영 화면, Node/Express 운영 backend, Spring Boot 기반 `archiveos-ai`, PostgreSQL + pgvector, Obsidian Markdown vault를 분리해 PM 운영과 RAG 지식 엔진을 함께 실행한다.

## 구성 요소

1. React Dashboard
2. Node/Express Operations Backend
3. `archiveos-ai` Spring Boot + Spring AI module
4. PostgreSQL + pgvector
5. Obsidian Markdown Vault
6. OpenAI ChatModel / EmbeddingModel
7. Docker Compose local runtime

역할 분리:

- `frontend`: Overview, Workflows, Knowledge, History, Settings 화면.
- `backend`: PM 운영, Agent/runtime visibility, Discord 알림, Supabase 운영 데이터, Spring AI proxy.
- `archiveos-ai`: Obsidian sync, heading-aware chunking, OpenAI embedding, pgvector 저장, vector search, RAG answer generation.
- `postgres`: local PostgreSQL + pgvector 개발 Vector DB.

RAG 흐름:

```text
Markdown -> Chunking -> Embedding -> pgvector -> Vector Search -> ChatModel -> Answer + References
```

## 환경 파일

루트 `.env`는 Git에 커밋하지 않는다.

```powershell
Copy-Item .env.example .env
```

주요 값:

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

실제 Obsidian vault를 사용할 때는 `HOST_OBSIDIAN_VAULT_PATH`를 해당 경로로 바꾼다. API key, DB password, webhook URL, service role key는 절대 커밋하지 않는다.

## Docker Desktop / Docker CLI 확인

Windows 기준 확인 명령:

```powershell
Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe"
docker --version
docker compose version
docker info
```

Docker Desktop은 설치되어 있으나 PATH만 빠진 경우:

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
```

영구 반영은 Windows 환경 변수 `Path`에 아래 경로를 추가한다.

```text
C:\Program Files\Docker\Docker\resources\bin
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

기본 포트:

| Service | Port | Role |
|---|---:|---|
| Frontend | 5173 | React 운영 화면 |
| Node backend | 4000 | PM/Agent/운영 API |
| archiveos-ai | 4100 | Spring AI/RAG API |
| PostgreSQL | 5432 | pgvector 저장소 |

## RAG End-to-End 검증

자동 검증:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1
```

검증 스크립트는 `docker compose config`의 원문 환경변수를 출력하지 않고, API 응답도 상태 요약만 출력한다.

수동 검증:

```powershell
curl http://localhost:4100/api/health
curl http://localhost:4100/api/ai/runtime
curl -X POST http://localhost:4100/api/ai/runtime/check
curl -X POST http://localhost:4100/api/obsidian/sync
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
curl -X POST http://localhost:4100/api/rag/ask -H "Content-Type: application/json" -d "{\"question\":\"Summarize the ArchiveOS Spring AI RAG architecture.\"}"
curl http://localhost:4000/api/ai/runtime
curl -X POST http://localhost:4000/api/ai/runtime/check
```

성공 기준:

- `/api/ai/runtime`이 실제 DB 연결 상태를 반환한다.
- `vectorStore.databaseConnected=true`
- `vectorStore.extensionInstalled=true`
- `vectorStore.indexReady=true`
- Obsidian sync 후 documents/chunks/embeddedChunks가 증가한다.
- RAG search가 score가 포함된 references를 반환한다.
- RAG ask가 answer와 references를 반환한다.
- runtime telemetry에 latency와 reference count가 기록된다.
- 응답에 API key, DB password, webhook URL, 로컬 vault 절대 경로가 노출되지 않는다.

## 개발 명령

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

## 문서

- [Spring AI Engine Architecture](docs/architecture/spring-ai-engine.md)
- [Spring AI Dashboard UI](docs/ui/spring-ai-dashboard.md)
- [Developer Guide](docs/operations/developer-guide.md)
- [AX 구현 상태](docs/AX_IMPLEMENTATION_STATUS.md)
- [전체 아키텍처](docs/ARCHITECTURE_FULL.md)

## 운영 원칙

- UI는 visibility-first 원칙을 유지한다.
- shell, MCP, Codex, process control은 UI에서 직접 실행하지 않는다.
- PM decision 기능은 ArchiveOS task state와 decision log를 기록하는 용도다.
- Secret 값은 backend/local runtime에서만 사용하고 frontend에는 노출하지 않는다.
- RAG 실패 시 fake success를 반환하지 않고 명확한 unavailable/degraded 상태를 표시한다.
