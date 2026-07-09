package com.archiveos.ai.approval.callback;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ApprovalCallbackOutboxRepository {
    private final JdbcTemplate jdbc;
    public ApprovalCallbackOutboxRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<String, Object> create(String callbackId, String approvalRequestId, String sourceService,
                                      String targetService, String targetUrl, Map<String, Object> payload, String status, String lastError) {
        return jdbc.queryForObject("""
                insert into public.approval_callback_outbox(callback_id, approval_request_id, source_service, target_service, target_url, payload, status, last_error)
                values (?, ?, ?, ?, ?, ?::jsonb, ?, ?) returning *
                """, this::row, callbackId, approvalRequestId, sourceService, targetService, targetUrl, Json.write(payload), status, lastError);
    }

    public List<Map<String, Object>> list(int limit) {
        try {
            return jdbc.query("select * from public.approval_callback_outbox order by created_at desc limit ?", this::row, clamp(limit));
        } catch (DataAccessException error) { return List.of(); }
    }

    public Map<String, Object> find(String callbackId) {
        List<Map<String, Object>> rows = jdbc.query("select * from public.approval_callback_outbox where callback_id = ?", this::row, callbackId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> failedOrRetry(int limit) {
        return jdbc.query("""
                select * from public.approval_callback_outbox
                 where status in ('FAILED', 'RETRY', 'PENDING')
                 order by created_at asc limit ?
                """, this::row, clamp(limit));
    }

    public void markSent(String callbackId) {
        jdbc.update("""
                update public.approval_callback_outbox
                   set status = 'SENT', sent_at = now(), updated_at = now(), last_error = null
                 where callback_id = ?
                """, callbackId);
    }

    public void markRetry(String callbackId, String status, int maxRetryCount, int retryDelaySeconds, String error) {
        jdbc.update("""
                update public.approval_callback_outbox
                   set retry_count = retry_count + 1,
                       status = case when retry_count + 1 >= ? then 'FAILED' else ? end,
                       last_error = ?,
                       next_retry_at = now() + (? || ' seconds')::interval,
                       updated_at = now()
                 where callback_id = ?
                """, maxRetryCount, status, error, retryDelaySeconds, callbackId);
    }

    private Map<String, Object> row(ResultSet rs, int i) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getLong("id"));
        value.put("callback_id", rs.getString("callback_id"));
        value.put("approval_request_id", rs.getString("approval_request_id"));
        value.put("source_service", rs.getString("source_service"));
        value.put("target_service", rs.getString("target_service"));
        value.put("target_url", rs.getString("target_url"));
        value.put("payload", Json.readObject(rs.getString("payload")));
        value.put("status", rs.getString("status"));
        value.put("retry_count", rs.getInt("retry_count"));
        value.put("last_error", rs.getString("last_error"));
        value.put("next_retry_at", instant(rs, "next_retry_at"));
        value.put("created_at", instant(rs, "created_at"));
        value.put("sent_at", instant(rs, "sent_at"));
        value.put("updated_at", instant(rs, "updated_at"));
        return value;
    }

    private int clamp(int limit) { return Math.min(Math.max(limit, 1), 200); }
    private String instant(ResultSet rs, String name) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }
}
