# Knowledge read API migration contract

Knowledge reads are owned by Spring Boot. The Node backend keeps the public compatibility routes on port 4000 and forwards them to the same paths on the Java runtime on port 4100. Knowledge writes, Historian export, Architect, and PM Queue remain outside this migration.

## Routes

| Method | Path | Query | Success `data` |
| --- | --- | --- | --- |
| GET | `/api/knowledge/health` | none | Repository, Obsidian, pgvector, and index state |
| GET | `/api/knowledge/overview` | none | Counts by type and latest nodes/edges |
| GET | `/api/knowledge/recent` | `limit` (1-100, default 20) | Knowledge node array |
| GET | `/api/knowledge/search` | `q`, `limit` | Case-insensitive title/summary/external-ref matches; blank `q` returns `[]` |
| GET | `/api/knowledge/related` | `external_ref`, `node_type` | Node detail groups; no filters returns `[]` |
| GET | `/api/knowledge/graph` | `limit` (1-300, default 100) | Graph nodes, edges, and stats |
| GET | `/api/knowledge/map` | same as graph | Browser-safe graph alias |
| GET | `/api/knowledge/graph/insights` | `limit` | Importance, decision-chain, and graph-health insights |
| GET | `/api/knowledge/map/insights` | same as insights | Browser-safe insights alias |
| GET | `/api/knowledge/node/{id}` | path id | Node, outgoing, incoming, and combined related edges |

All successful reads preserve the existing `{ "data": ... }` envelope. A missing node returns HTTP 404 with `{ "error": "Knowledge node not found." }`. Other repository failures preserve the route-specific HTTP 500 error text. If tables are absent or data is empty, collection APIs return their stable empty shape rather than terminating the Java runtime.

## Storage and degraded operation

- `knowledge_nodes` and `knowledge_edges` remain the operational graph read model.
- `obsidian_documents` and `obsidian_chunks` remain the indexed document/chunk source.
- pgvector diagnostics are included in Knowledge health.
- Read APIs do not call OpenAI and continue to work without `OPENAI_API_KEY`.
- Node keeps its prior Knowledge implementation for rollback/equivalence review, but public routes delegate to Java.

## Compatibility health

Node `/api/health` sets `services.knowledge` from Java `/api/knowledge/health`. It is `true` only when the Java knowledge tables and PostgreSQL connection are available. Empty data remains a valid readable state and is reported as `empty` by the Java health response.

## Local performance baseline

Measured on the Compose runtime with the existing empty read model, five requests per route:

| Route | Java average | Node compatibility average | Response bytes |
| --- | ---: | ---: | ---: |
| health | 64.8 ms | 85.5 ms | 214 |
| overview | 40.6 ms | 51.7 ms | 92 |
| recent | 38.5 ms | 45.3 ms | 11 |
| search | 36.3 ms | 40.7 ms | 11 |
| related | 37.9 ms | 46.4 ms | 11 |
| map | 38.9 ms | 43.2 ms | 81 |
| map insights | 39.6 ms | 44.4 ms | 477 |

The Java and Node response bodies were byte-identical for every measured route. Limits cap graph reads at 300 nodes and collection reads at 100 nodes to bound response size.
