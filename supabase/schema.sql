create extension if not exists pgcrypto;

do $$
begin
  create type agent_status as enum ('idle', 'working', 'reviewing', 'failed', 'waiting');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type task_priority as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type task_status as enum ('todo', 'in_progress', 'review', 'done', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type log_type as enum ('summary', 'decision', 'error', 'review');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  status agent_status not null default 'idle',
  current_task text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  priority task_priority not null default 'medium',
  status task_status not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  log_type log_type not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.command_runs (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  command_type text,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.batch_runs (
  id uuid primary key default gen_random_uuid(),
  batch_type text not null check (batch_type in ('nightly_review', 'daily_report')),
  status text not null check (status in ('completed', 'sent', 'skipped', 'failed')),
  target_date date not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_assigned_agent_id_idx on public.tasks(assigned_agent_id);
create index if not exists work_logs_task_id_idx on public.work_logs(task_id);
create index if not exists work_logs_agent_id_idx on public.work_logs(agent_id);
create index if not exists work_logs_log_type_created_at_idx on public.work_logs(log_type, created_at desc);
create index if not exists command_runs_created_at_idx on public.command_runs(created_at desc);
create index if not exists command_runs_status_idx on public.command_runs(status);
create index if not exists batch_runs_type_created_at_idx on public.batch_runs(batch_type, created_at desc);
create index if not exists batch_runs_target_date_idx on public.batch_runs(target_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at
before update on public.agents
for each row
execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_command_runs_updated_at on public.command_runs;
create trigger set_command_runs_updated_at
before update on public.command_runs
for each row
execute function public.set_updated_at();

alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.work_logs enable row level security;
alter table public.command_runs enable row level security;
alter table public.batch_runs enable row level security;

drop policy if exists "Allow public read agents" on public.agents;
create policy "Allow public read agents"
on public.agents
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read tasks" on public.tasks;
create policy "Allow public read tasks"
on public.tasks
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read work logs" on public.work_logs;
create policy "Allow public read work logs"
on public.work_logs
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read command runs" on public.command_runs;
create policy "Allow public read command runs"
on public.command_runs
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read batch runs" on public.batch_runs;
create policy "Allow public read batch runs"
on public.batch_runs
for select
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on public.agents to anon, authenticated;
grant select on public.tasks to anon, authenticated;
grant select on public.work_logs to anon, authenticated;
grant select on public.command_runs to anon, authenticated;
grant select on public.batch_runs to anon, authenticated;
