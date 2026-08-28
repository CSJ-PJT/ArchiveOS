create table if not exists public.admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor text not null,
  role text not null,
  event_type text not null,
  feature text,
  route text,
  action text not null,
  client_ip inet not null,
  user_agent text,
  source text not null,
  source_event_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint admin_access_logs_source_event_unique unique (source, source_event_id)
);

create index if not exists admin_access_logs_occurred_at_idx
  on public.admin_access_logs(occurred_at desc);
create index if not exists admin_access_logs_actor_idx
  on public.admin_access_logs(actor, occurred_at desc);
create index if not exists admin_access_logs_client_ip_idx
  on public.admin_access_logs(client_ip, occurred_at desc);

alter table public.admin_access_logs enable row level security;
