# ArchiveOS

ArchiveOS is a Spring Boot 3 + Spring AI centered AX operations platform.

Technology priority:

1. Spring Boot 3
2. Spring AI
3. ChatModel
4. EmbeddingModel
5. VectorStore
6. PostgreSQL + pgvector
7. Obsidian RAG
8. Node/Express Operations Backend
9. React Dashboard

Runtime responsibility:

- `archiveos-ai`: Obsidian sync, heading-aware chunking, OpenAI embeddings, pgvector storage, vector search, RAG answer generation, and future AI Agent engine.
- `backend`: PM operations, Agent/runtime visibility, MCP visibility, Discord notifications, Supabase operational history, and proxy calls to Spring AI.
- `frontend`: Overview, Workflows, Knowledge, History, and Settings screens.

Key RAG flow:

```text
Markdown -> Chunking -> Embedding -> VectorStore -> Retriever -> ChatModel -> Answer + References
```

See:

- `docs/architecture/spring-ai-engine.md`
- `docs/ui/spring-ai-dashboard.md`

ArchiveOS는 AI 에이전트 작업 상태, PM 의사결정, 지식 검색, 자동화 실행 이력을 한곳에서 관리하기 위한 운영형 대시보드입니다.

현재 구조는 운영 기능과 AI/RAG 기능을 분리합니다.

- **Frontend**: React + Vite + TypeScript
- **Operations backend**: Node.js + Express
- **AI backend**: Spring Boot + Spring AI
- **Vector database**: PostgreSQL + pgvector
- **Knowledge source**: Obsidian Markdown vault
- **Runtime**: Docker Compose

## 주요 기능

### 운영 대시보드

- Agent 상태와 현재 작업 조회
- 작업 로그, 의사결정, 리뷰 결과 확인
- PM 승인·반려 흐름
- Discord 알림 상태 확인
- MCP 및 로컬 런타임 상태 표시

### Obsidian RAG

- Markdown 문서 자동 탐색 및 수집
- heading-aware chunking
- content hash 기반 증분 동기화
- OpenAI EmbeddingModel 기반 임베딩 생성
- pgvector cosine similarity 검색
- Spring AI ChatModel 기반 질의응답
- 응답에 문서 제목, 경로, heading, score 포함

### 안전한 실행 경계

- API Key, DB 비밀번호, webhook URL은 backend 환경변수로만 관리
- OpenAI 호출을 frontend에 노출하지 않음
- 임의 shell command를 직접 실행하지 않음
- 승인 전 배포 작업 실행 금지
- 설정 누락 시 가짜 성공 대신 명확한 오류 반환

## 전체 구조

```text
React Dashboard
    |
    v
Node/Express Backend
    |-- PM operations
    |-- Agent/runtime visibility
    |-- Discord/MCP integration
    |-- Spring AI proxy
    |
    v
Spring Boot + Spring AI
    |-- Obsidian sync
    |-- Chunking
    |-- Embedding
    |-- Vector search
    |-- RAG answer
    |
    v
PostgreSQL + pgvector
```

## 로컬 실행

### 1. 환경파일 준비

```bash
cp .env.example .env
```

최소 설정값:

```env
OPENAI_API_KEY=
DB_HOST=postgres
DB_PORT=5432
DB_NAME=archiveos
DB_USER=archiveos
DB_PASSWORD=archiveos
HOST_OBSIDIAN_VAULT_PATH=./docs
```

실제 Obsidian vault를 사용할 때는 `HOST_OBSIDIAN_VAULT_PATH`를 해당 경로로 변경합니다.

Windows 예시:

```env
HOST_OBSIDIAN_VAULT_PATH=C:/Users/user/Documents/ObsidianVault
```

### 2. Docker Compose 실행

```bash
docker compose up --build
```

기본 서비스:

| 서비스 | 포트 | 역할 |
|---|---:|---|
| Frontend | 5173 | 운영 대시보드 |
| Node backend | 4000 | PM/Agent/운영 API |
| archiveos-ai | 4100 | Spring AI/RAG API |
| PostgreSQL | 5432 | pgvector 저장소 |

## RAG API

### 문서 동기화

```bash
curl -X POST http://localhost:4100/api/obsidian/sync
```

### 문서 목록

```bash
curl http://localhost:4100/api/obsidian/documents
```

### 벡터 검색

```bash
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
```

### RAG 질의

```bash
curl -X POST http://localhost:4100/api/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"ArchiveOS 구조를 요약해줘"}'
```

`OPENAI_API_KEY`가 없거나 AI backend가 준비되지 않은 경우 RAG API는 HTTP 503을 반환합니다.

## Obsidian vault 탐색 규칙

`OBSIDIAN_VAULT_PATH`가 지정되지 않으면 다음 순서로 후보를 탐색합니다.

1. 기존 환경변수에 설정된 경로
2. 프로젝트의 `docs` 디렉터리
3. 사용자 홈의 `Obsidian`, `Vault`, `Notes`, `ArchiveOS`, `DeepStake3D`, `ETC` 관련 폴더
4. `.obsidian` 디렉터리가 있는 경로
5. ArchiveOS, AX, Spring AI, RAG 관련 Markdown이 포함된 경로

적합한 경로를 찾지 못하면 프로젝트의 `docs`를 기본 vault로 사용합니다.

## 개발 명령어

### Frontend

```bash
npm install
npm run dev
npm run test
npm run build
```

### Node backend

```bash
cd backend
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```

### Spring AI backend

Windows:

```bash
cd archiveos-ai
.\gradlew.bat test --no-daemon
.\gradlew.bat bootRun
```

Linux/macOS:

```bash
cd archiveos-ai
./gradlew test --no-daemon
./gradlew bootRun
```

## 데이터 저장

주요 테이블:

- `agents`
- `tasks`
- `work_logs`
- `pm_tasks`
- `pm_task_decisions`
- `pm_task_events`
- `obsidian_documents`
- `obsidian_chunks`
- `knowledge_nodes`
- `knowledge_edges`

pgvector 인덱스와 유사도 검색 함수는 `supabase/schema.sql`에서 관리합니다.

## 운영 원칙

- 대시보드는 읽기와 승인 중심으로 유지합니다.
- 실행 권한은 backend에만 둡니다.
- AI 결과와 사람의 의사결정을 분리해 기록합니다.
- 실패 상태와 재시도 이력을 보존합니다.
- 자동화는 관찰 가능성과 복구 가능성을 우선합니다.

## 문서

- [전체 아키텍처](docs/ARCHITECTURE_FULL.md)
- [AX 구현 상태](docs/AX_IMPLEMENTATION_STATUS.md)
- [v1 안정화 기준](docs/ARCHIVEOS_V1_HARDENING.md)
- [Obsidian 연동 전략](docs/obsidian-integration-strategy.md)
- [런타임 보안](docs/runtime-security.md)
- [Knowledge Graph MVP](docs/knowledge-graph-mvp.md)

## 현재 진행 방향

ArchiveOS는 다음 순서로 확장하고 있습니다.

1. Obsidian RAG end-to-end 검증
2. PM 승인 게이트 정교화
3. Pipeline Run/Stage/Step 실행 이력
4. Retry 및 rollback 상태 관리
5. MCP 기반 도구 호출 확장
6. 멀티 에이전트 워크플로우

기능을 한 번에 크게 늘리기보다, 실제 실행과 검증이 가능한 단위로 확장합니다.
