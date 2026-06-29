package com.archiveos.ai.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.EmptyResultDataAccessException;

@Service
public class WorkflowService {
    private static final Set<String> PRIORITIES = Set.of("high", "medium", "low");
    private static final Set<String> STATUSES = Set.of("queued", "architect_review", "ready_for_build", "building",
            "review", "pm_decision_required", "approved", "rejected", "hold", "failed", "done");
    private static final Set<String> ACTIONS = Set.of("approve", "reject", "hold", "retry");
    private static final Set<String> TERMINAL_STATUSES = Set.of("approved", "rejected", "failed", "done");

    private final WorkflowJdbcRepository repository;

    public WorkflowService(WorkflowJdbcRepository repository) {
        this.repository = repository;
    }

    public List<WorkflowTaskRecord> list() { return repository.list(); }
    public WorkflowTaskRecord find(UUID id) { return repository.find(id); }
    public Map<String, Object> summary() { return repository.summary(); }

    @Transactional
    public WorkflowTaskRecord create(JsonNode body) {
        requireObject(body);
        String title = requiredString(body.get("title"), "title");
        String description = requiredString(body.get("description"), "description");
        String priority = body.has("priority") ? text(body.get("priority"), "priority must be high, medium, or low.") : "medium";
        if (!PRIORITIES.contains(priority)) fail("priority must be high, medium, or low.");
        List<String> scopeFiles = optionalStringArray(body, "scope_files");
        Double maxIterations = optionalNumber(body, "max_iterations");
        BigDecimal costBudget = optionalDecimal(body, "cost_budget");
        String targetProject = body.has("target_project") && body.get("target_project").isTextual()
                ? defaultIfBlank(body.get("target_project").textValue().trim(), "DeepStake3D") : "DeepStake3D";
        CreateWorkflowTaskRequest request = new CreateWorkflowTaskRequest(title, description, priority, targetProject,
                scopeFiles, maxIterations, costBudget);
        WorkflowTaskRecord task = repository.create(request, clampIterations(maxIterations));
        repository.recordEvent(task.id(), "task_created", "Task queued", task.title() + " was added to the PM work queue.",
                "queue", Map.of("priority", task.priority(), "target_project", task.targetProject()));
        return task;
    }

    @Transactional
    public WorkflowTaskRecord update(UUID id, JsonNode body) {
        requireObject(body);
        Map<String, Object> changes = new LinkedHashMap<>();
        if (body.has("title")) changes.put("title", requiredString(body.get("title"), "title"));
        if (body.has("description")) changes.put("description", requiredString(body.get("description"), "description"));
        if (body.has("priority")) {
            String value = text(body.get("priority"), "priority must be high, medium, or low.");
            if (!PRIORITIES.contains(value)) fail("priority must be high, medium, or low.");
            changes.put("priority", value);
        }
        if (body.has("status")) {
            String value = text(body.get("status"), "status is not a valid PM task status.");
            if (!STATUSES.contains(value)) fail("status is not a valid PM task status.");
            changes.put("status", value);
        }
        if (body.has("target_project")) changes.put("target_project", requiredString(body.get("target_project"), "target_project", "target_project must be a non-empty string."));
        if (body.has("scope_files")) changes.put("scope_files", optionalStringArray(body, "scope_files"));
        if (body.has("max_iterations")) changes.put("max_iterations", clampIterations(optionalNumber(body, "max_iterations")));
        if (body.has("cost_budget")) changes.put("cost_budget", optionalDecimal(body, "cost_budget"));
        WorkflowTaskRecord task = repository.update(id, changes);
        if (task == null) throw new EmptyResultDataAccessException(1);
        return task;
    }

    @Transactional
    public Map<String, Object> decide(UUID id, JsonNode body) {
        requireObject(body);
        String action = text(body.get("action"), "action must be approve, reject, hold, or retry.");
        if (!ACTIONS.contains(action)) fail("action must be approve, reject, hold, or retry.");
        String reason = optionalReason(body);
        if ("reject".equals(action) && (reason == null || reason.isBlank())) fail("reason is required when rejecting a task.");
        if ("retry".equals(action)) return retry(id, reason);
        requiredTask(id);
        WorkflowDecisionRecord decision = repository.createDecision(id, action, reason);
        String status = switch (action) { case "approve" -> "approved"; case "reject" -> "rejected"; default -> "hold"; };
        WorkflowTaskRecord task = repository.update(id, Map.of(
                "status", status, "latest_pm_decision_id", decision.id(), "completed_at", Timestamp.from(Instant.now())));
        repository.recordEvent(id, "pm_decision_" + action, "PM decision: " + action, reason, "pm",
                Map.of("decision_id", decision.id()));
        return Map.of("task", task, "decision", decision);
    }

    @Transactional
    public Map<String, Object> retry(UUID id, String reason) {
        WorkflowTaskRecord existing = requiredTask(id);
        if (TERMINAL_STATUSES.contains(existing.status())) fail("Terminal tasks cannot be retried automatically.");
        if (existing.currentIteration() >= existing.maxIterations()) fail("Task already reached max_iterations.");
        String normalizedReason = normalize(reason);
        WorkflowDecisionRecord decision = repository.createDecision(id, "retry", normalizedReason);
        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("status", "queued");
        changes.put("latest_pm_decision_id", decision.id());
        changes.put("completed_at", null);
        WorkflowTaskRecord task = repository.update(id, changes);
        repository.recordEvent(id, "pm_decision_retry", "PM requested retry",
                normalizedReason == null ? "Retry requested." : normalizedReason, "pm", Map.of("decision_id", decision.id()));
        return Map.of("task", task, "decision", decision);
    }

    private WorkflowTaskRecord requiredTask(UUID id) {
        WorkflowTaskRecord task = repository.find(id);
        if (task == null) fail("Task not found.");
        return task;
    }

    private void requireObject(JsonNode body) {
        if (body == null || !body.isObject()) fail("Request body must be a JSON object.");
    }
    private String requiredString(JsonNode node, String name) { return requiredString(node, name, name + " is required."); }
    private String requiredString(JsonNode node, String name, String error) {
        if (node == null || !node.isTextual() || node.textValue().trim().isEmpty()) fail(error);
        return node.textValue().trim();
    }
    private String text(JsonNode node, String error) {
        if (node == null || !node.isTextual()) fail(error);
        return node.textValue();
    }
    private List<String> optionalStringArray(JsonNode body, String name) {
        JsonNode node = body.get(name);
        if (node == null || node.isNull()) return null;
        if (!node.isArray()) fail(name + " must be an array of strings or null.");
        List<String> values = new ArrayList<>();
        node.forEach(item -> {
            if (!item.isTextual()) fail(name + " must be an array of strings or null.");
            String value = item.textValue().trim();
            if (!value.isEmpty()) values.add(value);
        });
        return values;
    }
    private Double optionalNumber(JsonNode body, String name) {
        JsonNode node = body.get(name);
        if (node == null || node.isNull()) return null;
        if (!node.isNumber() || !Double.isFinite(node.doubleValue())) fail(name + " must be a finite number.");
        return node.doubleValue();
    }
    private BigDecimal optionalDecimal(JsonNode body, String name) {
        JsonNode node = body.get(name);
        if (node == null || node.isNull()) return null;
        if (!node.isNumber() || !Double.isFinite(node.doubleValue())) fail(name + " must be a finite number.");
        return node.decimalValue();
    }
    private String optionalReason(JsonNode body) {
        if (!body.has("reason") || body.get("reason").isNull()) return null;
        if (!body.get("reason").isTextual()) fail("reason must be a string or null.");
        return normalize(body.get("reason").textValue());
    }
    private int clampIterations(Double value) {
        if (value == null) return 2;
        return Math.min(Math.max((int) Math.floor(value), 1), 10);
    }
    private String normalize(String value) { return value == null || value.trim().isEmpty() ? null : value.trim(); }
    private String defaultIfBlank(String value, String fallback) { return value.isEmpty() ? fallback : value; }
    private static void fail(String message) { throw new WorkflowValidationException(message); }
}
