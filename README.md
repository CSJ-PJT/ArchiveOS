# ArchiveOS

ArchiveOS is a small AI agent operations dashboard built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

## MVP scope

- Agent list with role, status, and current task
- Task queue grouped by status
- Recent work logs
- Memory / Decisions view backed by `work_logs` rows where `log_type = 'decision'`
- Frontend Supabase reads for the current dashboard
- Minimal backend API for server-side work log writes
- Command Center UI for quick actions, typed commands, and command history

No authentication, OpenAI API calls, GitHub webhooks, or MCP integrations are included yet.

## Command Center

The dashboard includes a Command Center panel with quick actions and a typed command box. At this stage, commands are only recorded as local UI history or backend `command_runs` rows. They do not call OpenAI, GitHub, MCP, or other external automation.

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
   ```

   Use the Supabase publishable key for this frontend app. Do not put a secret key in `.env.local`.

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
```

The service role key is server-only. Never use a `VITE_` prefix for it and never expose it to frontend code.

Health check:

```bash
curl http://localhost:4000/health
```

Command endpoints:

```bash
curl http://localhost:4000/api/commands/recent
curl -X POST http://localhost:4000/api/commands \
  -H "Content-Type: application/json" \
  -d '{"command":"review latest PR","command_type":"typed"}'
```

## Project structure

- `src/lib/supabase.ts` creates the Supabase browser client.
- `src/App.tsx` contains the MVP dashboard and decisions view.
- `src/types/database.ts` defines local TypeScript table types.
- `supabase/schema.sql` creates enums, tables, indexes, RLS policies, and grants.
- `supabase/seed.sql` inserts sample agents, tasks, and work logs.
- `backend/src/server.ts` exposes the minimal Express API.
- `backend/src/lib/supabaseAdmin.ts` creates the server-only Supabase admin client.
