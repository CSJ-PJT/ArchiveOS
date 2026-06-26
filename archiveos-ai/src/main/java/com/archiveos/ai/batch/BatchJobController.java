package com.archiveos.ai.batch;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BatchJobController {
    private final BatchJobService service;

    public BatchJobController(BatchJobService service) {
        this.service = service;
    }

    @GetMapping("/api/batch/jobs")
    public ResponseEntity<Map<String, Object>> jobs() {
        return ResponseEntity.ok(Map.of("data", service.jobs()));
    }

    @PostMapping("/api/batch/jobs/{jobName}/run")
    public ResponseEntity<Map<String, Object>> run(@PathVariable String jobName) {
        return ResponseEntity.ok(Map.of("data", service.run(jobName)));
    }

    @GetMapping("/api/batch/executions")
    public ResponseEntity<Map<String, Object>> executions(@RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(Map.of("data", service.executions(limit)));
    }

    @GetMapping("/api/batch/executions/{id}")
    public ResponseEntity<Map<String, Object>> execution(@PathVariable long id) {
        Map<String, Object> execution = service.execution(id);
        if (execution == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("data", execution));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> badRequest(RuntimeException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }
}
