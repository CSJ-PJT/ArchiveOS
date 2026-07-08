package com.archiveos.ai.managed;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ManagedSystemsRepository {
    private final JdbcTemplate jdbc;

    public ManagedSystemsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> pmTasks() {
        return queryList("""
                select id::text, title, priority, status, target_project, metadata::text as metadata_json, created_at, updated_at
                  from public.pm_tasks
                 order by updated_at desc
                """, this::taskRow);
    }

    public Map<String, Object> queueSummary() {
        List<Map<String, Object>> tasks = pmTasks();
        long pending = tasks.stream().filter(task -> "pm_decision_required".equals(task.get("status"))).count();
        long failed = tasks.stream().filter(task -> "failed".equals(task.get("status"))).count();
        return Map.of("pendingApprovalCount", pending, "failedCount", failed, "taskCount", tasks.size());
    }

    public Map<String, Object> atlasSystem() {
        return queryOne("select * from public.managed_systems where system_id = 'atlas-platform'", this::systemRow);
    }

    public List<Map<String, Object>> atlasServices() {
        return queryList("select * from public.managed_services where system_id = 'atlas-platform' order by name", this::serviceRow);
    }

    public Map<String, Object> latestAtlasHealthcheck() {
        return queryOne("""
                select h.* from public.atlas_healthcheck_results h
                  join public.managed_services s on s.service_id = h.service_id
                 where s.system_id = 'atlas-platform'
                 order by h.checked_at desc limit 1
                """, this::healthcheckRow);
    }

    public List<Map<String, Object>> atlasWorkLogs(int limit) {
        return queryList("""
                select id::text, work_title, target_system_id, target_service_id, repository, task_summary,
                       failure_reason, created_at, updated_at
                  from public.codex_work_logs
                 where target_system_id = 'atlas-platform'
                 order by created_at desc limit ?
                """, this::workLogRow, clamp(limit));
    }

    public Map<String, Object> latestDailyReport() {
        return queryOne("""
                select id::text, target_date, status, status_reason, report_text, created_at
                  from public.daily_reports
                 order by created_at desc limit 1
                """, this::dailyReportRow);
    }

    public List<Map<String, Object>> recentAuditLogs(int limit) {
        return queryList("""
                select id::text, actor, role, action, resource_type, resource_id, request_method, request_path,
                       response_status, occurred_at
                  from public.audit_logs
                 order by occurred_at desc limit ?
                """, this::auditRow, clamp(limit));
    }

    public Map<String, Object> latestAuditEvent() {
        return queryOne("""
                select id::text, actor, role, action, resource_type, resource_id, request_method, request_path,
                       response_status, occurred_at
                  from public.audit_logs
                 order by occurred_at desc limit 1
                """, this::auditRow);
    }

    public Map<String, Object> inboxState(String id) {
        return queryOne("select id, status, acknowledged_at, resolved_at, updated_at, metadata::text as metadata_json from public.pm_inbox_item_states where id = ?",
                this::inboxStateRow, id);
    }

    public Map<String, Object> updateInboxState(String id, String status, Map<String, Object> metadata) {
        ensureInboxStateTable();
        String acknowledged = "acknowledged".equals(status) ? "now()" : "acknowledged_at";
        String resolved = "resolved".equals(status) ? "now()" : "resolved_at";
        return jdbc.queryForObject("""
                insert into public.pm_inbox_item_states(id, status, acknowledged_at, resolved_at, metadata)
                values (?, ?, case when ? = 'acknowledged' then now() else null end,
                           case when ? = 'resolved' then now() else null end, ?::jsonb)
                on conflict (id) do update set
                  status = excluded.status,
                  acknowledged_at = %s,
                  resolved_at = %s,
                  updated_at = now(),
                  metadata = pm_inbox_item_states.metadata || excluded.metadata
                returning id, status, acknowledged_at, resolved_at, updated_at, metadata::text as metadata_json
                """.formatted(acknowledged, resolved), this::inboxStateRow, id, status, status, status, Json.write(metadata == null ? Map.of() : metadata));
    }

    public void recordTimeline(String eventType, String status, String title, String summary, String systemId, String referenceId, Map<String, Object> metadata) {
        jdbc.update("""
                insert into public.runtime_timeline(event_type, status, title, summary, project_id, source, reference_id, metadata)
                values (?, ?, ?, ?, ?, 'managed-systems', ?, ?::jsonb)
                """, eventType, status, title, summary, systemId, referenceId, Json.write(metadata == null ? Map.of() : metadata));
    }

    private void ensureInboxStateTable() {
        jdbc.execute("""
                create table if not exists public.pm_inbox_item_states (
                  id text primary key,
                  status text not null check (status in ('open', 'acknowledged', 'resolved')),
                  acknowledged_at timestamptz,
                  resolved_at timestamptz,
                  updated_at timestamptz not null default now(),
                  metadata jsonb not null default '{}'::jsonb
                )
                """);
    }

    private Map<String, Object> taskRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getString("id"));
        value.put("title", rs.getString("title"));
        value.put("priority", rs.getString("priority"));
        value.put("status", rs.getString("status"));
        value.put("target_project", rs.getString("target_project"));
        value.put("metadata", Json.readObject(rs.getString("metadata_json")));
        value.put("created_at", instant(rs, "created_at"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Map<String, Object> systemRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("system_id", rs.getString("system_id"));
        value.put("name", rs.getString("name"));
        value.put("environment", rs.getString("environment"));
        value.put("provider", rs.getString("provider"));
        value.put("public_base_url", rs.getString("public_base_url"));
        value.put("current_status", rs.getString("current_status"));
        value.put("reason", rs.getString("reason"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Map<String, Object> serviceRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("service_id", rs.getString("service_id"));
        value.put("name", rs.getString("name"));
        value.put("current_status", rs.getString("current_status"));
        value.put("criticality", rs.getString("criticality"));
        value.put("repository", rs.getString("repository"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Map<String, Object> healthcheckRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getString("id"));
        value.put("service_id", rs.getString("service_id"));
        value.put("status", rs.getString("status"));
        value.put("http_status", nullableInt(rs, "http_status"));
        value.put("latency_ms", nullableInt(rs, "latency_ms"));
        value.put("checked_at", instant(rs, "checked_at"));
        return value;
    }

    private Map<String, Object> workLogRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getString("id"));
        value.put("work_title", rs.getString("work_title"));
        value.put("target_system_id", rs.getString("target_system_id"));
        value.put("target_service_id", rs.getString("target_service_id"));
        value.put("repository", rs.getString("repository"));
        value.put("task_summary", rs.getString("task_summary"));
        value.put("failure_reason", rs.getString("failure_reason"));
        value.put("created_at", instant(rs, "created_at"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private Map<String, Object> dailyReportRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getString("id"));
        value.put("target_date", rs.getString("target_date"));
        value.put("status", rs.getString("status"));
        value.put("status_reason", rs.getString("status_reason"));
        value.put("report_text", rs.getString("report_text"));
        value.put("created_at", instant(rs, "created_at"));
        return value;
    }

    private Map<String, Object> auditRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getString("id"));
        value.put("actor", rs.getString("actor"));
        value.put("role", rs.getString("role"));
        value.put("action", rs.getString("action"));
        value.put("resource_type", rs.getString("resource_type"));
        value.put("resource_id", rs.getString("resource_id"));
        value.put("request_method", rs.getString("request_method"));
        value.put("request_path", rs.getString("request_path"));
        value.put("response_status", rs.getInt("response_status"));
        value.put("occurred_at", instant(rs, "occurred_at"));
        return value;
    }

    private Map<String, Object> inboxStateRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getString("id"));
        value.put("status", rs.getString("status"));
        value.put("acknowledged_at", instant(rs, "acknowledged_at"));
        value.put("resolved_at", instant(rs, "resolved_at"));
        value.put("updated_at", instant(rs, "updated_at"));
        value.put("metadata", Json.readObject(rs.getString("metadata_json")));
        return value;
    }

    private <T> List<T> queryList(String sql, org.springframework.jdbc.core.RowMapper<T> mapper, Object... args) {
        try { return jdbc.query(sql, mapper, args); }
        catch (DataAccessException error) { return List.of(); }
    }

    private <T> T queryOne(String sql, org.springframework.jdbc.core.RowMapper<T> mapper, Object... args) {
        List<T> rows = queryList(sql, mapper, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> base() { return new LinkedHashMap<>(); }
    private int clamp(int limit) { return Math.min(Math.max(limit, 1), 100); }
    private Integer nullableInt(ResultSet rs, String name) throws SQLException { int value = rs.getInt(name); return rs.wasNull() ? null : value; }
    private String instant(ResultSet rs, String name) throws SQLException {
        var value = rs.getTimestamp(name);
        return value == null ? null : value.toInstant().toString();
    }
}
