alter table public.external_approval_requests
  add column if not exists source_service text,
  add column if not exists callback_target text,
  add column if not exists route_plan_id text,
  add column if not exists event_id text,
  add column if not exists policy_evidence_id text;

create index if not exists external_approval_requests_source_status_idx
  on public.external_approval_requests(source, status, created_at desc);

create table if not exists public.ecosystem_health_snapshot (
  id bigserial primary key,
  service_type varchar(50) not null,
  service_name varchar(100) not null,
  base_url varchar(500) not null,
  status varchar(30) not null,
  http_status integer,
  summary jsonb,
  error_message text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ecosystem_health_snapshot_service_idx
  on public.ecosystem_health_snapshot(service_type, checked_at desc);

create table if not exists public.approval_callback_outbox (
  id bigserial primary key,
  callback_id varchar(100) unique not null,
  approval_request_id varchar(100) not null,
  source_service varchar(100) not null,
  target_service varchar(100) not null,
  target_url varchar(500) not null,
  payload jsonb not null,
  status varchar(30) not null,
  retry_count integer not null default 0,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists approval_callback_outbox_status_idx
  on public.approval_callback_outbox(status, next_retry_at, created_at);

create index if not exists approval_callback_outbox_approval_idx
  on public.approval_callback_outbox(approval_request_id, created_at desc);

create table if not exists public.ecosystem_event_timeline (
  id bigserial primary key,
  trace_id varchar(100),
  correlation_id varchar(100),
  source_service varchar(100) not null,
  event_type varchar(100) not null,
  aggregate_type varchar(100),
  aggregate_id varchar(100),
  title varchar(200) not null,
  detail jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ecosystem_event_timeline_recent_idx
  on public.ecosystem_event_timeline(occurred_at desc);

create table if not exists public.policy_evidence_snapshot (
  id bigserial primary key,
  evidence_id varchar(100) unique not null,
  approval_request_id varchar(100),
  source_service varchar(100),
  question text not null,
  evidence_text text not null,
  evidence_source varchar(100) not null,
  rag_status varchar(30) not null,
  related_policy varchar(200),
  created_at timestamptz not null default now()
);

create index if not exists policy_evidence_snapshot_approval_idx
  on public.policy_evidence_snapshot(approval_request_id, created_at desc);

alter table public.ecosystem_health_snapshot enable row level security;
alter table public.approval_callback_outbox enable row level security;
alter table public.ecosystem_event_timeline enable row level security;
alter table public.policy_evidence_snapshot enable row level security;
