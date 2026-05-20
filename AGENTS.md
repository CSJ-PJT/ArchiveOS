# ArchiveOS Agent Rules

## Product scope

- Keep ArchiveOS focused on agent operations visibility.
- Treat Phase 3 as a read-only PM operations dashboard with safe recording, not an execution console.
- Do not add authentication until the dashboard workflow needs it.
- Do not add OpenAI API calls yet.
- Do not add MCP integrations yet.
- Keep the current frontend Supabase reads working until a deliberate migration is planned.
- Route write operations and future integrations through the backend.
- Command Center actions are recording-only until OpenAI, GitHub, or MCP integrations are explicitly added.
- Local project actions must stay allowlisted and must never execute arbitrary user-provided shell commands or paths.
- Local runtime status is read-only visibility; do not add process control without an explicit design review.

## Engineering rules

- Use React, Vite, TypeScript, Tailwind CSS, and Supabase.
- Store browser-safe Supabase config in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Never commit Supabase secret keys or service role keys.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code or any `VITE_` environment variable.
- The frontend uses only `VITE_SUPABASE_ANON_KEY`; the backend owns service-role writes.
- Keep schema changes mirrored in `supabase/schema.sql`.
- Keep sample data in `supabase/seed.sql`.
- Prefer small, readable components over broad abstractions.

## Data model

- `agents` stores AI worker identity and operational state.
- `tasks` stores queue items and optional assignment to an agent.
- `work_logs` stores summaries, decisions, errors, and reviews.
- Memory / Decisions reads from `work_logs` where `log_type = 'decision'`.
