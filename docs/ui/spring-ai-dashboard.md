# Spring AI Dashboard UI

ArchiveOS UI는 Spring AI를 숨겨진 backend detail이 아니라 운영자가 직접 확인하는 핵심 엔진으로 보여준다.

## Overview

Overview는 **Spring AI Engine** 섹션을 제공한다.

- Spring Boot
- Spring AI
- ChatModel
- EmbeddingModel
- VectorStore / pgvector
- Vector Index
- Obsidian Sync
- RAG Ready
- 최근 latency
- 최근 references 수
- Last RAG Check

RAG pipeline은 다음 순서로 표시한다.

```text
Markdown -> Chunking -> Embedding -> VectorStore -> Retriever -> ChatModel -> Answer + References
```

중요 원칙:

- ChatModel 상태는 `/api/ai/runtime`의 `chatModel` 관측값을 사용한다.
- EmbeddingModel 상태는 `/api/ai/runtime`의 `embeddingModel` 관측값을 사용한다.
- pgvector와 Vector Index 상태는 DB 진단 결과를 사용한다.
- Last RAG Check는 AX readiness 시간이 아니라 `checkedAt`과 RAG 실행 메트릭을 사용한다.
- Knowledge node/edge 수를 embedding, index, reference 수로 대체하지 않는다.

## Knowledge

Knowledge는 **Spring AI Knowledge Engine** 중심으로 구성한다.

상단 통계는 실제 runtime telemetry만 사용한다.

- Documents = `knowledge.documents`
- Chunks = `knowledge.chunks`
- Embeddings = `knowledge.embeddedChunks`
- Pending = `knowledge.pendingEmbeddings`
- Failed = `knowledge.failedEmbeddings`
- Vector Index = `vectorStore.indexReady` / `vectorStore.indexType`
- Similarity Search = `rag.lastSearchAt`
- References = `rag.lastReferenceCount`
- Last Sync = `knowledge.lastSyncAt`
- RAG Status = `rag.ready`

기존 Operational Memory Graph는 유지한다. 다만 Spring AI runtime metric과 Knowledge Graph node/edge metric의 의미를 섞지 않는다.

## 역할 분리

- React: operational screen and PM workflow
- Node/Express: operations backend and proxy layer
- Spring Boot 3 + Spring AI: RAG and future Agent engine
- PostgreSQL + pgvector: vector store
- Obsidian: long-term knowledge source

## UI 안전 원칙

- No shell execution UI
- No MCP execution UI
- No Codex direct control
- No process start/stop controls
- PM decision controls only record ArchiveOS task state

## 문서 작성 원칙

화면과 문서는 실제 구현된 기술과 관측 가능한 상태를 기준으로 작성한다.

- 사용 권장: "Spring AI RAG engine", "VectorStore", "ChatModel", "EmbeddingModel", "pgvector"
- 사용 지양: 실제 구현과 연결되지 않는 추상적 홍보 문구
