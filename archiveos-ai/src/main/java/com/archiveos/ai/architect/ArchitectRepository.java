package com.archiveos.ai.architect;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ArchitectRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public ArchitectRepository(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    public Map<String, Object> insert(String targetType, String targetRef, String status, String summary, Object findings, Object recommendations, Object relatedNodes) {
        return jdbc.queryForObject("""
            insert into public.architecture_reviews(target_type,target_ref,status,summary,findings,recommendations,related_nodes)
            values (?,?,?,?,?::jsonb,?::jsonb,?::jsonb) returning *
            """, this::row, targetType, targetRef, status, summary, json(findings), json(recommendations), json(relatedNodes));
    }
    public List<Map<String, Object>> recent(int limit) { return jdbc.query("select * from public.architecture_reviews order by created_at desc limit ?", this::row, Math.min(Math.max(limit, 1), 100)); }
    public Map<String, Object> latest() { List<Map<String, Object>> rows = recent(1); return rows.isEmpty() ? null : rows.get(0); }
    public List<Map<String, Object>> related(String targetRef, String title) {
        String query = "%" + title.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        List<Map<String, Object>> exact = jdbc.query("select id,node_type,title,external_ref from public.knowledge_nodes where external_ref=? limit 5", this::relatedRow, targetRef);
        return exact.isEmpty() ? jdbc.query("select id,node_type,title,external_ref from public.knowledge_nodes where title ilike ? escape '\\' order by created_at desc limit 5", this::relatedRow, query) : exact;
    }
    private Map<String, Object> row(ResultSet rs, int ignored) throws SQLException {
        var out = new java.util.LinkedHashMap<String, Object>(); out.put("id", rs.getString("id")); out.put("target_type", rs.getString("target_type")); out.put("target_ref", rs.getString("target_ref")); out.put("status", rs.getString("status")); out.put("summary", rs.getString("summary")); out.put("findings", value(rs.getString("findings"))); out.put("recommendations", value(rs.getString("recommendations"))); out.put("related_nodes", value(rs.getString("related_nodes"))); out.put("created_at", rs.getTimestamp("created_at").toInstant().toString()); return out;
    }
    private Map<String, Object> relatedRow(ResultSet rs, int ignored) throws SQLException { var out = new java.util.LinkedHashMap<String, Object>(); out.put("id", rs.getString("id")); out.put("node_type", rs.getString("node_type")); out.put("title", rs.getString("title")); out.put("external_ref", rs.getString("external_ref")); return out; }
    private String json(Object value) { try { return mapper.writeValueAsString(value); } catch (JsonProcessingException error) { throw new IllegalArgumentException(error); } }
    private Object value(String value) { try { return mapper.readValue(value, Object.class); } catch (JsonProcessingException error) { return List.of(); } }
}
