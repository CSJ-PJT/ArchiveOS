# Spring AI Dashboard UI

ArchiveOS UI는 Spring AI를 숨겨진 backend detail이 아니라 운영자가 직접 확인하는 지식 엔진 상태로 보여준다. 단, 값은 반드시 `archiveos-ai` runtime API에서 관측한 실제 값만 사용한다.

## Overview

Overview의 Spring AI Engine 영역은 `/api/ai/runtime` 응답을 사용한다.

표시 항목:

- Spring Boot
- Spring AI
- ChatModel
- EmbeddingModel
- VectorStore / pgvector
- Vector Index
- Obsidian Sync
- RAG Ready
- Recent Latency
- Recent References
- Last RAG Check

사용하지 않는 잘못된 대체값:

- Embeddings를 Knowledge Graph node 수로 대체하지 않는다.
- Vector Index를 edge 존재 여부로 대체하지 않는다.
- References를 edge 수로 대체하지 않는다.
- Last RAG Check를 readiness 생성 시각으로 대체하지 않는다.
- ChatModel/EmbeddingModel 상태를 endpoint 존재 여부로 대체하지 않는다.

## Knowledge

Knowledge 화면의 Spring AI Knowledge Engine 값은 `/api/ai/runtime`의 telemetry를 사용한다.

| UI 항목 | Runtime 필드 |
|---|---|
| Documents | `knowledge.documents` |
| Chunks | `knowledge.chunks` |
| Embeddings | `knowledge.embeddedChunks` |
| Pending | `knowledge.pendingEmbeddings` |
| Failed | `knowledge.failedEmbeddings` |
| Vector Index | `vectorStore.indexReady` / `vectorStore.indexType` |
| Similarity Search | `rag.lastSearchAt` |
| References | `rag.lastReferenceCount` |
| Last Sync | `knowledge.lastSyncAt` |
| RAG Status | `rag.ready` |

Operational Memory Graph의 node/edge metric은 유지하되, Spring AI metric과 섞어 쓰지 않는다.

## Settings

Settings는 Spring AI 상태를 한 줄 요약으로 보여주고, 펼침 영역에서 다음을 표시한다.

- runtime status
- ChatModel model/status
- EmbeddingModel model/dimensions/status
- RAG ready 여부
- Docker/PostgreSQL 검증은 CLI/Compose 검증 결과를 따른다는 안내

Docker 설치나 compose 실행은 UI에서 수행하지 않는다.

## 상태 표현

상태는 다음 의미로 사용한다.

- `healthy`: 실제 연결 또는 최근 호출 성공
- `working`: 작업 진행 중
- `degraded`: 설정은 있으나 일부 조건 부족
- `unavailable`: 연결 또는 필수 Bean/DB 사용 불가
- `not_configured`: 환경변수 또는 vault 설정 없음
- `stale`: 실행 이력이 오래되었거나 아직 없음
- `unknown`: API 응답을 아직 받지 못함

카드 하나가 실패해도 화면 전체가 무너지지 않아야 한다.

## 수동 검증

```powershell
curl http://localhost:4000/api/ai/runtime
curl -X POST http://localhost:4000/api/ai/runtime/check
```

Docker 기반 E2E 검증:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1
```

성공 시 Overview와 Knowledge 화면에서 documents/chunks/embeddings, pgvector index, RAG latency/reference count가 실제 값으로 표시된다.
