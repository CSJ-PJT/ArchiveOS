# Spring AI Engine Architecture

ArchiveOS는 Spring Boot 3 + Spring AI를 중심으로 운영 지식, RAG, 향후 Agent 실행 계층을 분리하는 AX 운영 플랫폼이다.

## 책임 분리

1. **React Dashboard**
   - PM 운영 상태, Workflow, Knowledge, RAG 상태, Settings를 표시한다.
   - secret 값을 노출하지 않는다.
   - shell, MCP, Codex, process control을 직접 실행하지 않는다.

2. **Node/Express Operations Backend**
   - PM 운영, Agent 상태, MCP visibility, Dashboard API, Discord 알림, Supabase 운영 기록, Task Queue 상태를 담당한다.
   - AI/RAG 요청 중 필요한 것만 `archiveos-ai`로 프록시한다.
   - webhook URL, service role key, local path는 backend-only로 유지한다.

3. **archiveos-ai Spring Boot Module**
   - Obsidian 수집, heading-aware chunking, OpenAI embedding, PostgreSQL + pgvector 저장, vector similarity search, RAG answer generation, 향후 AI Agent 동작을 담당한다.
   - Spring Boot 3와 Spring AI를 AI 통합 계층으로 사용한다.

## Component Placement

```text
React Dashboard
  -> Node/Express Operations Backend
       -> archiveos-ai Spring Boot + Spring AI
            -> PostgreSQL + pgvector
            -> Obsidian Markdown Vault
            -> OpenAI ChatModel / EmbeddingModel
```

## Spring AI Runtime Flow

```text
Markdown
  -> Heading-aware chunking
  -> EmbeddingModel
  -> VectorStore / pgvector
  -> Retriever
  -> ChatModel
  -> Answer + References
```

## 핵심 API

- `GET /api/ai/runtime`
- `POST /api/ai/runtime/check`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`

Node backend는 Dashboard가 호출할 수 있도록 프록시를 제공하지만, AI 실행 경계는 `archiveos-ai`에 둔다.

## Runtime Observability

`GET /api/ai/runtime`은 추정값이 아니라 `archiveos-ai`가 관측한 실제 상태를 반환한다.

주요 관측 항목:

- Spring Boot 상태와 버전
- Spring AI 상태와 버전
- ChatModel 설정 여부, Bean 사용 가능 여부, 최근 호출 성공/실패
- EmbeddingModel 설정 여부, Bean 사용 가능 여부, 차원, 최근 호출 성공/실패
- PostgreSQL 연결 상태
- pgvector extension 설치 여부
- vector index 존재 여부와 index 방식
- Obsidian 문서 수
- chunk 수
- embedding 완료/pending/failed 수
- RAG 최근 search/ask/sync 시각
- 최근 latency
- 최근 reference 수

`POST /api/ai/runtime/check`는 명시적으로 호출할 때만 실제 ChatModel/EmbeddingModel smoke check를 수행한다.

## Vector Database

기본 개발 환경:

- Docker Compose PostgreSQL
- `pgvector/pgvector:pg16`

선택 가능한 운영/외부 환경:

- Supabase PostgreSQL with pgvector enabled

두 환경 모두 같은 개념의 저장 구조를 사용한다.

- `obsidian_documents`
- `obsidian_chunks`
- `embedding vector(1536)`
- cosine similarity search

## Security Boundaries

- `OPENAI_API_KEY`는 frontend에 노출하지 않는다.
- DB password와 전체 DB URL은 API 응답에 포함하지 않는다.
- Obsidian 로컬 절대 경로는 UI에 노출하지 않는다.
- RAG 실패는 fake success가 아니라 명확한 unavailable/error 상태로 반환한다.
- ArchiveOS UI는 visibility-first 원칙을 유지하고 shell/MCP/Codex control을 직접 실행하지 않는다.

## RAG Ready 기준

Spring AI Engine은 다음 조건을 만족할 때 RAG Ready로 판단한다.

- OpenAI API key가 설정되어 있다.
- ChatModel Bean을 사용할 수 있다.
- EmbeddingModel Bean을 사용할 수 있다.
- PostgreSQL + pgvector에 연결된다.
- Obsidian sync가 documents/chunks를 생성했다.
- embedding이 저장된 chunk가 있다.
- vector search가 scored references를 반환할 수 있다.
- `/api/rag/ask`가 answer와 references를 반환할 수 있다.
