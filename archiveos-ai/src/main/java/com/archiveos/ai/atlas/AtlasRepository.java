package com.archiveos.ai.atlas;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AtlasRepository {
    private final JdbcTemplate jdbc;
    public AtlasRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<String, Object> system(String systemId) {
        return jdbc.queryForObject("select * from public.managed_systems where system_id = ?", this::system, systemId);
    }

    public List<Map<String, Object>> services(String systemId) {
        return jdbc.query("select * from public.managed_services where system_id = ? order by case criticality when 'Critical' then 1 when 'High' then 2 else 3 end, name", this::serviceRow, systemId);
    }

    public List<Map<String, Object>> environmentRequirements(String systemId) {
        return jdbc.query("select * from public.managed_environment_requirements where system_id = ? order by service_id nulls first, env_name", this::environmentRequirement, systemId);
    }

    public Map<String, Object> service(String serviceId) {
        List<Map<String, Object>> rows = jdbc.query("select * from public.managed_services where service_id = ?", this::serviceRow, serviceId);
        if (rows.isEmpty()) throw new AtlasValidationException("Managed service not found.");
        return rows.get(0);
    }

    public Map<String, Object> recordHealthcheck(String serviceId, String status, Integer httpStatus, int latencyMs, int expectedStatus, String errorMessage, String responseExcerpt) {
        return jdbc.queryForObject("""
                insert into public.atlas_healthcheck_results(service_id, status, http_status, latency_ms, expected_status, error_message, response_excerpt)
                values (?, ?, ?, ?, ?, ?, ?) returning *
                """, this::healthcheckResult, serviceId, status, httpStatus, latencyMs, expectedStatus, errorMessage, responseExcerpt);
    }

    public List<Map<String, Object>> recentHealthcheckResults(String systemId, int limit) {
        return jdbc.query("""
                select h.* from public.atlas_healthcheck_results h
                join public.managed_services s on s.service_id = h.service_id
                where s.system_id = ?
                order by h.checked_at desc limit ?
                """, this::healthcheckResult, systemId, clamp(limit, 200));
    }

    public List<Map<String, Object>> latestHealthcheckByService(String systemId) {
        return jdbc.query("""
                select distinct on (h.service_id) h.*
                from public.atlas_healthcheck_results h
                join public.managed_services s on s.service_id = h.service_id
                where s.system_id = ?
                order by h.service_id, h.checked_at desc
                """, this::healthcheckResult, systemId);
    }

    public void updateServiceStatus(String serviceId, String status) {
        jdbc.update("update public.managed_services set current_status = ?, updated_at = now() where service_id = ?", status, serviceId);
    }

    public void updateSystemStatus(String systemId, String status, String reason) {
        jdbc.update("update public.managed_systems set current_status = ?, reason = ?, updated_at = now() where system_id = ?", status, reason, systemId);
    }

    public List<Map<String, Object>> workLogs(String systemId, int limit) {
        return jdbc.query("""
                select * from public.codex_work_logs
                where target_system_id = ?
                order by created_at desc limit ?
                """, this::workLog, systemId, clamp(limit, 100));
    }

    public Map<String, Object> createWorkLog(Map<String, Object> values) {
        return jdbc.queryForObject("""
                insert into public.codex_work_logs(
                  work_title, target_system_id, target_service_id, repository, started_at, finished_at, actor, agent, model,
                  reasoning_level, task_summary, changed_files, test_results, failure_reason, next_actions,
                  committed, pushed, deployed, rollback_plan
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, ?, ?, ?, ?)
                returning *
                """, this::workLog,
                values.get("work_title"), values.get("target_system_id"), values.get("target_service_id"), values.get("repository"),
                timestamp(values.get("started_at")), timestamp(values.get("finished_at")), values.get("actor"), values.get("agent"), values.get("model"),
                values.get("reasoning_level"), values.get("task_summary"), Json.write(values.get("changed_files")),
                Json.write(values.get("test_results")), values.get("failure_reason"), Json.write(values.get("next_actions")),
                values.get("committed"), values.get("pushed"), values.get("deployed"), values.get("rollback_plan"));
    }

    private Map<String, Object> system(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("system_id", rs.getString("system_id"));
        value.put("name", rs.getString("name"));
        value.put("environment", rs.getString("environment"));
        value.put("provider", rs.getString("provider"));
        value.put("public_base_url", rs.getString("public_base_url"));
        value.put("role", rs.getString("role"));
        value.put("current_status", rs.getString("current_status"));
        value.put("reason", rs.getString("reason"));
        value.put("metadata", Json.readObject(rs.getString("metadata")));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Map<String, Object> serviceRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("service_id", rs.getString("service_id"));
        value.put("system_id", rs.getString("system_id"));
        value.put("name", rs.getString("name"));
        value.put("url_path", rs.getString("url_path"));
        value.put("healthcheck_url", rs.getString("healthcheck_url"));
        value.put("service_type", rs.getString("service_type"));
        value.put("criticality", rs.getString("criticality"));
        value.put("current_status", rs.getString("current_status"));
        value.put("repository", rs.getString("repository"));
        value.put("note", rs.getString("note"));
        value.put("expected_status", rs.getInt("expected_status"));
        value.put("timeout_ms", rs.getInt("timeout_ms"));
        value.put("retry_count", rs.getInt("retry_count"));
        value.put("enabled", rs.getBoolean("enabled"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Map<String, Object> environmentRequirement(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString());
        value.put("system_id", rs.getString("system_id"));
        value.put("service_id", rs.getString("service_id"));
        value.put("env_name", rs.getString("env_name"));
        value.put("required", rs.getBoolean("required"));
        value.put("secret", rs.getBoolean("secret"));
        value.put("description", rs.getString("description"));
        return value;
    }

    private Map<String, Object> healthcheckResult(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString());
        value.put("service_id", rs.getString("service_id"));
        value.put("checked_at", instant(rs, "checked_at"));
        value.put("status", rs.getString("status"));
        value.put("http_status", nullableInt(rs, "http_status"));
        value.put("latency_ms", nullableInt(rs, "latency_ms"));
        value.put("expected_status", rs.getInt("expected_status"));
        value.put("error_message", rs.getString("error_message"));
        value.put("response_excerpt", rs.getString("response_excerpt"));
        value.put("metadata", Json.readObject(rs.getString("metadata")));
        return value;
    }

    private Map<String, Object> workLog(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString());
        value.put("work_title", rs.getString("work_title"));
        value.put("target_system_id", rs.getString("target_system_id"));
        value.put("target_service_id", rs.getString("target_service_id"));
        value.put("repository", rs.getString("repository"));
        value.put("started_at", instant(rs, "started_at"));
        value.put("finished_at", instant(rs, "finished_at"));
        value.put("actor", rs.getString("actor"));
        value.put("agent", rs.getString("agent"));
        value.put("model", rs.getString("model"));
        value.put("reasoning_level", rs.getString("reasoning_level"));
        value.put("task_summary", rs.getString("task_summary"));
        value.put("changed_files", Json.readObjectArrayCompatible(rs.getString("changed_files")));
        value.put("test_results", Json.readObjectArrayCompatible(rs.getString("test_results")));
        value.put("failure_reason", rs.getString("failure_reason"));
        value.put("next_actions", Json.readObjectArrayCompatible(rs.getString("next_actions")));
        value.put("committed", rs.getBoolean("committed"));
        value.put("pushed", rs.getBoolean("pushed"));
        value.put("deployed", rs.getBoolean("deployed"));
        value.put("rollback_plan", rs.getString("rollback_plan"));
        value.put("created_at", instant(rs, "created_at"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Integer nullableInt(ResultSet rs, String name) throws SQLException {
        int value = rs.getInt(name);
        return rs.wasNull() ? null : value;
    }

    private String instant(ResultSet rs, String name) throws SQLException {
        var timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }

    private Timestamp timestamp(Object value) {
        if (value == null) return null;
        return Timestamp.from(Instant.parse(String.valueOf(value)));
    }

    private int clamp(int value, int max) { return Math.min(Math.max(value, 1), max); }
}
