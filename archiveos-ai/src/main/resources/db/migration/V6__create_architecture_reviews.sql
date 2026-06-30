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

create index if not exists architecture_reviews_created_at_idx
  on public.architecture_reviews(created_at desc);
create index if not exists architecture_reviews_target_ref_idx
  on public.architecture_reviews(target_ref);
