create extension if not exists pgcrypto;

create table if not exists public.pm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'queued' check (status in ('queued', 'architect_review', 'ready_for_build', 'building', 'review', 'pm_decision_required', 'approved', 'rejected', 'hold', 'failed', 'done')),
  target_project text not null default 'DeepStake3D',
  scope_files text[],
  max_iterations integer not null default 2 check (max_iterations between 1 and 10),
  current_iteration integer not null default 0 check (current_iteration >= 0),
  cost_budget numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  latest_architect_review_id uuid,
  latest_builder_result_id uuid,
  latest_reviewer_result_id uuid,
  latest_pm_decision_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.pm_task_decisions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.pm_tasks(id) on delete cascade,
  action text not null check (action in ('approve', 'reject', 'hold', 'retry')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.pm_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.pm_tasks(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  source text not null check (source in ('queue', 'architect', 'builder', 'reviewer', 'pm', 'discord')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pm_tasks_status_priority_created_at_idx on public.pm_tasks(status, priority, created_at);
create index if not exists pm_tasks_target_project_idx on public.pm_tasks(target_project);
create index if not exists pm_tasks_updated_at_idx on public.pm_tasks(updated_at desc);
create index if not exists pm_task_decisions_task_id_idx on public.pm_task_decisions(task_id);
create index if not exists pm_task_decisions_created_at_idx on public.pm_task_decisions(created_at desc);
create index if not exists pm_task_events_task_id_idx on public.pm_task_events(task_id);
create index if not exists pm_task_events_event_type_created_at_idx on public.pm_task_events(event_type, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pm_tasks_latest_pm_decision_id_fkey'
  ) then
    alter table public.pm_tasks
      add constraint pm_tasks_latest_pm_decision_id_fkey
      foreign key (latest_pm_decision_id) references public.pm_task_decisions(id) on delete set null;
  end if;
end $$;
