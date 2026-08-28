alter table public.obsidian_documents
  add column if not exists knowledge_scope varchar(16) not null default 'INTERNAL';

alter table public.obsidian_documents
  drop constraint if exists obsidian_documents_knowledge_scope_check;

alter table public.obsidian_documents
  add constraint obsidian_documents_knowledge_scope_check
  check (knowledge_scope in ('PUBLIC', 'INTERNAL'));

-- Existing documents are intentionally fail-closed. A later vault sync may
-- promote only documents under an explicitly approved public path.
update public.obsidian_documents
set knowledge_scope = 'INTERNAL'
where knowledge_scope is null or knowledge_scope not in ('PUBLIC', 'INTERNAL');

create index if not exists obsidian_documents_knowledge_scope_idx
  on public.obsidian_documents(knowledge_scope, updated_at desc);

create or replace function public.match_public_obsidian_chunks(
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
  score double precision,
  updated_at timestamptz,
  knowledge_scope varchar(16)
)
language sql
stable
security invoker
as $$
  select
    c.id,
    d.id,
    d.title,
    d.file_path,
    c.heading,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding),
    d.updated_at,
    d.knowledge_scope
  from public.obsidian_chunks c
  join public.obsidian_documents d on d.id = c.document_id
  where c.embedding is not null
    and d.knowledge_scope = 'PUBLIC'
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20)
$$;

create or replace function public.match_internal_obsidian_chunks(
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
  score double precision,
  updated_at timestamptz,
  knowledge_scope varchar(16)
)
language sql
stable
security invoker
as $$
  select
    c.id,
    d.id,
    d.title,
    d.file_path,
    c.heading,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding),
    d.updated_at,
    d.knowledge_scope
  from public.obsidian_chunks c
  join public.obsidian_documents d on d.id = c.document_id
  where c.embedding is not null
    and d.knowledge_scope = 'INTERNAL'
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20)
$$;

comment on column public.obsidian_documents.knowledge_scope is
  'Fail-closed RAG collection boundary. PUBLIC is queryable by public RAG; INTERNAL never is.';
