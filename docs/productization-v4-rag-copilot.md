# Dashboard RAG operations copilot

The Dashboard title area contains an ArchiveOS operations copilot entry point. It reuses the existing Obsidian/pgvector RAG service and presents the actual runtime state without blocking the Dashboard or the SSE live mesh.

## Flow

1. After the dashboard core data renders, the UI reads `GET /api/ai/runtime` asynchronously.
2. **Operational question** is the default mode. A submitted question calls `POST /api/rag/ask` with a bounded snapshot of the current Dashboard runtime context.
3. **Knowledge search** calls `GET /api/rag/search?query=...` and displays document chunks directly.
4. Answer text, references, and the runtime context summary are displayed separately. A model suggestion is never represented as an executed command.

No request is made while typing. The application does not automatically call the model or run an Obsidian sync.

## Runtime states

- `READY`: chat and embedding models, vector store/index, and embedded chunks are all available.
- `SYNC_REQUIRED`: vector infrastructure is ready but chunks still need embedding.
- `MODEL_UNAVAILABLE`, `VECTOR_UNAVAILABLE`, `VAULT_UNAVAILABLE`, `DEGRADED`, and `UNAVAILABLE`: precise degraded states derived from `/api/ai/runtime`.

`지식 동기화` is shown only for `SYNC_REQUIRED`, and only to an ADMIN session. It invokes the existing `POST /api/obsidian/sync` endpoint and refreshes runtime telemetry after completion.

## References and evidence

References retain only title, heading, excerpt, score, and source type. The UI intentionally does not display absolute vault paths, credentials, database URLs, model secrets, stack traces, or local environment paths. A zero-reference result is explicitly labelled rather than implying evidence.

## Permissions and cost

Search is a read action. Asking is a user-submitted read action and does not write to an external service. Sync is explicit and permission-gated because it can cause embedding work. There is no auto-sync, auto-ask, or automatic long-term-memory write in this phase.

## Accessibility and failure isolation

The result panel uses a modal drawer with focus trapping, Escape/backdrop close, and focus return to the search input. On small screens it becomes a bottom sheet. RAG errors stay inside the copilot; they do not prevent Dashboard KPI, mesh, or SSE rendering.

## Deliberately deferred

The copilot does not automatically write answers back to Obsidian. A future operator-approved note-export flow can be considered only if an existing explicit export contract is available.
