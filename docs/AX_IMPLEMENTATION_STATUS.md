# ArchiveOS AX 구현 상태

ArchiveOS는 PM 운영 대시보드와 Node/Express 운영 backend를 유지하면서, AI 지식 처리와 RPA 분류 책임을 `archiveos-ai` Spring Boot 모듈로 이동하고 있다.

## 현재 책임 분리

- `frontend`: Overview, Workflows, Knowledge, History, Settings 화면을 제공한다.
- `backend`: 기존 dashboard API 호환과 Spring API proxy를 담당한다. 알림 송신은 Spring Boot가 소유한다.
- `archiveos-ai`: Obsidian sync, heading-aware chunking, OpenAI embedding, pgvector 저장, vector search, RAG answer, Spring Batch 기반 RPA/운영 Job을 담당한다.
- `postgres`: Docker Compose 기반 local PostgreSQL + pgvector 개발 저장소다.

## 구현 완료

### Spring AI / RAG

- Java 21 Spring Boot 모듈 `archiveos-ai`
- Gradle Wrapper 포함
- Spring AI OpenAI ChatModel / EmbeddingModel 구성
- PostgreSQL + pgvector schema, HNSW cosine index 구성
- Obsidian Markdown 문서 수집
- heading-aware chunking
- content hash 기반 증분 sync
- 실제 EmbeddingModel 기반 vector 저장
- cosine similarity search
- `POST /api/rag/ask`의 실제 ChatModel 기반 답변 생성
- references 반환:
  - title
  - path
  - heading
  - score

### Runtime 관측

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- 실제 DB 기반 documents/chunks/embeddedChunks/pending/failed 통계
- pgvector extension/index 상태 확인
- 최근 sync/search/ask 시각, latency, reference count 기록
- secret, DB password, webhook, vault 절대 경로 미노출

### Spring Batch / Intelligent RPA

- `spring-boot-starter-batch` 도입
- Spring Batch metadata schema 자동 초기화
- `archiveosRpaClassifyJob`
- `obsidianSyncJob`
- `ragHealthCheckJob`
- Batch catalog/execution API:
  - `GET /api/batch/jobs`
  - `POST /api/batch/jobs/{jobName}/run`
  - `GET /api/batch/executions`
  - `GET /api/batch/executions/{id}`
- RPA 저장 테이블:
  - `archiveos_rpa_tasks`
  - `archiveos_rpa_decisions`
- RPA classify API:
  - `POST /api/rpa/classify`
  - `GET /api/rpa/tasks/recent`
  - `GET /api/rpa/tasks/{id}`
  - `POST /api/rpa/tasks/{id}/decision`
- PM 승인/반려/보류/재시도 이력 저장
- 직접 실행 금지:
  - shell 실행 없음
  - MCP 실행 없음
  - Codex 제어 없음
  - git push/배포 실행 없음

### Node backend proxy

Node/Express backend는 RAG와 Spring Batch/RPA 기능을 직접 중복 구현하지 않고 `archiveos-ai`로 proxy한다.

- `/api/ai/runtime`
- `/api/ai/runtime/check`
- `/api/obsidian/sync`
- `/api/obsidian/documents`
- `/api/rag/search`
- `/api/rag/ask`
- `/api/batch/jobs`
- `/api/batch/jobs/:jobName/run`
- `/api/batch/executions`
- `/api/batch/executions/:id`
- `/api/rpa/classify`
- `/api/rpa/tasks/recent`
- `/api/rpa/tasks/:id`
- `/api/rpa/tasks/:id/decision`

`archiveos-ai`가 꺼져 있으면 가짜 healthy 대신 명확한 proxy error 또는 503 계열 응답을 반환한다.

## 최근 검증 기준

- Docker Desktop / Docker CLI 감지
- `docker compose config`
- `docker compose up --build -d`
- PostgreSQL + pgvector container running
- `archiveos-ai`, `backend`, `frontend` container running
- pgvector extension 설치 확인
- Obsidian sync 후 documents/chunks/embeddedChunks 생성 확인
- RAG search score 포함 결과 반환
- RAG ask answer + references 반환
- Spring Batch job catalog 조회
- `ragHealthCheckJob` 수동 실행
- RPA classify Job 실행
- RPA decision record 저장
- Node proxy 경유 RAG/RPA/Batch 확인

## 실행해야 할 검증

```powershell
npm run test
npm run build
cd backend && npm run test
cd backend && npm run typecheck
cd backend && npm run build
cd ../archiveos-ai && .\gradlew.bat test --no-daemon
.\gradlew.bat bootJar --no-daemon
cd ..
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1 -KeepRunning
```

## 남은 작업

- Node batch/scheduler 책임을 Spring Batch Job으로 계속 이전
- NightlyReviewJob / DailyReportJob / KnowledgeMaintenanceJob / PipelineAuditJob 구현
- Workflows 화면에 Spring Batch execution history 표시
- 위험 작업 실행 전 Approval Gate 강화
- 향후 MCP/Tool execution boundary를 별도 allowlist 기반으로 설계
