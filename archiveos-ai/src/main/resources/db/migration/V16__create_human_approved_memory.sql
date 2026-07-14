create table if not exists public.ai_memory_records (
 id uuid primary key default gen_random_uuid(), memory_id text not null unique, source_recommendation_id text not null unique,
 status text not null check(status in ('DRAFT','APPROVED','WRITTEN','SYNC_PENDING','EMBEDDED','FAILED')),
 title text not null, memory_type text not null, service text, correlation_id text, entity_id text,
 draft jsonb not null, relative_path text, content_hash text, approved_by text, approval_reason text,
 written_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ai_memory_records_status_idx on public.ai_memory_records(status, created_at desc);
alter table public.ai_memory_records enable row level security;
