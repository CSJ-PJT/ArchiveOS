# Execution Policy (Mandatory)

## Current Implementation Boundary

ArchiveOS uses two backend responsibilities:

- Node/Express compatibility backend: existing API contracts and delegation to Spring Boot.
- `archiveos-ai` Spring Boot module: Obsidian ingestion, heading-aware chunking, OpenAI embeddings, pgvector storage, vector similarity search, RAG answer generation, and future AI Agent logic.

Default Vector DB:

- Supabase PostgreSQL + pgvector

Local fallback:

- Docker Compose PostgreSQL using `pgvector/pgvector:pg16`

RAG must not return fake success. If `OPENAI_API_KEY` is not configured, RAG sync/search/ask must return HTTP 503 or a clearly disabled response.

## Continuous Execution

이 문서는 작업의 최종 목표가 달성될 때까지 반드시 계속 수행한다.

다음과 같은 이유로 작업을 중단하거나 종료해서는 안 된다.

- "여기까지 완료했습니다."
- "다음 작업을 진행할까요?"
- "계속 진행하시겠습니까?"
- "승인이 필요합니다."
- "추가 지시를 기다립니다."
- "다음 단계는 직접 진행하세요."

위와 같은 문장을 출력하지 않는다.

---

## Stop Condition

작업은 아래 조건을 모두 만족했을 때만 종료한다.

- ARCHITECTURE_FULL.md의 모든 Phase 완료
- TODO 항목 100% 완료
- Build 성공
- TypeCheck 성공
- Test 성공
- Docker Build 성공
- Docker Compose 정상 실행
- Git Commit 완료
- origin/main Push 완료
- README 및 변경 문서 자동 업데이트 완료

그 전까지는 계속 작업한다.

---

## Autonomous Rule

필요한 리팩터링은 스스로 판단하여 수행한다.

필요한 파일 생성, 필요한 디렉터리 생성, 필요한 의존성 설치, 필요한 환경설정 수정, 필요한 테스트 작성, 필요한 문서 작성을 모두 자동 수행한다.

---

## Error Recovery

오류가 발생하면 작업을 중단하지 않는다.

원인을 분석하고 수정한다.

수정 후 다시 Build → Test → 실행을 반복한다.

성공할 때까지 반복한다.

---

## Git Policy

의미 있는 변경이 발생하면 자동으로 Commit한다.

Commit Message는 Conventional Commit을 따른다.

예시:

- feat:
- fix:
- refactor:
- docs:
- chore:

작업 종료 시 origin/main까지 Push한다.

---

## Progress

중간 진행상황은 출력하지 않는다.

필요한 경우 내부적으로만 진행률을 관리한다.

사용자에게는 모든 작업이 완료된 이후 한 번만 최종 보고한다.

---

## Final Report

최종 보고에는 아래 내용을 포함한다.

- 완료된 기능
- 변경된 파일
- Commit Hash 목록
- Build 결과
- Test 결과
- Docker 상태
- Push 여부
- 다음 추천 작업

이 보고를 출력한 후 작업을 종료한다.

# ArchiveOS AX Platform - Codex Implementation Architecture

## 0. Codex Goal

ArchiveOS를 Spring AI 기반 AX Platform으로 발전시킨다.

프로젝트 루트 또는 `docs` 디렉터리의 `ARCHITECTURE_FULL.md`를 먼저 읽고, 문서에 정의된 Phase 순서대로 구현한다.

## 1. Project Vision

ArchiveOS는 단순한 Agent Dashboard가 아니라, 개인/프로젝트 지식을 기반으로 작업을 계획하고, 검토하고, 승인 후 배포까지 이어지는 AX(AI Transformation) Platform이다.

이 플랫폼은 다음 기능을 목표로 한다.

- Spring Boot + Spring AI 기반 AI Backend
- Obsidian Vault 기반 Knowledge Platform
- PostgreSQL + pgvector 기반 Vector DB
- RAG 검색 및 질의응답
- MCP Tool Server
- Multi-Agent Workflow
- PM Turn 승인/반려 시스템
- Human-in-the-loop Agentic CI/CD
- Docker Compose 기반 자동 빌드/배포
- Slack Notification
- 향후 Kubernetes 확장 가능 구조

## 2. Target Architecture

```text
Obsidian Vault
  ↓
Markdown Loader
  ↓
Chunking
  ↓
Embedding
  ↓
PostgreSQL + pgvector
  ↓
RAG Search
  ↓
Spring AI Agent
  ↓
MCP Tool Server
  ↓
Agent Workflow
  ↓
PM Turn
  ↓
Human Approval
  ↓
Docker Build / Deploy
  ↓
Health Check
  ↓
Slack Notification
```

## 3. Phase 1 - Spring AI Foundation

### Goal

Spring Boot + Spring AI 기반의 신규 AI Backend 모듈을 생성한다.

### Requirements

- Java 21 또는 Java 17
- Spring Boot 3.x
- Gradle
- Spring AI
- PostgreSQL
- pgvector
- Docker Compose
- 환경변수 기반 설정

### Environment Variables

```bash
OPENAI_API_KEY=
OBSIDIAN_VAULT_PATH=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
SLACK_BOT_TOKEN=
SLACK_CHANNEL=archiveos-alerts
ARCHIVEOS_DEPLOY_COMPOSE_FILE=
ARCHIVEOS_HEALTH_CHECK_URL=
```

### Deliverables

- `archiveos-ai` 모듈
- Spring AI 설정
- OpenAI ChatModel 연동 준비
- EmbeddingModel 연동 준비
- Health Check API

### Required API

`GET /api/health`

Response example:

```json
{
  "status": "UP",
  "module": "archiveos-ai",
  "aiProvider": "openai",
  "database": "connected"
}
```

## 4. Phase 2 - Obsidian Knowledge Platform

### Goal

Obsidian Vault에 저장된 Markdown 문서를 수집하고 Vector DB화한다.

### Supported Documents

- 프로젝트 문서
- 이력서
- 면접 준비 자료
- DeepStake3D 기획 문서
- ArchiveOS 설계 문서
- 운영 기록
- 트러블슈팅 노트

### Processing Flow

```text
Obsidian .md files
  ↓
MarkdownDocumentLoader
  ↓
Metadata extraction
  ↓
TextChunkingService
  ↓
EmbeddingService
  ↓
obsidian_documents / obsidian_chunks
```

### Chunking Rules

- chunk size는 설정값으로 분리
- overlap size는 설정값으로 분리
- Markdown heading 기준 우선 분할
- 너무 긴 문단은 문자 수 기준 재분할
- 코드블록은 가능하면 분리하지 않음
- 파일 경로, 제목, heading 정보를 metadata로 보존

### Incremental Sync

동일 파일을 매번 전체 재임베딩하지 않는다.

Sync 기준:

- file path
- last modified time
- content hash

파일 내용 hash가 변경된 경우에만 기존 chunk를 삭제하고 재인덱싱한다.

### Required APIs

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`

### API Details

`POST /api/obsidian/sync`

Obsidian Vault 전체를 스캔하고 신규/수정 문서만 동기화한다.

Response example:

```json
{
  "scanned": 120,
  "created": 10,
  "updated": 3,
  "skipped": 107
}
```

`GET /api/obsidian/documents`

인덱싱된 문서 목록을 조회한다.

`GET /api/rag/search?query=...`

질문을 검색 가능한 형태로 처리하고 `obsidian_chunks`에서 관련 청크를 조회한다.

Response example:

```json
[
  {
    "title": "ArchiveOS Design",
    "path": "ArchiveOS/design.md",
    "chunkText": "...",
    "score": 0.82
  }
]
```

`POST /api/rag/ask`

Request:

```json
{
  "question": "ArchiveOS의 Spring AI RAG 운영 구조를 요약해줘"
}
```

Response:

```json
{
  "answer": "...",
  "references": [
    {
      "title": "ArchiveOS AX Platform",
      "path": "ArchiveOS/ARCHITECTURE_FULL.md"
    }
  ]
}
```

## 5. Phase 3 - Database Schema

### obsidian_documents

```sql
create table if not exists obsidian_documents (
    id bigserial primary key,
    file_path text not null unique,
    title text,
    content_hash varchar(128) not null,
    last_modified_at timestamp,
    created_at timestamp default now(),
    updated_at timestamp default now()
);
```

### obsidian_chunks

```sql
create table if not exists obsidian_chunks (
    id bigserial primary key,
    document_id bigint not null references obsidian_documents(id) on delete cascade,
    chunk_index int not null,
    heading text,
    chunk_text text not null,
    embedding vector(1536),
    created_at timestamp default now()
);
```
