create table if not exists public.ai_decision_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_id text not null unique,
  request_id text not null unique,
  context_fingerprint text not null unique,
  trigger_type text not null,
  service text,
  entity_id text,
  correlation_id text,
  question text not null,
  requested_by text not null,
  status text not null check (status in ('DRAFT','REVIEW_REQUIRED','APPROVED','REJECTED','EXPIRED','INSUFFICIENT_EVIDENCE','BLOCKED')),
  summary text not null,
  observed_facts jsonb not null default '[]'::jsonb,
  hypotheses jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  confidence numeric,
  references_json jsonb not null default '[]'::jsonb,
  runtime_evidence jsonb not null default '[]'::jsonb,
  policy_checks jsonb not null default '[]'::jsonb,
  runtime_context jsonb not null default '{}'::jsonb,
  model text,
  prompt_version text not null,
  latency_ms bigint,
  token_usage jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_reason text
);
create index if not exists ai_decision_recommendations_created_idx on public.ai_decision_recommendations(created_at desc);
create index if not exists ai_decision_recommendations_status_idx on public.ai_decision_recommendations(status, created_at desc);
create index if not exists ai_decision_recommendations_service_idx on public.ai_decision_recommendations(service, created_at desc);
alter table public.ai_decision_recommendations enable row level security;
