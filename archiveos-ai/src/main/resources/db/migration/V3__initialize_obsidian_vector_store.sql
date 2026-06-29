create extension if not exists vector;

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
  on public.obsidian_chunks using hnsw (embedding vector_cosine_ops);

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

alter table public.obsidian_documents enable row level security;
alter table public.obsidian_chunks enable row level security;
