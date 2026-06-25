# Execution Policy

이 문서는 프로젝트의 최종 목표이다.

Codex는 이 문서를 완료 조건으로 사용한다.

모든 Phase가 완료될 때까지 자율적으로 작업한다.

사용자의 추가 승인을 기다리지 않는다.

오류가 발생하면 수정 후 재시도한다.

최종 완료 후 Commit, Push, 최종 보고를 수행한다.

ArchiveOS AX Platform - Codex Implementation Architecture
0. Codex Goal
Use this short text as the Codex Goal.

ArchiveOS를 Spring AI 기반 AX Platform으로 발전시킨다.
프로젝트 루트 또는 docs 디렉토리의 ARCHITECTURE.md를 먼저 읽고, 문서에 정의된 Phase 순서대로 구현한다.
1. Project Vision
ArchiveOS는 단순한 Agent Dashboard가 아니라, 개인/프로젝트 지식을 기반으로 작업을 계획하고, 검토하고, 승인 후 배포까지 이어지는 AX(AI Transformation) Platform이다.

이 플랫폼은 다음 기능을 목표로 한다.

Spring Boot + Spring AI 기반 AI Backend
Obsidian Vault 기반 Knowledge Platform
PostgreSQL + pgvector 기반 Vector DB
RAG 검색 및 질의응답
MCP Tool Server
Multi-Agent Workflow
PM Turn 승인/반려 시스템
Human-in-the-loop Agentic CI/CD
Docker Compose 기반 자동 빌드/배포
Discord Notification
향후 Kubernetes 확장 가능 구조
2. Target Architecture
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
Discord Notification
3. Phase 1 - Spring AI Foundation
Goal
Spring Boot + Spring AI 기반의 신규 AI Backend 모듈을 생성한다.

Requirements
Java 21 또는 Java 17
Spring Boot 3.x
Gradle
Spring AI
PostgreSQL
pgvector
Docker Compose
환경변수 기반 설정
Environment Variables
OPENAI_API_KEY
OBSIDIAN_VAULT_PATH
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DISCORD_WEBHOOK_URL
ARCHIVEOS_DEPLOY_COMPOSE_FILE
ARCHIVEOS_HEALTH_CHECK_URL
Deliverables
archiveos-ai 모듈
Spring AI 설정
OpenAI ChatModel 연동
EmbeddingModel 연동
Health Check API
Required API
GET /api/health
Response example:

{
  "status": "UP",
  "module": "archiveos-ai",
  "aiProvider": "openai",
  "database": "connected"
}
4. Phase 2 - Obsidian Knowledge Platform
Goal
Obsidian Vault에 저장된 Markdown 문서를 수집하고 Vector DB화한다.

Supported Documents
프로젝트 문서
이력서
면접 준비 자료
DeepStake3D 기획 문서
ArchiveOS 설계 문서
운영 기록
트러블슈팅 노트
Processing Flow
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
Chunking Rules
chunk size는 설정값으로 분리
overlap size는 설정값으로 분리
Markdown heading 기준 우선 분할
너무 긴 문단은 문자 수 기준 재분할
코드블록은 가능하면 분리하지 않음
파일 경로, 제목, heading 정보를 metadata로 보존
Incremental Sync
동일 파일을 매번 전체 재임베딩하지 않는다.

Sync 기준:

file path
last modified time
content hash
파일 내용 hash가 변경된 경우에만 기존 chunk를 삭제하고 재임베딩한다.

Required APIs
POST /api/obsidian/sync
GET /api/obsidian/documents
GET /api/rag/search?query=...
POST /api/rag/ask
API Details
POST /api/obsidian/sync
Obsidian Vault 전체를 스캔하고 신규/수정 문서만 동기화한다.

Response example:

{
  "scanned": 120,
  "created": 10,
  "updated": 3,
  "skipped": 107
}
GET /api/obsidian/documents
인덱싱된 문서 목록을 조회한다.

GET /api/rag/search?query=...
질문을 embedding하고 pgvector similarity search를 수행한다.

Response example:

[
  {
    "title": "ArchiveOS Design",
    "path": "ArchiveOS/design.md",
    "chunkText": "...",
    "score": 0.82
  }
]
POST /api/rag/ask
Request:

{
  "question": "현대오토에버 면접용으로 ArchiveOS를 어떻게 설명하면 좋아?"
}
Response:

{
  "answer": "...",
  "references": [
    {
      "title": "ArchiveOS AX Platform",
      "path": "ArchiveOS/ARCHITECTURE.md"
    }
  ]
}
5. Phase 3 - Database Schema
obsidian_documents
create table if not exists obsidian_documents (
    id bigserial primary key,
    file_path text not null unique,
    title text,
    content_hash varchar(128) not null,
    last_modified_at timestamp,
    created_at timestamp default now(),
    updated_at timestamp default now()
);
obsidian_chunks
create table if not exists obsidian_chunks (
    id bigserial primary key,
    document_id bigint not null references obsidian_documents(id) on delete cascade,
    chunk_index int not null,
    heading text,
    chunk_text text not null,
    embedding vector(1536),
    created_at timestamp default now()
);
