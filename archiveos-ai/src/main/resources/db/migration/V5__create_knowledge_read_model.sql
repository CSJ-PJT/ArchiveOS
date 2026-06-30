create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type text not null,
  title text not null,
  summary text,
  source text,
  external_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  to_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  edge_type text not null,
  confidence double precision not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint knowledge_edges_unique_relation unique (from_node_id, to_node_id, edge_type)
);

create index if not exists knowledge_nodes_node_type_idx on public.knowledge_nodes(node_type);
create index if not exists knowledge_nodes_external_ref_idx on public.knowledge_nodes(external_ref);
create index if not exists knowledge_nodes_created_at_idx on public.knowledge_nodes(created_at desc);
create index if not exists knowledge_edges_created_at_idx on public.knowledge_edges(created_at desc);
create index if not exists knowledge_edges_from_node_id_idx on public.knowledge_edges(from_node_id);
create index if not exists knowledge_edges_to_node_id_idx on public.knowledge_edges(to_node_id);
