# Spring AI Engine Architecture

ArchiveOS is positioned as a Spring AI centered AX operations platform.

The product has three clear runtime responsibilities:

1. **React Dashboard**
   - Presents PM operations, workflow state, Knowledge status, RAG status, and settings.
   - Does not expose secrets.
   - Does not execute shell, MCP, Codex, or process control.

2. **Node/Express Operations Backend**
   - Owns PM operations, Agent state, MCP visibility, Dashboard API, Discord notifications, Supabase operational records, and task queue state.
   - Proxies selected AI/RAG requests to `archiveos-ai`.
   - Keeps webhook URLs, service role keys, and local paths backend-only.

3. **archiveos-ai Spring Boot Module**
   - Owns Obsidian ingestion, heading-aware chunking, OpenAI embeddings, PostgreSQL + pgvector storage, vector similarity search, RAG answer generation, and future AI Agent behavior.
   - Uses Spring Boot 3 and Spring AI as the core AI integration layer.

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

## Core Interfaces

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
- `GET /api/ai/runtime`
- `GET /api/health`

The Node backend may proxy public dashboard calls, but the AI execution boundary belongs to `archiveos-ai`.

## Vector Database

Default development target:

- Docker Compose PostgreSQL
- `pgvector/pgvector:pg16`

Optional production target:

- Supabase PostgreSQL with pgvector enabled

Both targets use the same conceptual storage:

- `obsidian_documents`
- `obsidian_chunks`
- `embedding vector(1536)`
- cosine similarity search

## Security Boundaries

- `OPENAI_API_KEY` is never exposed to the frontend.
- Database credentials are backend-only.
- Obsidian local vault paths are not returned to public UI.
- RAG failure returns explicit unavailable/error status rather than fake success.
- ArchiveOS UI remains visibility-first and does not execute shell/MCP/Codex controls.

## Definition of Ready for RAG

Spring AI Engine is considered RAG ready when:

- OpenAI API key is configured.
- ChatModel bean is available.
- EmbeddingModel bean is available.
- PostgreSQL + pgvector is reachable.
- Obsidian sync has created documents and chunks.
- Vector search returns scored references.
- `/api/rag/ask` returns an answer with references.
