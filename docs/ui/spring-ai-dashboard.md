# Spring AI Dashboard UI

The ArchiveOS UI is organized to show Spring AI as the core engine, not as a hidden backend detail.

## Overview

Overview now includes a **Spring AI Engine** section with:

- Spring AI status
- ChatModel
- EmbeddingModel
- VectorStore
- pgvector
- Obsidian Sync
- RAG Ready
- Last RAG Check

It also includes the RAG pipeline:

```text
Markdown -> Chunking -> Embedding -> VectorStore -> Retriever -> ChatModel -> Answer + References
```

This gives the PM a quick read on whether ArchiveOS is only observing operations or whether the AI knowledge engine is ready.

## Knowledge

Knowledge is reorganized as the **Spring AI Knowledge Engine**.

The top-level metrics emphasize:

- Documents
- Chunks
- Embeddings
- Vector Index
- Similarity Search
- References
- Last Sync
- RAG Status

The existing Operational Memory Graph remains available, but the screen now explains how memory moves through Spring AI RAG.

## Role Split

The UI should consistently communicate this split:

- React: operational screen and PM workflow.
- Node/Express: operations backend and proxy layer.
- Spring Boot 3 + Spring AI: RAG and future Agent engine.
- PostgreSQL + pgvector: vector store.
- Obsidian: long-term knowledge source.

## UI Safety

The dashboard remains read-only for execution:

- No shell execution UI.
- No MCP execution UI.
- No Codex direct control.
- No process start/stop controls.
- PM decision controls only record ArchiveOS task state.

## Portfolio Language Rule

Screens and docs should describe the system as an engineering product:

- Good: "Spring AI RAG engine", "VectorStore", "ChatModel", "EmbeddingModel", "pgvector"
- Avoid: generic portfolio claims or unsupported marketing language.
