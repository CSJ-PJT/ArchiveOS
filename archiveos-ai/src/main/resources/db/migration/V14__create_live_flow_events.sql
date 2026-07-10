create table if not exists public.ecosystem_flow_event (
  id bigserial primary key,
  event_id varchar(120) unique not null,
  correlation_id varchar(120),
  source_system_id varchar(80) not null,
  source_service_id varchar(120),
  domain varchar(40) not null,
  event_type varchar(120) not null,
  entity_type varchar(60) not null,
  entity_id varchar(160) not null,
  from_node varchar(80) not null,
  to_node varchar(80) not null,
  status varchar(40) not null,
  severity varchar(40) not null,
  display_label varchar(240) not null,
  amount_bucket varchar(40),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ecosystem_flow_event_received_idx
  on public.ecosystem_flow_event(received_at desc);

create index if not exists ecosystem_flow_event_occurred_idx
  on public.ecosystem_flow_event(occurred_at desc);

create index if not exists ecosystem_flow_event_correlation_idx
  on public.ecosystem_flow_event(correlation_id, occurred_at desc);

create index if not exists ecosystem_flow_event_entity_idx
  on public.ecosystem_flow_event(entity_id, occurred_at desc);

create index if not exists ecosystem_flow_event_status_idx
  on public.ecosystem_flow_event(status, severity, received_at desc);

alter table public.ecosystem_flow_event enable row level security;
