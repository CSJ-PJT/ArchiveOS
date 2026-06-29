package com.archiveos.ai.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WorkflowController {
    private final WorkflowService service;

    public WorkflowController(WorkflowService service) { this.service = service; }

    @GetMapping("/tasks")
    public Map<String, Object> list() {
        try { return Map.of("data", service.list()); }
        catch (DataAccessException error) {
            return Map.of("data", java.util.List.of(), "warning", "PM task queue is not available yet. Apply queue schema or check Supabase connectivity.");
        }
    }

    @GetMapping("/tasks/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable UUID id) {
        try {
            WorkflowTaskRecord task = service.find(id);
            return task == null ? ResponseEntity.status(404).body(Map.of("error", "PM task not found."))
                    : ResponseEntity.ok(Map.of("data", task));
        } catch (DataAccessException error) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch PM task."));
        }
    }

    @PostMapping("/tasks")
    public ResponseEntity<Map<String, Object>> create(@RequestBody(required = false) JsonNode body) {
        try { return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", service.create(body))); }
        catch (WorkflowValidationException error) { return badRequest(error); }
        catch (DataAccessException error) { return ResponseEntity.status(500).body(Map.of("error", "Failed to create PM task.")); }
    }

    @PatchMapping("/tasks/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable UUID id, @RequestBody(required = false) JsonNode body) {
        try { return ResponseEntity.ok(Map.of("data", service.update(id, body))); }
        catch (WorkflowValidationException error) { return badRequest(error); }
        catch (DataAccessException error) { return ResponseEntity.status(500).body(Map.of("error", "Failed to update PM task.")); }
    }

    @PostMapping("/tasks/{id}/decision")
    public ResponseEntity<Map<String, Object>> decide(@PathVariable UUID id, @RequestBody(required = false) JsonNode body) {
        try { return ResponseEntity.ok(Map.of("data", service.decide(id, body))); }
        catch (WorkflowValidationException error) { return badRequest(error); }
        catch (DataAccessException error) { return ResponseEntity.badRequest().body(Map.of("error", error.getMessage())); }
    }

    @PostMapping("/tasks/{id}/retry")
    public ResponseEntity<Map<String, Object>> retry(@PathVariable UUID id, @RequestBody(required = false) JsonNode body) {
        try {
            String reason = body != null && body.isObject() && body.has("reason") && body.get("reason").isTextual()
                    ? body.get("reason").textValue() : null;
            return ResponseEntity.ok(Map.of("data", service.retry(id, reason)));
        } catch (WorkflowValidationException error) { return badRequest(error); }
        catch (DataAccessException error) { return ResponseEntity.badRequest().body(Map.of("error", error.getMessage())); }
    }

    @GetMapping("/queue/summary")
    public Map<String, Object> summary() {
        try { return Map.of("data", service.summary()); }
        catch (DataAccessException error) { return Map.of("data", emptySummary()); }
    }

    private ResponseEntity<Map<String, Object>> badRequest(WorkflowValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }
    private Map<String, Object> emptySummary() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("queued", 0); data.put("in_progress", 0); data.put("pm_decision_required", 0);
        data.put("done_today", 0); data.put("failed_today", 0); data.put("current_task", null);
        data.put("recommended_pm_action", "PM queue summary is not available yet. Apply queue schema or check Supabase connectivity.");
        data.put("updated_at", Instant.now().toString());
        return data;
    }
}
