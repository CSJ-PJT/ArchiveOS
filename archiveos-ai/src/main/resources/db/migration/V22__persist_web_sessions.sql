create table if not exists public.archiveos_web_sessions (
    session_id uuid primary key,
    actor text not null,
    role text not null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create index if not exists archiveos_web_sessions_expires_at_idx
    on public.archiveos_web_sessions (expires_at);
