create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  task_id text,
  agent_id text,
  log_type text not null check (log_type in ('summary', 'decision', 'error', 'review')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists work_logs_created_at_idx on public.work_logs(created_at desc);
create index if not exists work_logs_log_type_idx on public.work_logs(log_type, created_at desc);

create table if not exists public.command_runs (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  command_type text,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists command_runs_created_at_idx on public.command_runs(created_at desc);
create index if not exists command_runs_status_idx on public.command_runs(status, created_at desc);

alter table public.work_logs enable row level security;
alter table public.command_runs enable row level security;
