create table if not exists public.ai_incidents (
 id uuid primary key default gen_random_uuid(), incident_id text not null unique, fingerprint text not null unique,
 status text not null check(status in ('DETECTED','ANALYZING','REVIEW_REQUIRED','ACKNOWLEDGED','RESOLVED','CLOSED')),
 severity text not null, title text not null, affected_services jsonb not null default '[]'::jsonb,
 correlation_ids jsonb not null default '[]'::jsonb, signals jsonb not null default '[]'::jsonb,
 runtime_evidence jsonb not null default '[]'::jsonb, analysis jsonb not null default '{}'::jsonb,
 references_json jsonb not null default '[]'::jsonb, recommended_actions jsonb not null default '[]'::jsonb,
 owner text, resolution text, memory_id text, detected_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ai_incidents_status_idx on public.ai_incidents(status, detected_at desc);
alter table public.ai_incidents enable row level security;
