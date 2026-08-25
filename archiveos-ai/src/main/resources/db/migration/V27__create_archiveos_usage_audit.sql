create table if not exists public.archiveos_usage_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor text not null,
  role text not null,
  feature text not null,
  console_route text not null,
  action text not null,
  client_ip inet not null,
  user_agent text,
  authenticated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists archiveos_usage_logs_occurred_at_idx
  on public.archiveos_usage_logs(occurred_at desc);
create index if not exists archiveos_usage_logs_actor_idx
  on public.archiveos_usage_logs(actor, occurred_at desc);
create index if not exists archiveos_usage_logs_client_ip_idx
  on public.archiveos_usage_logs(client_ip, occurred_at desc);
create index if not exists archiveos_usage_logs_feature_idx
  on public.archiveos_usage_logs(feature, occurred_at desc);
create index if not exists audit_logs_client_ip_occurred_at_idx
  on public.audit_logs((metadata->>'clientIp'), occurred_at desc)
  where metadata->>'clientIp' is not null;

alter table public.archiveos_usage_logs enable row level security;
