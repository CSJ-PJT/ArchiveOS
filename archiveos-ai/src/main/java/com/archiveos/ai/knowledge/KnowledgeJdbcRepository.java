package com.archiveos.ai.knowledge;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class KnowledgeJdbcRepository {
    private final JdbcTemplate jdbc;

    public KnowledgeJdbcRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean available() {
        try {
            return Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('public.knowledge_nodes') is not null and to_regclass('public.knowledge_edges') is not null", Boolean.class));
        } catch (Exception ignored) { return false; }
    }

    public long nodeCount() { return count("select count(*) from public.knowledge_nodes"); }
    public long edgeCount() { return count("select count(*) from public.knowledge_edges"); }

    public Map<String, Long> countsByType() {
        return jdbc.query("select node_type, count(*) as total from public.knowledge_nodes group by node_type",
                rs -> { var values = new java.util.LinkedHashMap<String, Long>(); while (rs.next()) values.put(rs.getString("node_type"), rs.getLong("total")); return values; });
    }

    public List<KnowledgeNode> recentNodes(int limit) {
        return jdbc.query("select * from public.knowledge_nodes order by created_at desc limit ?", this::mapNode, clamp(limit, 100));
    }

    public List<KnowledgeEdge> recentEdges(int limit) {
        return jdbc.query("select * from public.knowledge_edges order by created_at desc limit ?", this::mapEdge, clamp(limit, 600));
    }

    public List<KnowledgeNode> search(String query, int limit) {
        String pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.query("""
                select * from public.knowledge_nodes
                where title ilike ? escape '\\' or coalesce(summary, '') ilike ? escape '\\' or coalesce(external_ref, '') ilike ? escape '\\'
                order by created_at desc limit ?
                """, this::mapNode, pattern, pattern, pattern, clamp(limit, 100));
    }

    public List<KnowledgeNode> matching(String externalRef, String nodeType) {
        if (externalRef != null && nodeType != null) return jdbc.query("select * from public.knowledge_nodes where external_ref = ? and node_type = ? limit 10", this::mapNode, externalRef, nodeType);
        if (externalRef != null) return jdbc.query("select * from public.knowledge_nodes where external_ref = ? limit 10", this::mapNode, externalRef);
        if (nodeType != null) return jdbc.query("select * from public.knowledge_nodes where node_type = ? limit 10", this::mapNode, nodeType);
        return List.of();
    }

    public KnowledgeNode node(String id) {
        List<KnowledgeNode> rows = jdbc.query("select * from public.knowledge_nodes where id::text = ?", this::mapNode, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<KnowledgeEdge> outgoing(String id) { return jdbc.query("select * from public.knowledge_edges where from_node_id::text = ? order by created_at desc", this::mapEdge, id); }
    public List<KnowledgeEdge> incoming(String id) { return jdbc.query("select * from public.knowledge_edges where to_node_id::text = ? order by created_at desc", this::mapEdge, id); }

    private long count(String sql) { Long value = jdbc.queryForObject(sql, Long.class); return value == null ? 0 : value; }
    private int clamp(int value, int max) { return Math.min(Math.max(value, 1), max); }
    private KnowledgeNode mapNode(ResultSet rs, int row) throws SQLException { return new KnowledgeNode(rs.getString("id"), rs.getString("node_type"), rs.getString("title"), rs.getString("summary"), rs.getString("source"), rs.getString("external_ref"), Json.readObject(rs.getString("metadata")), instant(rs, "created_at"), instant(rs, "updated_at")); }
    private KnowledgeEdge mapEdge(ResultSet rs, int row) throws SQLException { return new KnowledgeEdge(rs.getString("id"), rs.getString("from_node_id"), rs.getString("to_node_id"), rs.getString("edge_type"), rs.getDouble("confidence"), Json.readObject(rs.getString("metadata")), instant(rs, "created_at")); }
    private String instant(ResultSet rs, String name) throws SQLException { var timestamp = rs.getTimestamp(name); return timestamp == null ? null : timestamp.toInstant().toString(); }

    public record KnowledgeNode(String id, String node_type, String title, String summary, String source, String external_ref, Map<String, Object> metadata, String created_at, String updated_at) {}
    public record KnowledgeEdge(String id, String from_node_id, String to_node_id, String edge_type, double confidence, Map<String, Object> metadata, String created_at) {}
}
