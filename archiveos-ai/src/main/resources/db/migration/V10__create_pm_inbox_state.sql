create table if not exists public.pm_inbox_item_states (
  id text primary key,
  status text not null check (status in ('open', 'acknowledged', 'resolved')),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pm_inbox_item_states_status_idx on public.pm_inbox_item_states(status, updated_at desc);

alter table public.pm_inbox_item_states enable row level security;
