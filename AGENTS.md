# ArchiveOS Agent Rules

## Product scope

- Keep ArchiveOS focused on agent operations visibility.
- Do not add authentication until the dashboard workflow needs it.
- Do not add OpenAI API calls yet.
- Do not add MCP integrations yet.
- Keep the MVP frontend-only with direct Supabase reads.

## Engineering rules

- Use React, Vite, TypeScript, Tailwind CSS, and Supabase.
- Store browser-safe Supabase config in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Never commit Supabase secret keys or service role keys.
- Keep schema changes mirrored in `supabase/schema.sql`.
- Keep sample data in `supabase/seed.sql`.
- Prefer small, readable components over broad abstractions.

## Data model

- `agents` stores AI worker identity and operational state.
- `tasks` stores queue items and optional assignment to an agent.
- `work_logs` stores summaries, decisions, errors, and reviews.
- Memory / Decisions reads from `work_logs` where `log_type = 'decision'`.
