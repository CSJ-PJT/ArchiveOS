# ArchiveOS

ArchiveOS is a small AI agent operations dashboard built with React, Vite, TypeScript, Tailwind CSS, and Supabase.
Phase 3 is intentionally a read-only PM visibility and recording dashboard, not an execution console.

## MVP scope

- Agent list with role, status, and current task
- Task queue grouped by status
- Recent work logs
- Memory / Decisions view backed by `work_logs` rows where `log_type = 'decision'`
- Frontend Supabase reads for the current dashboard
- Minimal backend API for server-side work log writes
- Command Center UI for recorded quick actions, typed command intent, and command history
- PM dashboard panels for workflow state, actual MCP builder/reviewer results, decisions, stale warnings, and screenshot freshness zero-states
- Event Timeline derived from live runtime state, backend judgement, and non-seed Supabase command/decision records

No authentication, OpenAI API calls, GitHub webhooks, or MCP integrations are included yet.

## Command Center

The dashboard includes a Command Center panel with recorded quick actions, a typed command box, backend health status, and recent command history loaded from the backend API. At this stage, commands are only recorded as backend `command_runs` rows. They do not call OpenAI, GitHub, MCP, or other external automation.

It also includes a read-only Codex Runtime panel for local visibility into the detected loop process, implementer Codex process, reviewer bridge, and queue counts. This panel does not control Codex and does not execute arbitrary commands.

Local Diagnostics are separated from command recording and are marked as allowlisted checks. ArchiveOS never accepts arbitrary shell commands from the UI.

## Event Timeline

The Event Timeline is a read-only PM visibility surface. It calls `GET /api/runtime/events/recent` and derives normalized events from existing sources only: MCP queue/runtime files, latest builder and reviewer result payloads, backend runtime judgement, and non-seed Supabase `command_runs` or decision `work_logs`.

ArchiveOS does not create a separate event bus yet, and execution control is still intentionally disabled. Timeline entries are summaries for PM context, not full builder/reviewer logs.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   ```bash
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   VITE_BACKEND_URL=http://localhost:4000
   ```

   Use the Supabase publishable key for this frontend app. Do not put a secret key in `.env.local`.
   `VITE_BACKEND_URL` points the Command Center to the local backend API.

3. In the Supabase SQL editor, run:

   ```sql
   -- supabase/schema.sql
   -- then supabase/seed.sql
   ```

4. Start the local app:

   ```bash
   npm run dev
   ```

## Build

```bash
npm run build
```

## Backend API

The `backend/` service exists for secure server-side writes and future integrations. The current frontend still reads directly from Supabase and is not blocked by the backend.

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend environment variables:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
ARCHIVEOS_PROJECT_PATH=/absolute/path/to/ArchiveOS
CODEX_IMPLEMENTER_PID=optional-local-codex-pid
CODEX_REVIEWER_PID=optional-local-codex-pid
MCP_REPO_PATH=optional-local-mcp-repo-path
MCP_QUEUE_PATH=optional-local-mcp-queue-path
```

The service role key is server-only. Never use a `VITE_` prefix for it and never expose it to frontend code.
`ARCHIVEOS_PROJECT_PATH` lets the backend run allowlisted local actions against this repository. ArchiveOS never executes arbitrary typed shell commands; it only maps predefined action IDs to fixed commands.
The optional Codex PID variables help the read-only runtime panel distinguish manually started implementer and reviewer terminals during local testing. Update them whenever those Codex sessions restart.
If the MCP queue lives outside the ArchiveOS repository, set `MCP_QUEUE_PATH` to the queue directory so the read-only runtime panel can display live counts and latest files.

Health check:

```bash
curl http://localhost:4000/health
```

Command endpoints:

```bash
curl http://localhost:4000/api/commands/recent
curl -X POST http://localhost:4000/api/commands \
  -H "Content-Type: application/json" \
  -d '{"command":"summarize current queue","command_type":"typed"}'
```

Local action endpoints:

```bash
curl http://localhost:4000/api/local-actions/projects
curl -X POST http://localhost:4000/api/local-actions/run \
  -H "Content-Type: application/json" \
  -d '{"project_id":"archiveos","action":"git_status"}'
```

Local runtime status:

```bash
curl http://localhost:4000/api/local-runtime/status
```

Derived runtime events:

```bash
curl http://localhost:4000/api/runtime/events/recent
```

## Project structure

- `src/lib/supabase.ts` creates the Supabase browser client.
- `src/App.tsx` contains the MVP dashboard and decisions view.
- `src/types/database.ts` defines local TypeScript table types.
- `supabase/schema.sql` creates enums, tables, indexes, RLS policies, and grants.
- `supabase/seed.sql` inserts sample agents, tasks, and work logs.
- `backend/src/server.ts` exposes the minimal Express API.
- `backend/src/lib/supabaseAdmin.ts` creates the server-only Supabase admin client.
- `backend/src/lib/localRuntime.ts` reads local Codex loop status without process control.
