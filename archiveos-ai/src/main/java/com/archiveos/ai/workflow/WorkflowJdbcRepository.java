package com.archiveos.ai.workflow;

import com.archiveos.ai.obsidian.Json;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WorkflowJdbcRepository {
    private static final Set<String> UPDATABLE_FIELDS = Set.of(
            "title", "description", "priority", "status", "target_project", "scope_files",
            "max_iterations", "cost_budget", "completed_at", "latest_pm_decision_id");
    private final JdbcTemplate jdbc;

    public WorkflowJdbcRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<WorkflowTaskRecord> list() {
        return jdbc.query("select * from public.pm_tasks order by created_at desc", this::mapTask);
    }

    public WorkflowTaskRecord find(UUID id) {
        List<WorkflowTaskRecord> rows = jdbc.query("select * from public.pm_tasks where id = ?", this::mapTask, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public WorkflowTaskRecord create(CreateWorkflowTaskRequest request, int maxIterations) {
        return jdbc.queryForObject("""
                insert into public.pm_tasks(title, description, priority, target_project, scope_files, max_iterations, cost_budget, status, metadata)
                values (?, ?, ?, ?, string_to_array(?, E'\\n'), ?, ?, 'queued', ?::jsonb)
                returning *
                """, this::mapTask, request.title(), request.description(), request.priority(), request.targetProject(),
                request.scopeFiles() == null ? null : String.join("\n", request.scopeFiles()), maxIterations, request.costBudget(),
                Json.write(request.metadata() == null ? Map.of("source", "pm_queue") : request.metadata()));
    }

    public WorkflowTaskRecord update(UUID id, Map<String, Object> changes) {
        if (changes.isEmpty()) return find(id);
        List<String> assignments = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        changes.forEach((field, value) -> {
            if (!UPDATABLE_FIELDS.contains(field)) {
                throw new IllegalArgumentException("Unsupported PM task field: " + field);
            }
            if ("scope_files".equals(field)) {
                assignments.add("scope_files = string_to_array(?, E'\\n')");
                values.add(value == null ? null : String.join("\n", castStrings(value)));
            } else {
                assignments.add(field + " = ?");
                values.add(value);
            }
        });
        assignments.add("updated_at = now()");
        values.add(id);
        return jdbc.queryForObject("update public.pm_tasks set " + String.join(", ", assignments) + " where id = ? returning *",
                this::mapTask, values.toArray());
    }

    public WorkflowDecisionRecord createDecision(UUID taskId, String action, String reason) {
        return jdbc.queryForObject("""
                insert into public.pm_task_decisions(task_id, action, reason) values (?, ?, ?) returning *
                """, this::mapDecision, taskId, action, reason);
    }

    public void recordEvent(UUID taskId, String eventType, String title, String description, String source, Map<String, Object> metadata) {
        jdbc.update("""
                insert into public.pm_task_events(task_id, event_type, title, description, source, metadata)
                values (?, ?, ?, ?, ?, ?::jsonb)
                """, taskId, eventType, title, description, source, Json.write(metadata));
    }

    public void upsertContract(WorkflowTaskRecord task, Map<String, Object> execution, Map<String, Object> approval,
                               Object evidence, Map<String, Object> result) {
        String correlationId = text(task.metadata(), "correlation_id", task.id().toString());
        String projectId = text(task.metadata(), "project_id", task.targetProject());
        Map<String, Object> workflow = new LinkedHashMap<>();
        workflow.put("id", task.id().toString());
        workflow.put("type", "pm_task");
        workflow.put("name", task.title());
        workflow.put("version", "1.0.0");
        workflow.put("status", task.status());
        jdbc.update("""
                insert into public.workflow_contracts(correlation_id, project_id, workflow, execution, approval, evidence, result)
                values (?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb)
                on conflict (correlation_id, project_id) do update set
                    workflow = excluded.workflow,
                    execution = coalesce(excluded.execution, workflow_contracts.execution),
                    approval = coalesce(excluded.approval, workflow_contracts.approval),
                    evidence = excluded.evidence,
                    result = coalesce(excluded.result, workflow_contracts.result),
                    updated_at = now()
                """, correlationId, projectId, Json.write(workflow), jsonOrNull(execution), jsonOrNull(approval),
                Json.write(evidence == null ? List.of() : evidence), jsonOrNull(result));
    }

    public WorkflowTaskRecord applyCallback(UUID id, String status, Map<String, Object> metadata) {
        return jdbc.queryForObject("""
                update public.pm_tasks
                   set status = ?,
                       completed_at = now(),
                       updated_at = now(),
                       metadata = metadata || ?::jsonb
                 where id = ?
                 returning *
                """, this::mapTask, status, Json.write(metadata), id);
    }

    public List<Map<String, Object>> events(UUID taskId) {
        return jdbc.queryForList("""
                select id, task_id, event_type, title, description, source, metadata, created_at
                  from public.pm_task_events
                 where task_id = ?
                 order by created_at asc
                """, taskId);
    }

    public List<Map<String, Object>> contracts(int limit) {
        return jdbc.queryForList("""
                select id, correlation_id, project_id, workflow, execution, approval, evidence, result, created_at, updated_at
                  from public.workflow_contracts
                 order by updated_at desc
                 limit ?
                """, Math.max(1, Math.min(limit, 100)));
    }

    public Map<String, Object> contract(String correlationId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, correlation_id, project_id, workflow, execution, approval, evidence, result, created_at, updated_at
                  from public.workflow_contracts
                 where correlation_id = ?
                 order by updated_at desc
                 limit 1
                """, correlationId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> summary() {
        List<WorkflowTaskRecord> tasks = list();
        String today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString();
        WorkflowTaskRecord current = tasks.stream().filter(task -> List.of("architect_review","ready_for_build","building","review","queued").contains(task.status()))
                .sorted(java.util.Comparator.comparingInt((WorkflowTaskRecord task) -> priorityWeight(task.priority())).thenComparing(WorkflowTaskRecord::createdAt))
                .findFirst().orElse(null);
        long pending = tasks.stream().filter(task -> "pm_decision_required".equals(task.status())).count();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("queued", count(tasks, "queued"));
        out.put("in_progress", tasks.stream().filter(task -> List.of("architect_review","ready_for_build","building","review").contains(task.status())).count());
        out.put("pm_decision_required", pending);
        out.put("done_today", tasks.stream().filter(task -> List.of("done","approved").contains(task.status()) && startsOn(task.completedAt(), today)).count());
        out.put("failed_today", tasks.stream().filter(task -> "failed".equals(task.status()) && startsOn(task.completedAt(), today)).count());
        out.put("current_task", current == null ? null : Map.of("id", current.id(), "title", current.title(), "priority", current.priority(), "status", current.status(), "current_iteration", current.currentIteration(), "max_iterations", current.maxIterations()));
        out.put("recommended_pm_action", pending > 0 ? pending + " task(s) require PM approval, rejection, hold, or retry." : tasks.stream().anyMatch(task -> "queued".equals(task.status())) ? "Run queue once to generate Architect/Builder/Reviewer records." : "No PM action required.");
        out.put("updated_at", Instant.now().toString());
        return out;
    }

    private long count(List<WorkflowTaskRecord> tasks, String status) { return tasks.stream().filter(task -> status.equals(task.status())).count(); }
    private boolean startsOn(Instant value, String day) { return value != null && value.toString().startsWith(day); }
    private int priorityWeight(String priority) { return "high".equals(priority) ? 0 : "medium".equals(priority) ? 1 : 2; }
    private String jsonOrNull(Map<String, Object> value) { return value == null ? null : Json.write(value); }
    private String text(Map<String, Object> metadata, String key, String fallback) {
        Object value = metadata == null ? null : metadata.get(key);
        return value instanceof String text && !text.isBlank() ? text : fallback;
    }

    private WorkflowTaskRecord mapTask(ResultSet rs, int row) throws SQLException {
        Array array = rs.getArray("scope_files");
        List<String> scope = array == null ? null : Arrays.asList((String[]) array.getArray());
        return new WorkflowTaskRecord(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("description"),
                rs.getString("priority"), rs.getString("status"), rs.getString("target_project"), scope,
                rs.getInt("max_iterations"), rs.getInt("current_iteration"), rs.getBigDecimal("cost_budget"),
                instant(rs, "created_at"), instant(rs, "updated_at"), instant(rs, "completed_at"),
                uuid(rs, "latest_architect_review_id"), uuid(rs, "latest_builder_result_id"), uuid(rs, "latest_reviewer_result_id"),
                uuid(rs, "latest_pm_decision_id"), Json.readObject(rs.getString("metadata")));
    }

    private WorkflowDecisionRecord mapDecision(ResultSet rs, int row) throws SQLException {
        return new WorkflowDecisionRecord(rs.getObject("id", UUID.class), rs.getObject("task_id", UUID.class),
                rs.getString("action"), rs.getString("reason"), instant(rs, "created_at"));
    }
    private Instant instant(ResultSet rs, String column) throws SQLException { Timestamp value = rs.getTimestamp(column); return value == null ? null : value.toInstant(); }
    private UUID uuid(ResultSet rs, String column) throws SQLException { return rs.getObject(column, UUID.class); }
    @SuppressWarnings("unchecked") private List<String> castStrings(Object value) { return (List<String>) value; }
}
