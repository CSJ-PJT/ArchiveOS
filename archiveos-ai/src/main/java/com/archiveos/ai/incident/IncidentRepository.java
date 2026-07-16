package com.archiveos.ai.incident;

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
public class IncidentRepository {
    private final JdbcTemplate jdbc;
    public IncidentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<String, Object> byFingerprint(String fingerprint) {
        List<Map<String, Object>> rows = jdbc.query("select * from public.ai_incidents where fingerprint=? and status not in ('RESOLVED','CLOSED')", this::row, fingerprint);
        return rows.isEmpty() ? null : rows.getFirst();
    }
    public List<Map<String, Object>> list() { return jdbc.query("select * from public.ai_incidents order by detected_at desc", this::row); }
    public Map<String, Object> save(Map<String, Object> value) {
        return jdbc.queryForObject("insert into public.ai_incidents(incident_id,fingerprint,status,severity,title,affected_services,correlation_ids,signals,runtime_evidence,analysis,references_json,recommended_actions) values(?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb) returning *", this::row,
            value.get("id"), value.get("fingerprint"), "DETECTED", value.get("severity"), value.get("title"), Json.write(value.get("services")), Json.write(List.of()), Json.write(value.get("signals")), Json.write(value.get("signals")), Json.write(Map.of()), Json.write(List.of()), Json.write(List.of()));
    }
    public Map<String, Object> state(String id, String status) { jdbc.update("update public.ai_incidents set status=?,updated_at=now() where incident_id=?", status, id); return find(id); }
    public Map<String, Object> updateAnalysis(String id, Map<String, Object> analysis, Object references, Object actions) {
        jdbc.update("update public.ai_incidents set status='REVIEW_REQUIRED',analysis=?::jsonb,references_json=?::jsonb,recommended_actions=?::jsonb,updated_at=now() where incident_id=?", Json.write(analysis), Json.write(references), Json.write(actions), id);
        return find(id);
    }
    public Map<String, Object> find(String id) { List<Map<String, Object>> rows=jdbc.query("select * from public.ai_incidents where incident_id=?", this::row, id); return rows.isEmpty()?null:rows.getFirst(); }
    private Map<String, Object> row(ResultSet rs, int rowNum) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        for (String key : List.of("incident_id","fingerprint","status","severity","title","owner","resolution","memory_id")) value.put(key, rs.getString(key));
        for (String key : List.of("affected_services","correlation_ids","signals","runtime_evidence","analysis","references_json","recommended_actions")) value.put(key, Json.readObjectArrayCompatible(rs.getString(key)));
        for (String key : List.of("detected_at","updated_at")) { Timestamp timestamp=rs.getTimestamp(key); value.put(key, timestamp==null?null:timestamp.toInstant().toString()); }
        return value;
    }
}
