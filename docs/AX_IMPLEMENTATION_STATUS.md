# ArchiveOS AX 구현 상태

현재 ArchiveOS는 PM 운영 backend와 Spring AI/RAG engine을 분리한 AX knowledge platform foundation 단계다.

## 책임 분리

- Node/Express backend: PM 운영, Agent 상태, MCP visibility, Dashboard, Discord, Supabase 운영 데이터, Spring AI proxy
- `archiveos-ai`: Obsidian ingestion, heading-aware chunking, embedding, pgvector storage, vector search, RAG answer generation, Spring Batch Intelligent RPA

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

### Spring Batch Intelligent RPA

- `spring-boot-starter-batch` 도입
- Spring Batch metadata schema 자동 초기화
- `archiveosRpaClassifyJob` 추가
- `archiveos_rpa_tasks` 테이블 추가
- 작업 title/description 기반 분류
- ChatModel 기반 분류 시도
- ChatModel 미설정 또는 실패 시 rule-based fallback
- 위험도, 권장 조치, PM 승인 필요 여부 저장
- 직접 실행 없음:
  - shell 실행 없음
  - MCP 실행 없음
  - Codex 제어 없음
  - git push/배포 실행 없음

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
- `public.archiveos_rpa_tasks`
- HNSW cosine index
- `public.match_obsidian_chunks(query_embedding vector(1536), match_count integer)`

### Node backend integration

Node/Express backend는 RAG와 Intelligent RPA 판단을 직접 구현하지 않고 `archiveos-ai`로 proxy한다.

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search`
- `POST /api/rag/ask`
- `POST /api/rpa/classify`
- `GET /api/rpa/tasks/recent`
- `GET /api/rpa/tasks/:id`

`archiveos-ai`가 꺼져 있으면 fake healthy 대신 HTTP 503을 반환한다.

## 최근 검증 완료

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
- Obsidian sync: documents/chunks/embedding 생성 확인
- vector search: score 포함 결과 반환
- RAG ask: answer + references 반환
- Node proxy `GET /api/ai/runtime`: 정상

## 테스트와 빌드

- `npm run test`
- `npm run build`
- `cd backend && npm run test`
- `cd backend && npm run typecheck`
- `cd backend && npm run build`
- `cd archiveos-ai && .\gradlew.bat test --no-daemon`
- `cd archiveos-ai && .\gradlew.bat bootJar --no-daemon`

## 남은 작업

- Node batch/scheduler 책임을 Spring Batch로 계속 이전
- PM Approval Gate와 실제 실행 경계 강화
- MCP/Tool execution boundary 구현
- Spring Batch Job/Step 기반 실행 이력 확장
- 위험 작업 승인/반려/재시도 이력의 Spring DB 통합
- Frontend Workflows 화면에서 Spring Batch RPA 이력 표시
