package com.archiveos.ai.decision;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DecisionRepository {
    private final JdbcTemplate jdbc;
    public DecisionRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<String, Object> findByFingerprint(String fingerprint) { return one("select * from public.ai_decision_recommendations where context_fingerprint = ?", fingerprint); }
    public Map<String, Object> find(String id) { return one("select * from public.ai_decision_recommendations where recommendation_id = ?", id); }
    public List<Map<String, Object>> list(int limit) { return jdbc.query("select * from public.ai_decision_recommendations order by created_at desc limit ?", this::row, Math.min(Math.max(limit, 1), 200)); }
    public Map<String, Object> save(Map<String, Object> v) {
        return jdbc.queryForObject("""
          insert into public.ai_decision_recommendations(recommendation_id,request_id,context_fingerprint,trigger_type,service,entity_id,correlation_id,question,requested_by,status,summary,observed_facts,hypotheses,recommended_actions,risks,confidence,references_json,runtime_evidence,policy_checks,runtime_context,model,prompt_version,latency_ms,token_usage)
          values (?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?,?::jsonb) returning *
          """, this::row, v.get("recommendationId"),v.get("requestId"),v.get("fingerprint"),v.get("triggerType"),v.get("service"),v.get("entityId"),v.get("correlationId"),v.get("question"),v.get("requestedBy"),v.get("status"),v.get("summary"),Json.write(v.get("observedFacts")),Json.write(v.get("hypotheses")),Json.write(v.get("actions")),Json.write(v.get("risks")),v.get("confidence"),Json.write(v.get("references")),Json.write(v.get("runtimeEvidence")),Json.write(v.get("policyChecks")),Json.write(v.get("runtimeContext")),v.get("model"),v.get("promptVersion"),v.get("latencyMs"),Json.write(Map.of()));
    }
    public Map<String, Object> decide(String id, String status, String by, String reason) {
        jdbc.update("update public.ai_decision_recommendations set status=?, decided_at=now(), decided_by=?, decision_reason=? where recommendation_id=?", status, by, reason, id);
        return find(id);
    }
    private Map<String, Object> one(String sql, Object value) { List<Map<String,Object>> rows=jdbc.query(sql,this::row,value); return rows.isEmpty()?null:rows.get(0); }
    private Map<String,Object> row(ResultSet rs,int n) throws SQLException { Map<String,Object> v=new LinkedHashMap<>();
        for (String key: List.of("recommendation_id","request_id","context_fingerprint","trigger_type","service","entity_id","correlation_id","question","requested_by","status","summary","model","prompt_version","decided_by","decision_reason")) v.put(key,rs.getString(key));
        for (String key: List.of("observed_facts","hypotheses","recommended_actions","risks","references_json","runtime_evidence","policy_checks","runtime_context","token_usage")) v.put(key,Json.readObjectArrayCompatible(rs.getString(key)));
        v.put("confidence",rs.getBigDecimal("confidence")); v.put("latency_ms",rs.getObject("latency_ms"));
        for (String key: List.of("created_at","decided_at")) { Timestamp t=rs.getTimestamp(key); v.put(key,t==null?null:t.toInstant().toString()); } return v; }
}
