# Productization V4 RAG audit

Audit date: 2026-07-12. The Dashboard copilot reuses the existing ArchiveOS RAG implementation; it does not introduce another search or answer engine.

| Item | Exists | Actual behavior | UI exposure | Issue | Action |
|---|---|---|---|---|---|
| OpenAI ChatModel | Yes | Bean is present; the current local runtime reports no configured model | Runtime metadata | Model credentials are not configured locally | Show `MODEL_UNAVAILABLE`; do not claim readiness |
| OpenAI EmbeddingModel | Yes | Bean is present; the current local runtime reports no configured embedding model | Runtime metadata | Existing chunks are pending embedding | Keep sync explicit and show the actual state |
| Obsidian sync | Yes | `POST /api/obsidian/sync` performs the existing sync | Dashboard copilot for ADMIN only when sync is required | Never run it automatically because it can invoke embedding work | Explicit button only |
| Heading-aware chunking | Yes | `ObsidianChunker` stores heading-aware chunks | Existing Knowledge UI and copilot references | None | Reuse existing references |
| PostgreSQL + pgvector | Yes | Runtime reports database, vector extension, and HNSW index readiness | Runtime metadata | None in this local runtime | Keep readiness-derived state |
| Similarity search | Yes | `GET /api/rag/search` returns stored document references in the current local runtime | Knowledge-search mode | Search can fall back without an embedding model | Identify the result as a document reference, not an invented answer |
| RAG ask | Yes | `POST /api/rag/ask` returns answer text and references; current model-unavailable runtime uses the existing fallback | Operational-question mode | Full model answer is unavailable until model configuration is supplied | Show actual model state and references |
| Runtime telemetry | Yes | `/api/ai/runtime` reports model, vector, vault, document, chunk, latency, and error state | Compact status line | Dashboard must not block on it | Load after the core dashboard data |
| Node proxy | Yes | Existing Node routes proxy runtime, sync, documents, search, and ask to `archiveos-ai` | Typed frontend API functions | Context was not previously forwarded | Add an optional, backward-compatible `context` payload |

## Current verified runtime

The checked local runtime reported 66 indexed documents, 359 chunks, 0 embedded chunks, and 359 pending embeddings. PostgreSQL/pgvector and the HNSW index were available, while ChatModel and EmbeddingModel configuration was unavailable. The UI therefore shows **model unavailable** rather than a false `READY` state.

## Security boundary

The Dashboard only sends a bounded runtime context: ecosystem status, service statuses, active events, approval/processing backlog, balance status/reason, at most 20 recent synthetic runtime events, and optionally a selected service or correlation ID. The server whitelists these keys, strips secret-like values, truncates text, and does not receive vault paths, database URLs, passwords, tokens, or API keys from the browser.

## Screenshot evidence

The captured screenshots reflect the verified local `MODEL_UNAVAILABLE` runtime and actual fallback answer/reference response. `READY` and `SYNC_REQUIRED` screenshots were intentionally not fabricated because the local model configuration is absent. The available evidence is stored under `docs/screenshots/productization-v4-rag-copilot/`.
