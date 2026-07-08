create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  role text not null,
  occurred_at timestamptz not null default now(),
  action text not null,
  resource_type text not null,
  resource_id text,
  correlation_id text,
  request_method text not null,
  request_path text not null,
  response_status integer not null,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_occurred_at_idx on public.audit_logs(occurred_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor, occurred_at desc);
create index if not exists audit_logs_resource_idx on public.audit_logs(resource_type, resource_id, occurred_at desc);
create index if not exists audit_logs_correlation_idx on public.audit_logs(correlation_id);

create table if not exists public.workflow_contracts (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  project_id text not null,
  workflow jsonb not null,
  execution jsonb,
  approval jsonb,
  evidence jsonb not null default '[]'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(correlation_id, project_id)
);

create index if not exists workflow_contracts_project_idx on public.workflow_contracts(project_id, updated_at desc);

create table if not exists public.mcp_registry (
  id uuid primary key default gen_random_uuid(),
  tool text not null unique,
  provider text not null,
  capability text not null,
  permission text not null,
  approval_required boolean not null default true,
  health text not null default 'unknown',
  last_run timestamptz,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.mcp_registry(tool, provider, capability, permission, approval_required, health, enabled)
values
  ('filesystem', 'ArchiveOS', 'Read approved project files', 'read', false, 'ready', true),
  ('postgres', 'ArchiveOS', 'Query runtime persistence', 'read', false, 'ready', true),
  ('slack', 'Slack', 'Send operational notifications', 'write', true, 'configured', true),
  ('codex', 'OpenAI', 'Generate and review implementation changes', 'write', true, 'degraded', false)
on conflict (tool) do nothing;

create table if not exists public.runtime_timeline (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('task','workflow','approval','knowledge','slack_notification','agent','batch')),
  status text not null,
  title text not null,
  summary text,
  correlation_id text,
  project_id text,
  source text not null,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists runtime_timeline_occurred_at_idx on public.runtime_timeline(occurred_at desc);
create index if not exists runtime_timeline_correlation_idx on public.runtime_timeline(correlation_id, occurred_at desc);

alter table public.audit_logs enable row level security;
alter table public.workflow_contracts enable row level security;
alter table public.mcp_registry enable row level security;
alter table public.runtime_timeline enable row level security;
