create table if not exists public.external_approval_requests (
  id uuid primary key default gen_random_uuid(),
  approval_request_id text not null unique,
  source text not null,
  target_system_id text not null default 'archive-ledger',
  correlation_id text not null unique,
  transaction_id text not null unique,
  amount numeric not null,
  currency text not null,
  reason text not null,
  policy_question text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null,
  callback_path text,
  callback_status text,
  callback_attempt_count integer not null default 0,
  callback_last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

create index if not exists external_approval_requests_status_idx
  on public.external_approval_requests(status, created_at desc);

create index if not exists external_approval_requests_target_idx
  on public.external_approval_requests(target_system_id, created_at desc);

create table if not exists public.external_approval_evidence (
  id uuid primary key default gen_random_uuid(),
  approval_request_id text not null references public.external_approval_requests(approval_request_id) on delete cascade,
  evidence_type text not null check (evidence_type in ('RAG', 'RULE_FALLBACK', 'POLICY', 'SYSTEM')),
  title text not null,
  content text not null,
  source_path text,
  confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists external_approval_evidence_request_idx
  on public.external_approval_evidence(approval_request_id, created_at desc);

create table if not exists public.external_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id text not null references public.external_approval_requests(approval_request_id) on delete cascade,
  decision text not null check (decision in ('APPROVED', 'REJECTED', 'HOLD')),
  decided_by text not null,
  comment text,
  decided_at timestamptz not null default now()
);

create index if not exists external_approval_decisions_request_idx
  on public.external_approval_decisions(approval_request_id, decided_at desc);

create table if not exists public.external_approval_callbacks (
  id uuid primary key default gen_random_uuid(),
  approval_request_id text not null references public.external_approval_requests(approval_request_id) on delete cascade,
  target_system_id text not null,
  callback_url_masked text,
  status text not null,
  attempt_count integer not null default 0,
  last_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists external_approval_callbacks_request_idx
  on public.external_approval_callbacks(approval_request_id, requested_at desc);

alter table public.external_approval_requests enable row level security;
alter table public.external_approval_evidence enable row level security;
alter table public.external_approval_decisions enable row level security;
alter table public.external_approval_callbacks enable row level security;
