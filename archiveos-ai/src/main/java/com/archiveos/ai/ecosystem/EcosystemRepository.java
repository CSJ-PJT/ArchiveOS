package com.archiveos.ai.ecosystem;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EcosystemRepository {
    private final JdbcTemplate jdbc;

    public EcosystemRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> recordHealth(String type, String name, String baseUrl, String status,
                                            Integer httpStatus, Map<String, Object> summary, String errorMessage) {
        return jdbc.queryForObject("""
                insert into public.ecosystem_health_snapshot(service_type, service_name, base_url, status, http_status, summary, error_message)
                values (?, ?, ?, ?, ?, ?::jsonb, ?)
                returning *
                """, this::healthRow, type, name, baseUrl, status, httpStatus, Json.write(summary == null ? Map.of() : summary), errorMessage);
    }

    public List<Map<String, Object>> recentHealth(int limit) {
        try {
            return jdbc.query("select * from public.ecosystem_health_snapshot order by checked_at desc limit ?", this::healthRow, clamp(limit));
        } catch (DataAccessException error) {
            return List.of();
        }
    }

    public Map<String, Object> latestHealth(String type) {
        List<Map<String, Object>> rows = jdbc.query("""
                select * from public.ecosystem_health_snapshot
                 where service_type = ? order by checked_at desc limit 1
                """, this::healthRow, type);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void recordTimeline(String traceId, String correlationId, String sourceService, String eventType,
                               String aggregateType, String aggregateId, String title, Map<String, Object> detail) {
        jdbc.update("""
                insert into public.ecosystem_event_timeline(trace_id, correlation_id, source_service, event_type, aggregate_type, aggregate_id, title, detail)
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                """, traceId, correlationId, sourceService, eventType, aggregateType, aggregateId, title, Json.write(detail == null ? Map.of() : detail));
    }

    public List<Map<String, Object>> timeline(int limit) {
        try {
            return jdbc.query("select * from public.ecosystem_event_timeline order by occurred_at desc limit ?", this::timelineRow, clamp(limit));
        } catch (DataAccessException error) {
            return List.of();
        }
    }

    public Map<String, Object> approvalSummary() {
        try {
            return jdbc.queryForMap("""
                    select
                      count(*) filter (where status = 'PENDING')::int as pending_external_approvals,
                      count(*) filter (where callback_status in ('CALLBACK_PENDING', 'CALLBACK_SKIPPED'))::int as callback_pending,
                      count(*) filter (where callback_status = 'CALLBACK_FAILED')::int as callback_failed
                    from public.external_approval_requests
                    """);
        } catch (DataAccessException error) {
            return Map.of("pending_external_approvals", 0, "callback_pending", 0, "callback_failed", 0);
        }
    }

    public Map<String, Object> callbackSummary() {
        try {
            return jdbc.queryForMap("""
                    select
                      count(*) filter (where status in ('PENDING', 'RETRY'))::int as callback_pending,
                      count(*) filter (where status = 'FAILED')::int as callback_failed,
                      count(*) filter (where status = 'SENT')::int as callback_sent
                    from public.approval_callback_outbox
                    """);
        } catch (DataAccessException error) {
            return Map.of("callback_pending", 0, "callback_failed", 0, "callback_sent", 0);
        }
    }

    private Map<String, Object> healthRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getLong("id"));
        value.put("service_type", rs.getString("service_type"));
        value.put("service_name", rs.getString("service_name"));
        value.put("base_url", rs.getString("base_url"));
        value.put("status", rs.getString("status"));
        value.put("http_status", (Integer) rs.getObject("http_status"));
        value.put("summary", Json.readObject(rs.getString("summary")));
        value.put("error_message", rs.getString("error_message"));
        value.put("checked_at", instant(rs, "checked_at"));
        value.put("created_at", instant(rs, "created_at"));
        return value;
    }

    private Map<String, Object> timelineRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getLong("id"));
        value.put("trace_id", rs.getString("trace_id"));
        value.put("correlation_id", rs.getString("correlation_id"));
        value.put("source_service", rs.getString("source_service"));
        value.put("event_type", rs.getString("event_type"));
        value.put("aggregate_type", rs.getString("aggregate_type"));
        value.put("aggregate_id", rs.getString("aggregate_id"));
        value.put("title", rs.getString("title"));
        value.put("detail", Json.readObject(rs.getString("detail")));
        value.put("occurred_at", instant(rs, "occurred_at"));
        value.put("created_at", instant(rs, "created_at"));
        return value;
    }

    private int clamp(int limit) { return Math.min(Math.max(limit, 1), 200); }
    private String instant(ResultSet rs, String name) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }
}
