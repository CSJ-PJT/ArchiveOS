create table if not exists public.game_service_finance_snapshot (
  id bigserial primary key,
  simulation_run_id text not null,
  settlement_cycle_id text not null,
  tick_id text not null,
  day integer not null,
  correlation_id text,
  system_id text not null,
  service_name text not null,
  cash_balance numeric(18,2) not null default 0,
  revenue_amount numeric(18,2) not null default 0,
  cost_amount numeric(18,2) not null default 0,
  profit_amount numeric(18,2) not null default 0,
  burn_rate numeric(18,2) not null default 0,
  bankruptcy_risk text not null,
  created_at timestamptz not null default now(),
  unique(simulation_run_id, tick_id, system_id)
);

create index if not exists game_service_finance_snapshot_system_idx
  on public.game_service_finance_snapshot(system_id, created_at desc);

create index if not exists game_service_finance_snapshot_run_idx
  on public.game_service_finance_snapshot(simulation_run_id, day, system_id);

create table if not exists public.game_service_trade_ledger (
  id bigserial primary key,
  trade_id text unique not null,
  simulation_run_id text not null,
  settlement_cycle_id text not null,
  tick_id text not null,
  day integer not null,
  correlation_id text,
  source_system_id text not null,
  target_system_id text not null,
  trade_type text not null,
  amount numeric(18,2) not null,
  currency text not null default 'KRW',
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_service_trade_ledger_source_idx
  on public.game_service_trade_ledger(source_system_id, created_at desc);

create index if not exists game_service_trade_ledger_target_idx
  on public.game_service_trade_ledger(target_system_id, created_at desc);

create index if not exists game_service_trade_ledger_run_idx
  on public.game_service_trade_ledger(simulation_run_id, day, trade_type);

alter table public.game_service_finance_snapshot enable row level security;
alter table public.game_service_trade_ledger enable row level security;
