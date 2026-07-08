package com.archiveos.ai.contract;

import com.archiveos.ai.workflow.WorkflowService;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/contracts/workflow")
public class WorkflowContractController {
    private final WorkflowService workflows;

    public WorkflowContractController(WorkflowService workflows) {
        this.workflows = workflows;
    }

    @GetMapping("/schema")
    public Map<String, Object> schema() {
        return Map.of("data", Map.of(
                "name", "ArchiveOS Workflow Contract",
                "version", "1.0.0",
                "required", List.of("workflow", "execution", "approval", "evidence", "result", "correlationId", "projectId"),
                "correlationId", "Cross-service trace identifier shared with Archive-Nexus.",
                "projectId", "Stable project identifier shared with Archive-Nexus."));
    }

    @GetMapping
    public Map<String, Object> recent(@RequestParam(defaultValue = "20") int limit) {
        return Map.of("data", workflows.contracts(limit));
    }

    @GetMapping("/{correlationId}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable String correlationId) {
        try {
            return ResponseEntity.ok(Map.of("data", workflows.contract(correlationId)));
        } catch (RuntimeException error) {
            return ResponseEntity.status(404).body(Map.of("error", error.getMessage()));
        }
    }
}
