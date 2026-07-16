package com.archiveos.ai.obsidian;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ObsidianJdbcRepository {
    private final JdbcTemplate jdbcTemplate;

    public ObsidianJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void ensureSchema() {
        jdbcTemplate.execute("create extension if not exists vector");
        jdbcTemplate.execute("""
                create table if not exists public.obsidian_documents (
                  id bigserial primary key,
                  file_path text not null unique,
                  title text,
                  content_hash varchar(128) not null,
                  last_modified_at timestamptz,
                  created_at timestamptz not null default now(),
                  updated_at timestamptz not null default now()
                )
                """);
        jdbcTemplate.execute("""
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
                )
                """);
        jdbcTemplate.execute("create index if not exists obsidian_documents_file_path_idx on public.obsidian_documents(file_path)");
        jdbcTemplate.execute("create index if not exists obsidian_chunks_document_id_idx on public.obsidian_chunks(document_id)");
        jdbcTemplate.execute("create index if not exists obsidian_chunks_embedding_hnsw_idx on public.obsidian_chunks using hnsw (embedding vector_cosine_ops)");
        jdbcTemplate.execute("""
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
                """);
    }

    public ExistingDocument findByPath(String filePath) {
        List<ExistingDocument> rows = jdbcTemplate.query(
                "select id, content_hash from public.obsidian_documents where file_path = ?",
                (rs, rowNum) -> new ExistingDocument(rs.getLong("id"), rs.getString("content_hash")),
                filePath);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public long upsertDocument(MarkdownDocument document) {
        Long key = jdbcTemplate.queryForObject("""
                insert into public.obsidian_documents(file_path, title, content_hash, last_modified_at, updated_at)
                values (?, ?, ?, ?, now())
                on conflict (file_path)
                do update set
                  title = excluded.title,
                  content_hash = excluded.content_hash,
                  last_modified_at = excluded.last_modified_at,
                  updated_at = now()
                returning id
                """,
                Long.class,
                document.relativePath(),
                document.title(),
                document.contentHash(),
                Timestamp.from(document.lastModifiedAt()));
        if (key == null) throw new IllegalStateException("Document upsert did not return an id.");
        return key;
    }

    public int deleteChunks(long documentId) {
        return jdbcTemplate.update("delete from public.obsidian_chunks where document_id = ?", documentId);
    }

    public void insertChunk(long documentId, int chunkIndex, MarkdownChunk chunk, float[] embedding, Map<String, Object> metadata) {
        jdbcTemplate.update("""
                insert into public.obsidian_chunks(document_id, chunk_index, heading, chunk_text, embedding, metadata)
                values (?, ?, ?, ?, ?::vector, ?::jsonb)
                """,
                documentId,
                chunkIndex,
                chunk.heading(),
                chunk.text(),
                embedding == null ? null : toVectorLiteral(embedding),
                Json.write(metadata));
    }

    public List<PendingChunk> findPendingEmbeddingChunks(int limit) {
        return jdbcTemplate.query("""
                select id, chunk_text
                from public.obsidian_chunks
                where embedding is null
                  and coalesce(metadata ->> 'embedding_status', 'pending') <> 'failed'
                order by id asc
                limit ?
                """,
                (rs, rowNum) -> new PendingChunk(rs.getLong("id"), rs.getString("chunk_text")),
                Math.min(Math.max(limit, 1), 250));
    }

    public void updateChunkEmbedding(long chunkId, float[] embedding) {
        jdbcTemplate.update("""
                update public.obsidian_chunks
                set embedding = ?::vector,
                    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                        'embedding_status', 'embedded',
                        'embedded_at', ?
                    )
                where id = ?
                """, toVectorLiteral(embedding), Instant.now().toString(), chunkId);
    }

    public List<Map<String, Object>> listDocuments(int limit) {
        return jdbcTemplate.queryForList("""
                select id, file_path, title, content_hash, last_modified_at, created_at, updated_at
                from public.obsidian_documents
                order by updated_at desc
                limit ?
                """, Math.min(Math.max(limit, 1), 500));
    }

    public List<RagReference> search(float[] queryEmbedding, int limit) {
        return jdbcTemplate.query(
                "select * from public.match_obsidian_chunks(?::vector, ?)",
                (rs, rowNum) -> mapReference(rs),
                toVectorLiteral(queryEmbedding),
                Math.min(Math.max(limit, 1), 20));
    }

    public List<RagReference> fallbackSearch(String query, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 20);
        String normalized = query == null ? "" : query.trim();
        if (normalized.isBlank()) {
            return latestChunks(safeLimit);
        }

        String like = "%" + normalized
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
                .toLowerCase() + "%";
        List<RagReference> rows = jdbcTemplate.query("""
                select
                  d.title,
                  d.file_path,
                  c.heading,
                  c.chunk_text,
                  case
                    when lower(c.chunk_text) like ? escape '\\' then 0.55
                    when lower(d.title) like ? escape '\\' then 0.45
                    else 0.35
                  end as score
                from public.obsidian_chunks c
                join public.obsidian_documents d on d.id = c.document_id
                where lower(c.chunk_text) like ? escape '\\'
                   or lower(d.title) like ? escape '\\'
                   or lower(d.file_path) like ? escape '\\'
                order by score desc, c.created_at desc
                limit ?
                """,
                (rs, rowNum) -> mapReference(rs),
                like, like, like, like, like, safeLimit);
        return rows;
    }

    private List<RagReference> latestChunks(int limit) {
        return jdbcTemplate.query("""
                select d.title, d.file_path, c.heading, c.chunk_text, 0.10::double precision as score
                from public.obsidian_chunks c
                join public.obsidian_documents d on d.id = c.document_id
                order by c.created_at desc
                limit ?
                """,
                (rs, rowNum) -> mapReference(rs),
                limit);
    }

    public KnowledgeStatistics safeKnowledgeStatistics() {
        try {
            boolean documentsTable = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "select to_regclass('public.obsidian_documents') is not null",
                    Boolean.class));
            boolean chunksTable = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "select to_regclass('public.obsidian_chunks') is not null",
                    Boolean.class));
            if (!documentsTable || !chunksTable) {
                return new KnowledgeStatistics(0, 0, 0, 0, 0, 0, null, null);
            }

            Integer documents = jdbcTemplate.queryForObject("select count(*) from public.obsidian_documents", Integer.class);
            Integer chunks = jdbcTemplate.queryForObject("select count(*) from public.obsidian_chunks", Integer.class);
            Integer embedded = jdbcTemplate.queryForObject("select count(*) from public.obsidian_chunks where embedding is not null", Integer.class);
            Integer failed = jdbcTemplate.queryForObject("""
                    select count(*)
                    from public.obsidian_chunks
                    where metadata ->> 'embedding_status' = 'failed'
                    """, Integer.class);
            Integer pending = jdbcTemplate.queryForObject("""
                    select count(*)
                    from public.obsidian_chunks
                    where embedding is null
                      and coalesce(metadata ->> 'embedding_status', 'pending') <> 'failed'
                    """, Integer.class);
            Instant lastSync = jdbcTemplate.queryForObject(
                    "select max(updated_at) from public.obsidian_documents",
                    (rs, rowNum) -> rs.getTimestamp(1) == null ? null : rs.getTimestamp(1).toInstant());
            Integer dimensions = jdbcTemplate.queryForObject("""
                    select coalesce((select vector_dims(embedding) from public.obsidian_chunks where embedding is not null limit 1), 0)
                    """, Integer.class);
            return new KnowledgeStatistics(
                    safeInt(documents),
                    safeInt(chunks),
                    safeInt(embedded),
                    safeInt(pending),
                    safeInt(failed),
                    safeInt(dimensions),
                    lastSync,
                    null);
        } catch (Exception error) {
            return new KnowledgeStatistics(0, 0, 0, 0, 0, 0, null, sanitize(error));
        }
    }

    public VectorStoreDiagnostics safeVectorDiagnostics() {
        try {
            jdbcTemplate.queryForObject("select 1", Integer.class);
            boolean extension = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "select exists(select 1 from pg_extension where extname = 'vector')",
                    Boolean.class));
            List<String> indexMethods = jdbcTemplate.queryForList("""
                    select am.amname
                    from pg_index i
                    join pg_class c on c.oid = i.indexrelid
                    join pg_class t on t.oid = i.indrelid
                    join pg_am am on am.oid = c.relam
                    join pg_namespace n on n.oid = t.relnamespace
                    where n.nspname = 'public'
                      and t.relname = 'obsidian_chunks'
                      and c.relname like '%embedding%'
                    """, String.class);
            String indexType = indexMethods.isEmpty() ? "none" : indexMethods.get(0);
            return new VectorStoreDiagnostics(true, extension, !indexMethods.isEmpty(), indexType, null);
        } catch (Exception error) {
            return new VectorStoreDiagnostics(false, false, false, "unknown", sanitize(error));
        }
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String sanitize(Throwable error) {
        if (error == null) return null;
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return message
                .replaceAll("sk-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("password=([^\\s&]+)", "password=[redacted]");
    }

    private RagReference mapReference(ResultSet rs) throws SQLException {
        return new RagReference(
                rs.getString("title"),
                rs.getString("file_path"),
                rs.getString("heading"),
                rs.getString("chunk_text"),
                rs.getDouble("score"));
    }

    private String toVectorLiteral(float[] vector) {
        StringBuilder builder = new StringBuilder("[");
        for (int index = 0; index < vector.length; index += 1) {
            if (index > 0) builder.append(',');
            builder.append(Float.isFinite(vector[index]) ? vector[index] : 0.0f);
        }
        return builder.append(']').toString();
    }

    public record ExistingDocument(long id, String contentHash) {}

    public record PendingChunk(long id, String text) {}

    public record KnowledgeStatistics(
            int documents,
            int chunks,
            int embeddedChunks,
            int pendingEmbeddings,
            int failedEmbeddings,
            int embeddingDimensions,
            Instant lastSyncAt,
            String lastError) {}

    public record VectorStoreDiagnostics(
            boolean databaseConnected,
            boolean extensionInstalled,
            boolean indexReady,
            String indexType,
            String lastError) {}
}
