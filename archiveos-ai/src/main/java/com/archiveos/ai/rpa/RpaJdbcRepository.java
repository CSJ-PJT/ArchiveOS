package com.archiveos.ai.rpa;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RpaJdbcRepository {
    private final JdbcTemplate jdbcTemplate;

    public RpaJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void ensureSchema() {
        jdbcTemplate.execute("""
                create table if not exists public.archiveos_rpa_tasks (
                  id uuid primary key,
                  title text not null,
                  description text not null,
                  target_project text,
                  requested_by text,
                  status text not null,
                  category text,
                  risk_level text,
                  recommendation text,
                  approval_required boolean not null default true,
                  summary text,
                  classification_source text,
                  error text,
                  metadata jsonb not null default '{}'::jsonb,
                  created_at timestamptz not null default now(),
                  updated_at timestamptz not null default now()
                )
                """);
        jdbcTemplate.execute("create index if not exists archiveos_rpa_tasks_status_idx on public.archiveos_rpa_tasks(status)");
        jdbcTemplate.execute("create index if not exists archiveos_rpa_tasks_created_at_idx on public.archiveos_rpa_tasks(created_at desc)");
        jdbcTemplate.execute("""
                create table if not exists public.archiveos_rpa_decisions (
                  id uuid primary key,
                  task_id uuid not null references public.archiveos_rpa_tasks(id) on delete cascade,
                  action text not null,
                  reason text,
                  decided_by text,
                  previous_status text not null,
                  next_status text not null,
                  metadata jsonb not null default '{}'::jsonb,
                  created_at timestamptz not null default now()
                )
                """);
        jdbcTemplate.execute("create index if not exists archiveos_rpa_decisions_task_id_idx on public.archiveos_rpa_decisions(task_id)");
        jdbcTemplate.execute("create index if not exists archiveos_rpa_decisions_created_at_idx on public.archiveos_rpa_decisions(created_at desc)");
    }

    public RpaTaskRecord create(RpaTaskRequest request) {
        ensureSchema();
        UUID id = UUID.randomUUID();
        return jdbcTemplate.queryForObject("""
                insert into public.archiveos_rpa_tasks(
                  id, title, description, target_project, requested_by, status, metadata
                )
                values (?, ?, ?, ?, ?, 'queued', ?::jsonb)
                returning *
                """,
                this::mapRow,
                id,
                request.title().trim(),
                request.description().trim(),
                blankToNull(request.targetProject()),
                blankToNull(request.requestedBy()),
                Json.write(request.metadata() == null ? Map.of() : request.metadata()));
    }

    public RpaTaskRecord get(UUID id) {
        List<RpaTaskRecord> rows = jdbcTemplate.query(
                "select * from public.archiveos_rpa_tasks where id = ?",
                this::mapRow,
                id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<RpaTaskRecord> recent(int limit) {
        ensureSchema();
        return jdbcTemplate.query("""
                select * from public.archiveos_rpa_tasks
                order by created_at desc
                limit ?
                """,
                this::mapRow,
                Math.min(Math.max(limit, 1), 100));
    }

    public void markRunning(UUID id) {
        jdbcTemplate.update("""
                update public.archiveos_rpa_tasks
                set status = 'running', updated_at = now()
                where id = ?
                """, id);
    }

    public void saveClassification(UUID id, RpaClassification classification) {
        jdbcTemplate.update("""
                update public.archiveos_rpa_tasks
                set status = 'pm_approval_required',
                    category = ?,
                    risk_level = ?,
                    recommendation = ?,
                    approval_required = ?,
                    summary = ?,
                    classification_source = ?,
                    error = ?,
                    metadata = metadata || ?::jsonb,
                    updated_at = now()
                where id = ?
                """,
                classification.category(),
                classification.riskLevel(),
                classification.recommendation(),
                classification.approvalRequired(),
                classification.summary(),
                classification.source(),
                classification.error(),
                Json.write(classification.metadata()),
                id);
    }

    public void markFailed(UUID id, Throwable error) {
        jdbcTemplate.update("""
                update public.archiveos_rpa_tasks
                set status = 'failed',
                    approval_required = true,
                    error = ?,
                    updated_at = now()
                where id = ?
                """,
                sanitize(error),
                id);
    }

    public RpaDecisionRecord recordDecision(UUID taskId, RpaDecisionRequest request) {
        ensureSchema();
        RpaTaskRecord task = get(taskId);
        if (task == null) {
            throw new IllegalArgumentException("RPA task not found: " + taskId);
        }
        validateDecision(task, request);
        String nextStatus = nextStatus(request.action());
        UUID decisionId = UUID.randomUUID();
        RpaDecisionRecord decision = jdbcTemplate.queryForObject("""
                insert into public.archiveos_rpa_decisions(
                  id, task_id, action, reason, decided_by, previous_status, next_status, metadata
                )
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                returning *
                """,
                this::mapDecisionRow,
                decisionId,
                taskId,
                request.action(),
                blankToNull(request.reason()),
                blankToNull(request.decidedBy()),
                task.status(),
                nextStatus,
                Json.write(Map.of(
                        "approval_required_before_decision", task.approvalRequired(),
                        "risk_level", task.riskLevel() == null ? "" : task.riskLevel(),
                        "recommendation", task.recommendation() == null ? "" : task.recommendation())));

        jdbcTemplate.update("""
                update public.archiveos_rpa_tasks
                set status = ?,
                    approval_required = false,
                    metadata = metadata || ?::jsonb,
                    updated_at = now()
                where id = ?
                """,
                nextStatus,
                Json.write(Map.of(
                        "latest_decision_id", decisionId.toString(),
                        "latest_decision_action", request.action(),
                        "latest_decision_at", Instant.now().toString())),
                taskId);
        return decision;
    }

    public List<RpaDecisionRecord> decisions(UUID taskId) {
        ensureSchema();
        return jdbcTemplate.query("""
                select * from public.archiveos_rpa_decisions
                where task_id = ?
                order by created_at desc
                """,
                this::mapDecisionRow,
                taskId);
    }

    private RpaTaskRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new RpaTaskRecord(
                rs.getObject("id", UUID.class),
                rs.getString("title"),
                rs.getString("description"),
                rs.getString("target_project"),
                rs.getString("requested_by"),
                rs.getString("status"),
                rs.getString("category"),
                rs.getString("risk_level"),
                rs.getString("recommendation"),
                rs.getBoolean("approval_required"),
                rs.getString("summary"),
                rs.getString("classification_source"),
                rs.getString("error"),
                Json.readObject(rs.getString("metadata")),
                readInstant(rs, "created_at"),
                readInstant(rs, "updated_at"));
    }

    private RpaDecisionRecord mapDecisionRow(ResultSet rs, int rowNum) throws SQLException {
        return new RpaDecisionRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("task_id", UUID.class),
                rs.getString("action"),
                rs.getString("reason"),
                rs.getString("decided_by"),
                rs.getString("previous_status"),
                rs.getString("next_status"),
                Json.readObject(rs.getString("metadata")),
                readInstant(rs, "created_at"));
    }

    private void validateDecision(RpaTaskRecord task, RpaDecisionRequest request) {
        if (!List.of("pm_approval_required", "hold", "failed").contains(task.status())) {
            throw new IllegalStateException("RPA task is not waiting for a PM decision.");
        }
        if ("reject".equals(request.action()) && blankToNull(request.reason()) == null) {
            throw new IllegalArgumentException("Reject reason is required.");
        }
        if ("request_retry".equals(request.action()) && "failed".equals(task.status())) {
            throw new IllegalStateException("Failed RPA tasks require a new classification request instead of automatic retry.");
        }
    }

    private String nextStatus(String action) {
        return switch (action) {
            case "approve" -> "approved";
            case "reject" -> "rejected";
            case "hold" -> "hold";
            case "request_retry" -> "queued";
            default -> throw new IllegalArgumentException("Unsupported RPA decision action: " + action);
        };
    }

    private Instant readInstant(ResultSet rs, String column) throws SQLException {
        var timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String sanitize(Throwable error) {
        if (error == null) return null;
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return message
                .replaceAll("sk-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("password=([^\\s&]+)", "password=[redacted]");
    }
}
