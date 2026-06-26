# ArchiveOS

ArchiveOS는 AI Agent, 지능형 RPA, 배치 작업, 운영 대시보드, RAG 지식 엔진을 하나의 환경에서 실행하고 관제하는 AX 운영 플랫폼이다.

목표는 사람이 모든 시스템을 직접 운영하는 방식에서 벗어나, AI가 반복 업무와 운영 판단을 보조하고 사람은 중요한 승인과 의사결정에 집중하는 구조를 만드는 것이다.

## Vision

AI가 일하고, 사람은 설계하고 결정한다.

ArchiveOS는 특정 산업이나 서비스에 종속되지 않는 공통 AI 운영 런타임을 지향한다. 제조, 물류, 개발 운영, 문서 처리, 지식 관리 등 여러 도메인의 애플리케이션이 동일한 런타임 위에서 동작할 수 있도록 설계한다.

## Core Features

### AI Agent Runtime

- AI Agent 실행 및 생명주기 관리
- Multi-Agent 협업 구조
- LLM 연동
- Tool Calling
- MCP 기반 외부 도구 연동 준비
- 메모리와 실행 문맥 관리

### Workflow & Batch Engine

- Spring Batch 기반 Job 및 Step 실행
- 스케줄링과 반복 작업 관리
- 이벤트 기반 워크플로우
- 병렬 처리 및 재시도
- 실행 이력과 실패 원인 추적

### Intelligent RPA

- AI 기반 작업 분류와 판단
- 승인 기반 자동화
- 실패 복구 및 재시도 추천
- 외부 시스템 연동
- 위험 작업에 대한 Approval Gate

### Knowledge & RAG

- Obsidian Markdown 문서 수집 및 동기화
- heading-aware chunking
- OpenAI EmbeddingModel 기반 embedding 생성
- PostgreSQL + pgvector 기반 vector search
- Spring AI ChatModel 기반 RAG answer generation
- 답변 출처와 score 추적

### Operations & Observability

- 시스템 상태 대시보드
- 서비스 health check
- 배치 및 워크플로우 실행 현황
- 장애 감지와 Discord 알림
- AI 기반 원인 분석 및 조치 추천 준비

## Project Runtime

ArchiveOS 위에서는 여러 독립 애플리케이션이 동작할 수 있다.

첫 번째 산업 애플리케이션은 Archive-Nexus다.

- Archive-Nexus: 가상 공장, 재고, 물류, 품질, 정비 시스템을 연결하는 제조 AX 애플리케이션
- 향후 다양한 산업과 업무 도메인의 애플리케이션으로 확장 가능

```text
ArchiveOS
  ├─ AI Runtime
  ├─ Batch / Workflow
  ├─ RPA / Approval
  ├─ RAG / Knowledge
  └─ Observability
       │
       ▼
Archive-Nexus
  ├─ Virtual Factories
  ├─ Inventory
  ├─ Logistics
  ├─ Quality
  └─ Maintenance
```

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

## Tech Stack

Backend:

- Java 21
- Spring Boot
- Spring AI
- Spring Batch
- Spring Data JDBC/JPA
- Node.js / Express
- PostgreSQL
- pgvector

Frontend:

- React
- Vite
- TypeScript

Infrastructure:

- Docker
- Docker Compose
- Kubernetes 준비
- Prometheus / Grafana 준비
- OpenTelemetry 준비

Integration:

- MCP
- REST API
- Webhook
- Discord
- GitHub
- Obsidian Markdown

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

## 운영 원칙

- UI는 visibility-first 원칙을 유지한다.
- shell, MCP, Codex, process control은 UI에서 직접 실행하지 않는다.
- PM decision 기능은 ArchiveOS task state와 decision log를 기록하는 용도다.
- Secret 값은 backend/local runtime에서만 사용하고 frontend에는 노출하지 않는다.
- RAG 실패 시 fake success를 반환하지 않고 명확한 unavailable/degraded 상태를 표시한다.

## Roadmap

- [ ] AI Agent Runtime 고도화
- [ ] Spring Batch 기반 작업 오케스트레이션
- [ ] Intelligent RPA 및 Approval Gate
- [ ] Workflow Designer
- [ ] MCP 기반 Tool Registry
- [ ] Multi-Agent 협업
- [ ] RAG 및 지식 동기화
- [ ] 프로젝트별 Runtime 관리
- [ ] Observability 대시보드
- [ ] Archive-Nexus 연동
- [ ] Kubernetes 배포
- [ ] Plugin SDK
- [ ] Multi-LLM 지원

## 문서

- [Spring AI Engine Architecture](docs/architecture/spring-ai-engine.md)
- [Spring AI Dashboard UI](docs/ui/spring-ai-dashboard.md)
- [Developer Guide](docs/operations/developer-guide.md)
- [AX 구현 상태](docs/AX_IMPLEMENTATION_STATUS.md)
- [전체 아키텍처](docs/ARCHITECTURE_FULL.md)

## Slogan

AI가 일하는 플랫폼, 사람은 설계하고 결정하는 플랫폼.

One AI Runtime. Infinite Business Applications.

## License

라이선스 정책은 프로젝트 운영 방침에 따라 추후 정의한다.
