package com.archiveos.ai.obsidian;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
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
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    insert into public.obsidian_documents(file_path, title, content_hash, last_modified_at, updated_at)
                    values (?, ?, ?, ?, now())
                    on conflict (file_path)
                    do update set
                      title = excluded.title,
                      content_hash = excluded.content_hash,
                      last_modified_at = excluded.last_modified_at,
                      updated_at = now()
                    returning id
                    """);
            statement.setString(1, document.relativePath());
            statement.setString(2, document.title());
            statement.setString(3, document.contentHash());
            statement.setTimestamp(4, Timestamp.from(document.lastModifiedAt()));
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) throw new IllegalStateException("Document upsert did not return an id.");
        return key.longValue();
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
                toVectorLiteral(embedding),
                Json.write(metadata));
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
}
