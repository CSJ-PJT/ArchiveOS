# Archive-Nexus API contract

Archive-Nexus is a separate manufacturing application. It must treat ArchiveOS as an external platform API and must not depend on ArchiveOS local files, Docker volumes, or in-process Java classes.

## Base URL

Local Compose default:

```text
ARCHIVEOS_BASE_URL=http://host.docker.internal:4000
```

This points to the ArchiveOS Node compatibility API. The Node backend currently proxies Java runtime telemetry to `archiveos-ai` through `ARCHIVEOS_AI_BASE_URL=http://archiveos-ai:4100` inside ArchiveOS Compose.

Direct Java runtime checks are available on the host at:

```text
http://localhost:4100
```

Archive-Nexus should override `ARCHIVEOS_BASE_URL` when ArchiveOS runs on a different host or network.

## Service-to-service authorization

ArchiveOS rejects public CUD requests. Archive-Nexus must send the shared integration token for workflow creation, approval sync, and action result callbacks:

```http
X-ArchiveOS-Integration-Token: ${ARCHIVEOS_INTEGRATION_TOKEN}
```

The token is configured only through local `.env` / deployment environment variables and must not be committed.

## Health endpoint consumed by Archive-Nexus

Archive-Nexus calls:

```http
GET {ARCHIVEOS_BASE_URL}/api/health
```

The ArchiveOS Node compatibility API returns a platform summary. Archive-Nexus currently treats the response as:

- `UNAVAILABLE` when the request fails, times out, returns a non-2xx status, or the platform health is not OK.
- `DEGRADED` when ArchiveOS is reachable but one or more optional services are unavailable.
- `AVAILABLE` when ArchiveOS is reachable and platform health is OK without optional-service degradation.

Archive-Nexus must keep its manufacturing simulation and dashboard readable when ArchiveOS is `DEGRADED` or `UNAVAILABLE`.

Expected Node compatibility health shape:

```json
{
  "status": "ok",
  "service": "archiveos-backend",
  "timestamp": "ISO-8601 timestamp",
  "services": {
    "database": true,
    "ai": true,
    "runtime": true
  },
  "version": {
    "commit": "git sha or unknown",
    "branch": "git branch or unknown"
  }
}
```

Archive-Nexus marks the platform as `DEGRADED` if any value in `services` is `false`.

## Java runtime telemetry

ArchiveOS Java runtime exposes:

```http
GET http://localhost:4100/api/health
GET http://localhost:4100/api/ai/runtime
```

The Node compatibility API exposes the runtime endpoint for UI and external consumers:

```http
GET {ARCHIVEOS_BASE_URL}/api/ai/runtime
```

Node wraps the Java runtime payload as:

```json
{
  "data": {
    "status": "healthy | degraded | unavailable",
    "checkedAt": "ISO-8601 timestamp",
    "springBoot": { "status": "up", "version": "3.3.7" },
    "springAi": { "status": "up | down", "version": "1.0.0" },
    "chatModel": {
      "configured": true,
      "beanAvailable": true,
      "available": true
    },
    "embeddingModel": {
      "configured": true,
      "beanAvailable": true,
      "available": true
    },
    "vectorStore": {
      "available": true,
      "databaseConnected": true,
      "extensionInstalled": true,
      "indexType": "hnsw",
      "indexReady": true
    },
    "knowledge": {},
    "rag": { "ready": true },
    "obsidian": { "configured": true, "reachable": true }
  }
}
```

The direct Java `/api/health` endpoint returns:

```json
{
  "status": "UP | DEGRADED | DOWN",
  "module": "archiveos-ai",
  "aiProvider": "openai",
  "checkedAt": "ISO-8601 timestamp",
  "components": {
    "springAi": {},
    "chatModel": {},
    "embeddingModel": {},
    "vectorStore": {},
    "obsidian": {},
    "rag": {}
  }
}
```

## Expected no-key behavior

When `OPENAI_API_KEY` is missing, ArchiveOS Java runtime must remain running:

- `/api/health` returns HTTP 200 with `status: "DEGRADED"`.
- `/api/ai/runtime` returns HTTP 200 with `status: "degraded"`.
- `vectorStore.available` remains `true` when PostgreSQL and pgvector are ready.
- `chatModel.configured` and `embeddingModel.configured` are `false`.

This is normal for local and review environments. It is not an outage unless the runtime becomes unreachable or the status moves to `DOWN` / `unavailable`.

## Workflow and callback contract

Archive-Nexus creates ArchiveOS workflow records through the compatibility API:

```http
POST {ARCHIVEOS_BASE_URL}/api/tasks
PATCH {ARCHIVEOS_BASE_URL}/api/tasks/{workflowId}
GET {ARCHIVEOS_BASE_URL}/api/tasks/{workflowId}
POST {ARCHIVEOS_BASE_URL}/api/tasks/{workflowId}/callback
GET {ARCHIVEOS_BASE_URL}/api/tasks/{workflowId}/events
```

The create request carries `metadata.source=archive-nexus`, `metadata.source_task_id`, `metadata.correlation_id`, and `metadata.requested_by`. ArchiveOS preserves that metadata in `pm_tasks.metadata` and upserts `workflow_contracts` with:

- `correlationId`
- `projectId`
- `workflow`
- `execution`
- `approval`
- `evidence`
- `result`

Contract reads are available at:

```http
GET {ARCHIVEOS_BASE_URL}/api/contracts/workflow/schema
GET {ARCHIVEOS_BASE_URL}/api/contracts/workflow
GET {ARCHIVEOS_BASE_URL}/api/contracts/workflow/{correlationId}
```

## Current migration boundary

Node backend is still required as the compatibility API during the incremental Java migration. Archive-Nexus should continue to target ArchiveOS through the documented HTTP API and must not assume the Node backend has been removed.
