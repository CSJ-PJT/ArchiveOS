# ArchiveOS Backend

Minimal Express API for server-side ArchiveOS operations.
Current Phase 3 behavior prioritizes read-only PM visibility and safe command recording.

## Purpose

This service prepares ArchiveOS for secure server-side Supabase writes, command logging, and future integrations such as GitHub webhooks, AI review jobs, and MCP. The frontend still reads directly from Supabase for the current MVP.
It does not provide arbitrary command execution, Codex process control, OpenAI calls, GitHub automation, or MCP integration.

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
ARCHIVEOS_PROJECT_PATH=
CODEX_IMPLEMENTER_PID=
CODEX_REVIEWER_PID=
```

`SUPABASE_SERVICE_ROLE_KEY` is a backend-only secret. Never expose it to the Vite frontend, never prefix it with `VITE_`, and never commit it.
`ARCHIVEOS_PROJECT_PATH` should point to the ArchiveOS repository root when running local project actions.
`CODEX_IMPLEMENTER_PID` and `CODEX_REVIEWER_PID` are optional local visibility hints for manually started Codex terminals. They are not secrets, but they are session-specific and should stay in local `.env`.

## Local Action Security

ArchiveOS never executes arbitrary shell commands from user input. Local project actions are selected by predefined action IDs and mapped to fixed `spawn` commands on the backend. Request bodies cannot provide custom paths or custom command strings.

## Supabase Client Note

This backend currently uses Supabase table operations only, but Node.js 20 does not provide the native WebSocket support expected by the current Supabase realtime client initialization. The `ws` dependency is kept only as the required transport so the service role client can be constructed. Do not add realtime features unless they are explicitly planned later.

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
  "command": "summarize current queue",
  "command_type": "typed",
  "status": "pending"
}
```

Only recorded command intents are stored for now. This endpoint does not call OpenAI, GitHub, MCP, or any external automation.

### GET /api/local-actions/projects

Returns the static allowlisted local projects configured on the backend.

### POST /api/local-actions/run

Runs one allowlisted local action and records the result to `command_runs`.

```json
{
  "project_id": "archiveos",
  "action": "git_status"
}
```

Allowed actions are `git_status`, `git_branch`, `git_log_recent`, `frontend_build`, `backend_typecheck`, and `backend_build`.

### GET /api/local-runtime/status

Returns a read-only snapshot of the local Codex loop, implementer process, reviewer bridge process, and queue folders when they can be detected. This endpoint does not control processes and does not execute user-provided commands.
