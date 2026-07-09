package com.archiveos.ai.approval;

import com.archiveos.ai.obsidian.Json;
import java.math.BigDecimal;
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
public class ExternalApprovalRepository {
    private final JdbcTemplate jdbc;

    public ExternalApprovalRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> findDuplicate(String correlationId, String transactionId) {
        List<Map<String, Object>> rows = jdbc.query("""
                select * from public.external_approval_requests
                 where correlation_id = ? or transaction_id = ?
                 order by created_at asc limit 1
                """, this::requestRow, correlationId, transactionId);
        return rows.isEmpty() ? null : detail(String.valueOf(rows.get(0).get("approval_request_id")));
    }

    public Map<String, Object> createRequest(Map<String, Object> values) {
        return jdbc.queryForObject("""
                insert into public.external_approval_requests(
                  approval_request_id, source, target_system_id, correlation_id, transaction_id, amount, currency,
                  reason, policy_question, metadata, status, callback_path, callback_status,
                  source_service, callback_target, route_plan_id, event_id)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'PENDING', ?, 'CALLBACK_PENDING', ?, ?, ?, ?)
                returning *
                """, this::requestRow,
                values.get("approval_request_id"), values.get("source"), values.get("target_system_id"),
                values.get("correlation_id"), values.get("transaction_id"), values.get("amount"),
                values.get("currency"), values.get("reason"), values.get("policy_question"),
                Json.write(values.getOrDefault("metadata", Map.of())), values.get("callback_path"),
                values.get("source_service"), values.get("callback_target"), values.get("route_plan_id"), values.get("event_id"));
    }

    public List<Map<String, Object>> list(int limit) {
        return jdbc.query("select * from public.external_approval_requests order by created_at desc limit ?",
                this::requestRow, clamp(limit));
    }

    public List<Map<String, Object>> list(String status, String source, int limit) {
        if ((status == null || status.isBlank()) && (source == null || source.isBlank())) return list(limit);
        if (status != null && !status.isBlank() && source != null && !source.isBlank()) {
            return jdbc.query("""
                    select * from public.external_approval_requests
                     where upper(status) = upper(?) and lower(source) = lower(?)
                     order by created_at desc limit ?
                    """, this::requestRow, status, source, clamp(limit));
        }
        if (status != null && !status.isBlank()) {
            return jdbc.query("""
                    select * from public.external_approval_requests
                     where upper(status) = upper(?)
                     order by created_at desc limit ?
                    """, this::requestRow, status, clamp(limit));
        }
        return jdbc.query("""
                select * from public.external_approval_requests
                 where lower(source) = lower(?)
                 order by created_at desc limit ?
                """, this::requestRow, source, clamp(limit));
    }

    public Map<String, Object> find(String approvalRequestId) {
        List<Map<String, Object>> rows = jdbc.query("select * from public.external_approval_requests where approval_request_id = ?",
                this::requestRow, approvalRequestId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> detail(String approvalRequestId) {
        Map<String, Object> request = find(approvalRequestId);
        if (request == null) return null;
        Map<String, Object> value = new LinkedHashMap<>(request);
        value.put("evidence", evidence(approvalRequestId));
        value.put("decisions", decisions(approvalRequestId));
        value.put("callbacks", callbacks(approvalRequestId));
        return value;
    }

    public Map<String, Object> insertEvidence(String approvalRequestId, String type, String title, String content, String sourcePath, BigDecimal confidence) {
        return jdbc.queryForObject("""
                insert into public.external_approval_evidence(approval_request_id, evidence_type, title, content, source_path, confidence)
                values (?, ?, ?, ?, ?, ?) returning *
                """, this::evidenceRow, approvalRequestId, type, title, content, sourcePath, confidence);
    }

    public Map<String, Object> insertDecision(String approvalRequestId, String decision, String decidedBy, String comment) {
        return jdbc.queryForObject("""
                insert into public.external_approval_decisions(approval_request_id, decision, decided_by, comment)
                values (?, ?, ?, ?) returning *
                """, this::decisionRow, approvalRequestId, decision, decidedBy, comment);
    }

    public void updateDecisionState(String approvalRequestId, String status, String decidedBy) {
        jdbc.update("""
                update public.external_approval_requests
                   set status = ?, decided_by = ?, decided_at = now(), updated_at = now()
                 where approval_request_id = ?
                """, status, decidedBy, approvalRequestId);
    }

    public Map<String, Object> insertCallback(String approvalRequestId, String targetSystemId, String urlMasked, String status, int attemptCount, String lastError, boolean completed) {
        return jdbc.queryForObject("""
                insert into public.external_approval_callbacks(approval_request_id, target_system_id, callback_url_masked, status, attempt_count, last_error, completed_at)
                values (?, ?, ?, ?, ?, ?, case when ? then now() else null end)
                returning *
                """, this::callbackRow, approvalRequestId, targetSystemId, urlMasked, status, attemptCount, lastError, completed);
    }

    public void updateCallbackState(String approvalRequestId, String status, int attemptCount, String lastError) {
        jdbc.update("""
                update public.external_approval_requests
                   set callback_status = ?,
                       callback_attempt_count = callback_attempt_count + ?,
                       callback_last_error = ?,
                       updated_at = now()
                 where approval_request_id = ?
                """, status, attemptCount, lastError, approvalRequestId);
    }

    public List<Map<String, Object>> evidence(String approvalRequestId) {
        return jdbc.query("""
                select * from public.external_approval_evidence
                 where approval_request_id = ? order by created_at desc
                """, this::evidenceRow, approvalRequestId);
    }

    public List<Map<String, Object>> decisions(String approvalRequestId) {
        return jdbc.query("""
                select * from public.external_approval_decisions
                 where approval_request_id = ? order by decided_at desc
                """, this::decisionRow, approvalRequestId);
    }

    public List<Map<String, Object>> callbacks(String approvalRequestId) {
        return jdbc.query("""
                select * from public.external_approval_callbacks
                 where approval_request_id = ? order by requested_at desc
                """, this::callbackRow, approvalRequestId);
    }

    public Map<String, Object> summary() {
        try {
            return jdbc.queryForMap("""
                    select
                      count(*) filter (where status = 'PENDING')::int as pending,
                      count(*) filter (where callback_status = 'CALLBACK_FAILED')::int as callback_failed,
                      count(*)::int as total
                    from public.external_approval_requests
                    """);
        } catch (DataAccessException error) {
            return Map.of("pending", 0, "callback_failed", 0, "total", 0);
        }
    }

    public void linkPolicyEvidence(String approvalRequestId, String evidenceId) {
        jdbc.update("""
                update public.external_approval_requests
                   set policy_evidence_id = ?, updated_at = now()
                 where approval_request_id = ?
                """, evidenceId, approvalRequestId);
    }

    public Map<String, Object> latest() {
        List<Map<String, Object>> rows = jdbc.query("""
                select * from public.external_approval_requests order by created_at desc limit 1
                """, this::requestRow);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> pending(int limit) {
        return jdbc.query("""
                select * from public.external_approval_requests
                 where status = 'PENDING'
                 order by created_at desc limit ?
                """, this::requestRow, clamp(limit));
    }

    public List<Map<String, Object>> callbackFailed(int limit) {
        return jdbc.query("""
                select * from public.external_approval_requests
                 where callback_status = 'CALLBACK_FAILED'
                 order by updated_at desc limit ?
                """, this::requestRow, clamp(limit));
    }

    private Map<String, Object> requestRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getObject("id").toString());
        value.put("approval_request_id", rs.getString("approval_request_id"));
        value.put("source", rs.getString("source"));
        value.put("target_system_id", rs.getString("target_system_id"));
        value.put("correlation_id", rs.getString("correlation_id"));
        value.put("transaction_id", rs.getString("transaction_id"));
        value.put("amount", rs.getBigDecimal("amount"));
        value.put("currency", rs.getString("currency"));
        value.put("reason", rs.getString("reason"));
        value.put("policy_question", rs.getString("policy_question"));
        value.put("metadata", Json.readObject(rs.getString("metadata")));
        value.put("status", rs.getString("status"));
        value.put("callback_path", rs.getString("callback_path"));
        value.put("callback_status", rs.getString("callback_status"));
        value.put("source_service", rs.getString("source_service"));
        value.put("callback_target", rs.getString("callback_target"));
        value.put("route_plan_id", rs.getString("route_plan_id"));
        value.put("event_id", rs.getString("event_id"));
        value.put("policy_evidence_id", rs.getString("policy_evidence_id"));
        value.put("callback_attempt_count", rs.getInt("callback_attempt_count"));
        value.put("callback_last_error", rs.getString("callback_last_error"));
        value.put("created_at", instant(rs, "created_at"));
        value.put("updated_at", instant(rs, "updated_at"));
        value.put("decided_at", instant(rs, "decided_at"));
        value.put("decided_by", rs.getString("decided_by"));
        return value;
    }

    private Map<String, Object> evidenceRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getObject("id").toString());
        value.put("approval_request_id", rs.getString("approval_request_id"));
        value.put("evidence_type", rs.getString("evidence_type"));
        value.put("title", rs.getString("title"));
        value.put("content", rs.getString("content"));
        value.put("source_path", rs.getString("source_path"));
        value.put("confidence", rs.getBigDecimal("confidence"));
        value.put("created_at", instant(rs, "created_at"));
        return value;
    }

    private Map<String, Object> decisionRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getObject("id").toString());
        value.put("approval_request_id", rs.getString("approval_request_id"));
        value.put("decision", rs.getString("decision"));
        value.put("decided_by", rs.getString("decided_by"));
        value.put("comment", rs.getString("comment"));
        value.put("decided_at", instant(rs, "decided_at"));
        return value;
    }

    private Map<String, Object> callbackRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = base();
        value.put("id", rs.getObject("id").toString());
        value.put("approval_request_id", rs.getString("approval_request_id"));
        value.put("target_system_id", rs.getString("target_system_id"));
        value.put("callback_url_masked", rs.getString("callback_url_masked"));
        value.put("status", rs.getString("status"));
        value.put("attempt_count", rs.getInt("attempt_count"));
        value.put("last_error", rs.getString("last_error"));
        value.put("requested_at", instant(rs, "requested_at"));
        value.put("completed_at", instant(rs, "completed_at"));
        return value;
    }

    private int clamp(int limit) { return Math.min(Math.max(limit, 1), 200); }
    private Map<String, Object> base() { return new LinkedHashMap<>(); }
    private String instant(ResultSet rs, String name) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }
}
