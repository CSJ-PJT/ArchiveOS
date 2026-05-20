# ArchiveOS

ArchiveOS is a small AI agent operations dashboard built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

## MVP scope

- Agent list with role, status, and current task
- Task queue grouped by status
- Recent work logs
- Memory / Decisions view backed by `work_logs` rows where `log_type = 'decision'`
- Frontend-only Supabase reads

No authentication, backend server, OpenAI API calls, or MCP integrations are included yet.

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

## Project structure

- `src/lib/supabase.ts` creates the Supabase browser client.
- `src/App.tsx` contains the MVP dashboard and decisions view.
- `src/types/database.ts` defines local TypeScript table types.
- `supabase/schema.sql` creates enums, tables, indexes, RLS policies, and grants.
- `supabase/seed.sql` inserts sample agents, tasks, and work logs.
