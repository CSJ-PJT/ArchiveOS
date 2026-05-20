# ArchiveOS Backend

Minimal Express API for server-side ArchiveOS operations.

## Purpose

This service prepares ArchiveOS for secure server-side Supabase writes, command logging, and future integrations such as GitHub webhooks, AI review jobs, and MCP. The frontend still reads directly from Supabase for the current MVP.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=4000
```

`SUPABASE_SERVICE_ROLE_KEY` is a backend-only secret. Never expose it to the Vite frontend, never prefix it with `VITE_`, and never commit it.

## Supabase Client Note

This backend only uses Supabase REST-style table operations. The `ws` dependency is present because the current `@supabase/supabase-js` client initializes its realtime client during construction, and Node.js 20 requires an explicit WebSocket transport for that initialization. Do not use realtime APIs unless they are explicitly added later.

## Endpoints

### GET /health

Returns backend health status.

### GET /api/work-logs/recent

Returns the 20 most recent work logs, ordered by `created_at` descending. Includes task title and agent name when available.

### POST /api/work-logs

Creates a work log using the server-side Supabase admin client.

```json
{
  "task_id": null,
  "agent_id": null,
  "log_type": "summary",
  "content": "Short work log content"
}
```

Validation errors return `400`. Supabase or server errors return `500` without leaking secrets.

### GET /api/commands/recent

Returns the 20 most recent command runs, ordered by `created_at` descending.

### POST /api/commands

Records a command run without executing external actions.

```json
{
  "command": "review latest PR",
  "command_type": "typed",
  "status": "pending"
}
```

Only `pending` and `succeeded` mock command results are recorded for now. This endpoint does not call OpenAI, GitHub, MCP, or any external automation.
