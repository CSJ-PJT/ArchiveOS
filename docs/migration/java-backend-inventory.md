# ArchiveOS Java Backend Migration Inventory

## Baseline and objective

This inventory is the contract baseline for `feat/java-backend-migration`. React remains the UI and
the Node/TypeScript backend remains available until each endpoint has a tested Java replacement.
No backend implementation is removed merely because an equivalent appears to exist.

Current topology:

```text
React/Vite -> Node/Express :4000 -> Supabase Data API / local OS adapters
                              \-> Spring Boot :4100 -> PostgreSQL/pgvector
                                                     -> Spring AI / Batch
                                                     -> Discord / Slack
```

## Existing functionality and migration state

| Capability | Current implementation | Data/integration | Java state |
| --- | --- | --- | --- |
| Public API facade, CORS, endpoint matrix | Express `backend/src/server.ts` | HTTP aggregation | Not migrated |
| Liveness and AI readiness | Express + Spring | Runtime probes | Partial; Java provides real model/vector diagnostics |
| Chat and embedding runtime | Spring AI | OpenAI | Migrated |
| Obsidian ingestion/chunking | Spring plus duplicate Node indexer | Filesystem, PostgreSQL | Spring primary; Node duplicate remains |
| Vector search and RAG citations | Spring | pgvector HNSW, ChatModel | Migrated; hardening remains |
| Batch catalog, execution and steps | Spring Batch | Spring Batch metadata | Migrated |
| Nightly review and daily report | Spring plus Node duplicate | PostgreSQL/Supabase, webhooks | Cutover incomplete |
| RPA classification and decisions | Spring Batch/JDBC | PostgreSQL | Migrated; execution intentionally disabled |
| PM workflow queue | Spring with temporary Express pass-through | PostgreSQL PM tables | CRUD, decision, retry and summary migrated; run-once/nightly remain Node |
| Work logs and command records | Node | Supabase Data API | Not migrated |
| Dashboard, KPI and readiness | Node | Supabase and derived aggregation | Not migrated |
| Knowledge graph and historian | Node | Supabase, Obsidian | Not migrated |
| Architect and agent mesh | Node | Rules and Supabase | Not migrated |
| Local runtime diagnostics | Node | Windows processes/filesystem | Not migrated |
| Notifications | Spring and Node | Discord/Slack | Duplicate paths remain |
| Authentication/authorization | No enforced API boundary | public-read RLS, service-role writes | Not implemented |

## Existing API contract

The frontend contract is centralized in `src/lib/backendApi.ts`. Most successful responses use
`{ "data": ... }`; legacy health and diagnostics may return an unwrapped object. Validation failures
normally use `{ "error": "message" }`; proxied Spring errors may add `details`. These inconsistencies
are compatibility requirements until an explicitly versioned API replaces them.

| Family | Methods and paths | Contract notes | Java coverage |
| --- | --- | --- | --- |
| Health | `GET /health`, `/api/health`, `/api/health/endpoints` | `/health` is `{status,service}` | `/health` and Spring readiness implemented |
| Runtime | `GET /api/runtime/version`, `/public-access`, `/events/recent` | `{data}` envelope | version/public-access implemented |
| AX/readiness | `GET /api/ax/readiness`, `/roadmap`, `/api/platform/readiness` | derived metadata | Node only |
| AI | `GET /api/ai/runtime`; `POST /api/ai/runtime/check` | model/vector telemetry | Spring implemented |
| RAG | sync/documents/search/ask endpoints | ask body `{question}`; 503 when unavailable | Spring implemented |
| Batch | job catalog/run, execution list/detail | detail contains steps/context | Spring implemented |
| Operations | nightly/daily run, batch/report/snapshot reads | `{data}` envelope | Spring implemented behind Node facade |
| RPA | classify, recent/detail, decision | approve/reject/hold/request_retry | Spring implemented |
| Records | dashboard, work-log and command reads/writes | writes are recording-only | Node only |
| Workflow | task CRUD, decision, retry, queue endpoints | approval wait, iteration and event history | CRUD/decision/retry/summary in Spring; orchestration and nightly summary remain Node |
| Local runtime | projects/action/status | strict command allowlist | Node only |
| Security | `GET /api/security/status` | reports readiness; does not enforce access | Node only |
| Knowledge | historian and knowledge graph endpoints | read-heavy `{data}` contracts | Node only |
| Agents/KPI | architect, mesh and KPI endpoints | rules and aggregates | Node only |

Authentication is currently environmental rather than request-based. Node uses a server-only
`SUPABASE_SERVICE_ROLE_KEY`; React must never receive it. Optional ngrok identity settings are
reported but are not a Spring Security boundary.

## Database and pgvector

`supabase/schema.sql` enables `pgcrypto` and `vector` and defines:

- Core records: `agents`, `tasks`, `work_logs`, `command_runs`.
- Operations: `batch_runs`, `daily_reports`, `runtime_snapshots`.
- Knowledge: `historian_exports`, `architecture_reviews`, `knowledge_nodes`, `knowledge_edges`.
- Workflow: `pm_tasks`, `pm_task_decisions`, `pm_task_events`.
- RAG: `obsidian_documents`, `obsidian_chunks`, `vector(1536)`, HNSW cosine index and
  `match_obsidian_chunks`.

RLS is enabled on the exposed public tables, but current policies allow public reads without an
ownership predicate. Spring uses a direct database user while Node writes through Supabase service
role. This split must be replaced by one explicit authorization model. Flyway now owns the PM
workflow table bootstrap (`V1__create_pm_workflow_tables.sql`); the remaining tables still need
versioned reconciliation with `supabase/schema.sql` before Node removal.

## Migration progress

- Spring owns PM task list/detail/create/update, PM decision/retry, event recording and queue summary.
- Decision, task state and event writes share a Spring transaction boundary.
- Express preserves the browser-facing paths and relays status/body without reimplementing workflow rules.
- Flyway baseline-on-migrate supports both the existing non-empty schema and a fresh PostgreSQL database.
- Verified path: frontend-compatible `:4000` request -> Spring `:4100` -> PostgreSQL, including Flyway v1/v2,
  task creation, patch, decision, validation error and persisted event history.
- Node still owns queue `run-once`, architect/builder/reviewer orchestration and nightly notification;
  these must move before the queue module can be removed.

## Target Spring structure

```text
com.archiveos
  api/             controllers and compatibility DTOs
  application/     use cases and transaction boundaries
  domain/          workflow, agent, batch, knowledge and audit models
  persistence/     JDBC/JPA repositories and Flyway migrations
  integration/     AI, Slack, Discord, Supabase transition and OS adapters
  security/        authentication, principals and authorization
  scheduling/      triggers only; business rules remain in services
  batch/           jobs, steps and execution projections
  configuration/   typed properties, CORS and observability
  error/           global exception handler and legacy-compatible errors
```

Controllers do not access storage or external systems directly. Public DTOs remain separate from DB
records so schema changes do not accidentally alter the browser contract.

## Migration order

1. Freeze API contracts and migrate liveness/basic runtime configuration.
2. Introduce Flyway and reconcile Supabase schema with Spring runtime DDL. (PM workflow bootstrap complete)
3. Migrate core records, dashboard aggregates and runtime events.
4. Migrate PM workflow state/history/retry/approval transactionally. (core APIs complete; orchestration remains)
5. Migrate knowledge, historian, architect, mesh and KPI services.
6. Add Spring Security and revise broad public-read policies.
7. Migrate local runtime and process access behind allowlisted Java ports.
8. Cut over scheduler and notifications to one owner with idempotency evidence.
9. Point React directly to Spring, run contract/E2E tests, then retire Express.

## Removal gates

The Node backend is **not removable**. Removal requires Java coverage for every frontend-used route,
request/response/error compatibility tests, repeatable database migrations, authenticated writes,
single-owner scheduling, frontend E2E evidence, production observation and a tested rollback path.

## Priority TODO

1. Add contract tests for every frontend-used endpoint and legacy error envelope.
2. Expand Flyway coverage from PM workflow tables to the remaining existing schema.
3. Migrate PM run-once orchestration, task event reads and nightly summary/notification ownership.
4. Migrate work-log/command CRUD and dashboard projections.
5. Introduce Spring Security before exposing Java write APIs.
6. Add deleted-document reconciliation, embedding retry/dimension checks, score thresholds and
   structured citations to RAG.
7. Add Batch timeline, duration, pagination and failure summaries.
8. Migrate knowledge, historian, architect, mesh and KPI modules.
9. Implement Java OS adapters with the current filesystem and command allowlists.
10. Remove Node proxy hops only after parity is proven.

## Risks and unverified areas

- No OpenAPI baseline; Express response shapes vary.
- Public-read RLS is broader than an authenticated operator model.
- `vector(1536)` couples persistence to one embedding model dimension.
- Node and Spring duplicate scheduler, notification and ingestion behavior.
- Windows-specific process access cannot be copied blindly into a container.
- Real hosted Supabase advisor/policy behavior, real OpenAI calls, Discord/Slack delivery, ngrok
  identity enforcement, concurrent retry behavior and direct React-to-Spring E2E remain unverified.
