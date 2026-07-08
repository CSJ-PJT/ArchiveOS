create table if not exists public.managed_systems (
  system_id text primary key,
  name text not null,
  environment text not null,
  provider text not null,
  public_base_url text not null,
  role text not null,
  current_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.managed_services (
  service_id text primary key,
  system_id text not null references public.managed_systems(system_id) on delete cascade,
  name text not null,
  url_path text not null,
  healthcheck_url text not null,
  service_type text not null,
  criticality text not null,
  current_status text not null,
  repository text not null,
  note text,
  expected_status integer not null default 200,
  timeout_ms integer not null default 4000,
  retry_count integer not null default 2,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.managed_environment_requirements (
  id uuid primary key default gen_random_uuid(),
  system_id text not null references public.managed_systems(system_id) on delete cascade,
  service_id text references public.managed_services(service_id) on delete cascade,
  env_name text not null,
  required boolean not null default true,
  secret boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  unique(system_id, service_id, env_name)
);

create table if not exists public.atlas_healthcheck_results (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.managed_services(service_id) on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null,
  http_status integer,
  latency_ms integer,
  expected_status integer not null,
  error_message text,
  response_excerpt text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists atlas_healthcheck_results_service_idx on public.atlas_healthcheck_results(service_id, checked_at desc);
create index if not exists atlas_healthcheck_results_checked_idx on public.atlas_healthcheck_results(checked_at desc);

create table if not exists public.codex_work_logs (
  id uuid primary key default gen_random_uuid(),
  work_title text not null,
  target_system_id text not null references public.managed_systems(system_id) on delete cascade,
  target_service_id text references public.managed_services(service_id) on delete set null,
  repository text,
  started_at timestamptz,
  finished_at timestamptz,
  actor text,
  agent text,
  model text,
  reasoning_level text,
  task_summary text,
  changed_files jsonb not null default '[]'::jsonb,
  test_results jsonb not null default '[]'::jsonb,
  failure_reason text,
  next_actions jsonb not null default '[]'::jsonb,
  committed boolean not null default false,
  pushed boolean not null default false,
  deployed boolean not null default false,
  rollback_plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists codex_work_logs_target_idx on public.codex_work_logs(target_system_id, target_service_id, created_at desc);

insert into public.managed_systems(system_id, name, environment, provider, public_base_url, role, current_status, reason)
values ('atlas-platform', 'Atlas Platform', 'production', 'OCI', 'http://161.33.17.84', 'service-portal-and-lightweight-runtime', 'degraded', 'Health Atlas is still unstable')
on conflict (system_id) do update set
  name = excluded.name,
  environment = excluded.environment,
  provider = excluded.provider,
  public_base_url = excluded.public_base_url,
  role = excluded.role,
  current_status = excluded.current_status,
  reason = excluded.reason,
  updated_at = now();

insert into public.managed_services(service_id, system_id, name, url_path, healthcheck_url, service_type, criticality, current_status, repository, note, timeout_ms)
values
  ('atlas-management', 'atlas-platform', 'Atlas Management', '/', 'http://161.33.17.84/', 'PORTAL', 'Critical', 'normal', 'CSJ-PJT/Atlas-Management', null, 3000),
  ('travel-atlas', 'atlas-platform', 'Travel Atlas', '/travel/', 'http://161.33.17.84/travel/', 'STATIC_FRONTEND', 'High', 'normal', 'CSJ-PJT/Route-Atlas', null, 3000),
  ('learn-atlas', 'atlas-platform', 'Learn Atlas', '/learn/', 'http://161.33.17.84/learn/', 'STATIC_FRONTEND', 'Medium', 'normal', 'CSJ-PJT/Backend-Atlas', null, 3000),
  ('health-atlas', 'atlas-platform', 'Health Atlas', '/health/', 'http://161.33.17.84/health/', 'STATIC_FRONTEND', 'Medium', 'degraded', 'CSJ-PJT/Health-Atlas', 'Health web build/deploy is unstable. OCI server build is not recommended.', 5000),
  ('atlas-api', 'atlas-platform', 'Atlas API', '/api/health', 'http://161.33.17.84/api/health', 'NODE_API', 'Critical', 'normal', 'CSJ-PJT/Route-Atlas', null, 3000)
on conflict (service_id) do update set
  system_id = excluded.system_id,
  name = excluded.name,
  url_path = excluded.url_path,
  healthcheck_url = excluded.healthcheck_url,
  service_type = excluded.service_type,
  criticality = excluded.criticality,
  current_status = excluded.current_status,
  repository = excluded.repository,
  note = excluded.note,
  timeout_ms = excluded.timeout_ms,
  updated_at = now();

insert into public.managed_environment_requirements(system_id, service_id, env_name, required, secret, description)
values
  ('atlas-platform', 'travel-atlas', 'GOOGLE_MAPS_API_KEY', true, true, 'Travel Atlas Google Maps integration key name only.'),
  ('atlas-platform', 'travel-atlas', 'SERPAPI_KEY', true, true, 'Travel Atlas SerpAPI integration key name only.'),
  ('atlas-platform', 'health-atlas', 'VITE_SUPABASE_PROJECT_ID', true, false, 'Health Atlas Supabase project id variable name only.'),
  ('atlas-platform', 'health-atlas', 'VITE_SUPABASE_URL', true, false, 'Health Atlas Supabase URL variable name only.'),
  ('atlas-platform', 'health-atlas', 'VITE_SUPABASE_PUBLISHABLE_KEY', true, false, 'Health Atlas Supabase publishable key variable name only.')
on conflict (system_id, service_id, env_name) do nothing;

alter table public.managed_systems enable row level security;
alter table public.managed_services enable row level security;
alter table public.managed_environment_requirements enable row level security;
alter table public.atlas_healthcheck_results enable row level security;
alter table public.codex_work_logs enable row level security;
