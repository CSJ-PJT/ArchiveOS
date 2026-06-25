create extension if not exists pgcrypto;
create extension if not exists vector;

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
  batch_type text not null check (batch_type in ('nightly_review', 'daily_report', 'supabase_keepalive')),
  status text not null check (status in ('completed', 'sent', 'skipped', 'failed')),
  target_date date not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.batch_runs drop constraint if exists batch_runs_batch_type_check;
alter table public.batch_runs
  add constraint batch_runs_batch_type_check
  check (batch_type in ('nightly_review', 'daily_report', 'supabase_keepalive'));

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  target_date date not null,
  status text not null check (status in ('normal', 'warning', 'problem')),
  status_reason text not null,
  runtime_summary jsonb not null default '{}'::jsonb,
  latest_builder jsonb,
  latest_reviewer jsonb,
  operator_summary jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  decisions_count integer not null default 0,
  commands_count integer not null default 0,
  discord_sent boolean not null default false,
  discord_skipped_reason text,
  historian_exported boolean not null default false,
  historian_note_path text,
  historian_export_reason text,
  report_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  inbox_count integer not null default 0,
  processing_count integer not null default 0,
  outbox_count integer not null default 0,
  reviews_count integer not null default 0,
  active_task text,
  latest_builder jsonb,
  latest_reviewer jsonb,
  operators jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  source text not null default 'backend'
);

create table if not exists public.historian_exports (
  id uuid primary key default gen_random_uuid(),
  note_type text not null,
  status text not null check (status in ('success', 'skipped', 'failed')),
  note_path text,
  reason text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.architecture_reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_ref text not null,
  status text not null check (status in ('pending', 'reviewed', 'warning', 'blocked')),
  summary text,
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  related_nodes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type text not null check (
    node_type in (
      'task',
      'builder_result',
      'reviewer_result',
      'decision',
      'incident',
      'daily_report',
      'nightly_review',
      'batch_run',
      'command',
      'obsidian_note',
      'architecture_note',
      'architecture_review'
    )
  ),
  title text not null,
  summary text,
  source text,
  external_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_nodes_type_external_ref_key unique (node_type, external_ref)
);

create table if not exists public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  to_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  edge_type text not null check (
    edge_type in (
      'relates_to',
      'produced',
      'reviewed_by',
      'decided_by',
      'exported_to',
      'caused_by',
      'resolved_by',
      'mentioned_in',
      'follows',
      'blocks',
      'reviewed_architecture_of',
      'recommends',
      'conflicts_with',
      'references_memory'
    )
  ),
  confidence numeric not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint knowledge_edges_unique_link unique (from_node_id, to_node_id, edge_type)
);

create table if not exists public.pm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'queued' check (
    status in (
      'queued',
      'architect_review',
      'ready_for_build',
      'building',
      'review',
      'pm_decision_required',
      'approved',
      'rejected',
      'hold',
      'failed',
      'done'
    )
  ),
  target_project text not null default 'DeepStake3D',
  scope_files text[],
  max_iterations integer not null default 2 check (max_iterations >= 1 and max_iterations <= 10),
  current_iteration integer not null default 0 check (current_iteration >= 0),
  cost_budget numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  latest_architect_review_id uuid references public.architecture_reviews(id) on delete set null,
  latest_builder_result_id uuid references public.command_runs(id) on delete set null,
  latest_reviewer_result_id uuid references public.command_runs(id) on delete set null,
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

alter table public.pm_tasks
drop constraint if exists pm_tasks_latest_pm_decision_id_fkey;

alter table public.pm_tasks
add constraint pm_tasks_latest_pm_decision_id_fkey
foreign key (latest_pm_decision_id) references public.pm_task_decisions(id) on delete set null;

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

create table if not exists public.obsidian_documents (
  id bigserial primary key,
  file_path text not null unique,
  title text,
  content_hash varchar(128) not null,
  last_modified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obsidian_chunks (
  id bigserial primary key,
  document_id bigint not null references public.obsidian_documents(id) on delete cascade,
  chunk_index integer not null,
  heading text,
  chunk_text text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint obsidian_chunks_document_chunk_key unique (document_id, chunk_index)
);

create index if not exists obsidian_documents_file_path_idx
on public.obsidian_documents(file_path);

create index if not exists obsidian_chunks_document_id_idx
on public.obsidian_chunks(document_id);

create index if not exists obsidian_chunks_embedding_hnsw_idx
on public.obsidian_chunks
using hnsw (embedding vector_cosine_ops);

create or replace function public.match_obsidian_chunks(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  chunk_id bigint,
  document_id bigint,
  title text,
  file_path text,
  heading text,
  chunk_text text,
  score double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.title,
    d.file_path,
    c.heading,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as score
  from public.obsidian_chunks c
  join public.obsidian_documents d on d.id = c.document_id
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20)
$$;

alter table public.daily_reports add column if not exists historian_exported boolean not null default false;
alter table public.daily_reports add column if not exists historian_note_path text;
alter table public.daily_reports add column if not exists historian_export_reason text;

alter table public.knowledge_nodes drop constraint if exists knowledge_nodes_node_type_check;
alter table public.knowledge_nodes add constraint knowledge_nodes_node_type_check
check (
  node_type in (
    'task',
    'builder_result',
    'reviewer_result',
    'decision',
    'incident',
    'daily_report',
    'nightly_review',
    'batch_run',
    'command',
    'obsidian_note',
    'architecture_note',
    'architecture_review'
  )
);

alter table public.knowledge_edges drop constraint if exists knowledge_edges_edge_type_check;
alter table public.knowledge_edges add constraint knowledge_edges_edge_type_check
check (
  edge_type in (
    'relates_to',
    'produced',
    'reviewed_by',
    'decided_by',
    'exported_to',
    'caused_by',
    'resolved_by',
    'mentioned_in',
    'follows',
    'blocks',
    'reviewed_architecture_of',
    'recommends',
    'conflicts_with',
    'references_memory'
  )
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
create index if not exists daily_reports_target_date_idx on public.daily_reports(target_date desc);
create index if not exists daily_reports_created_at_idx on public.daily_reports(created_at desc);
create index if not exists runtime_snapshots_captured_at_idx on public.runtime_snapshots(captured_at desc);
create index if not exists historian_exports_created_at_idx on public.historian_exports(created_at desc);
create index if not exists historian_exports_note_type_idx on public.historian_exports(note_type, created_at desc);
create index if not exists architecture_reviews_created_at_idx on public.architecture_reviews(created_at desc);
create index if not exists architecture_reviews_target_ref_idx on public.architecture_reviews(target_ref);
create index if not exists architecture_reviews_status_idx on public.architecture_reviews(status);
create index if not exists knowledge_nodes_node_type_idx on public.knowledge_nodes(node_type);
create index if not exists knowledge_nodes_external_ref_idx on public.knowledge_nodes(external_ref);
create index if not exists knowledge_nodes_created_at_idx on public.knowledge_nodes(created_at desc);
create index if not exists knowledge_edges_edge_type_idx on public.knowledge_edges(edge_type);
create index if not exists knowledge_edges_created_at_idx on public.knowledge_edges(created_at desc);
create index if not exists knowledge_edges_from_node_id_idx on public.knowledge_edges(from_node_id);
create index if not exists knowledge_edges_to_node_id_idx on public.knowledge_edges(to_node_id);
create index if not exists pm_tasks_status_priority_created_at_idx on public.pm_tasks(status, priority, created_at);
create index if not exists pm_tasks_target_project_idx on public.pm_tasks(target_project);
create index if not exists pm_tasks_updated_at_idx on public.pm_tasks(updated_at desc);
create index if not exists pm_task_decisions_task_id_idx on public.pm_task_decisions(task_id);
create index if not exists pm_task_decisions_created_at_idx on public.pm_task_decisions(created_at desc);
create index if not exists pm_task_events_task_id_idx on public.pm_task_events(task_id);
create index if not exists pm_task_events_event_type_created_at_idx on public.pm_task_events(event_type, created_at desc);
create index if not exists obsidian_documents_updated_at_idx on public.obsidian_documents(updated_at desc);
create index if not exists obsidian_documents_file_path_idx on public.obsidian_documents(file_path);
create index if not exists obsidian_chunks_document_id_idx on public.obsidian_chunks(document_id);
create index if not exists obsidian_chunks_metadata_gin_idx on public.obsidian_chunks using gin(metadata);

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

drop trigger if exists set_knowledge_nodes_updated_at on public.knowledge_nodes;
create trigger set_knowledge_nodes_updated_at
before update on public.knowledge_nodes
for each row
execute function public.set_updated_at();

drop trigger if exists set_pm_tasks_updated_at on public.pm_tasks;
create trigger set_pm_tasks_updated_at
before update on public.pm_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_obsidian_documents_updated_at on public.obsidian_documents;
create trigger set_obsidian_documents_updated_at
before update on public.obsidian_documents
for each row
execute function public.set_updated_at();

alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.work_logs enable row level security;
alter table public.command_runs enable row level security;
alter table public.batch_runs enable row level security;
alter table public.daily_reports enable row level security;
alter table public.runtime_snapshots enable row level security;
alter table public.historian_exports enable row level security;
alter table public.architecture_reviews enable row level security;
alter table public.knowledge_nodes enable row level security;
alter table public.knowledge_edges enable row level security;
alter table public.pm_tasks enable row level security;
alter table public.pm_task_decisions enable row level security;
alter table public.pm_task_events enable row level security;
alter table public.obsidian_documents enable row level security;
alter table public.obsidian_chunks enable row level security;

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

drop policy if exists "Allow public read daily reports" on public.daily_reports;
create policy "Allow public read daily reports"
on public.daily_reports
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read runtime snapshots" on public.runtime_snapshots;
create policy "Allow public read runtime snapshots"
on public.runtime_snapshots
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read historian exports" on public.historian_exports;
create policy "Allow public read historian exports"
on public.historian_exports
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read architecture reviews" on public.architecture_reviews;
create policy "Allow public read architecture reviews"
on public.architecture_reviews
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read knowledge nodes" on public.knowledge_nodes;
create policy "Allow public read knowledge nodes"
on public.knowledge_nodes
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read knowledge edges" on public.knowledge_edges;
create policy "Allow public read knowledge edges"
on public.knowledge_edges
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read PM tasks" on public.pm_tasks;
create policy "Allow public read PM tasks"
on public.pm_tasks
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read PM task decisions" on public.pm_task_decisions;
create policy "Allow public read PM task decisions"
on public.pm_task_decisions
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read PM task events" on public.pm_task_events;
create policy "Allow public read PM task events"
on public.pm_task_events
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read Obsidian documents" on public.obsidian_documents;
create policy "Allow public read Obsidian documents"
on public.obsidian_documents
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public read Obsidian chunks" on public.obsidian_chunks;
create policy "Allow public read Obsidian chunks"
on public.obsidian_chunks
for select
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on public.agents to anon, authenticated;
grant select on public.tasks to anon, authenticated;
grant select on public.work_logs to anon, authenticated;
grant select on public.command_runs to anon, authenticated;
grant select on public.batch_runs to anon, authenticated;
grant select on public.daily_reports to anon, authenticated;
grant select on public.runtime_snapshots to anon, authenticated;
grant select on public.historian_exports to anon, authenticated;
grant select on public.architecture_reviews to anon, authenticated;
grant select on public.knowledge_nodes to anon, authenticated;
grant select on public.knowledge_edges to anon, authenticated;
grant select on public.pm_tasks to anon, authenticated;
grant select on public.pm_task_decisions to anon, authenticated;
grant select on public.pm_task_events to anon, authenticated;
grant select on public.obsidian_documents to anon, authenticated;
grant select on public.obsidian_chunks to anon, authenticated;
