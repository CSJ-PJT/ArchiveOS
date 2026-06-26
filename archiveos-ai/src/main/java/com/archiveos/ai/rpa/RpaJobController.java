package com.archiveos.ai.rpa;

import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RpaJobController {
    private final RpaJobService service;

    public RpaJobController(RpaJobService service) {
        this.service = service;
    }

    @PostMapping("/api/rpa/classify")
    public ResponseEntity<Map<String, Object>> classify(@Valid @RequestBody RpaTaskRequest request) {
        return ResponseEntity.ok(Map.of("data", service.createAndClassify(request)));
    }

    @GetMapping("/api/rpa/tasks/recent")
    public ResponseEntity<Map<String, Object>> recent(@RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(Map.of("data", service.recent(limit)));
    }

    @GetMapping("/api/rpa/tasks/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable UUID id) {
        Map<String, Object> detail = service.detail(id);
        if (detail == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("data", detail));
    }

    @PostMapping("/api/rpa/tasks/{id}/decision")
    public ResponseEntity<Map<String, Object>> decide(
            @PathVariable UUID id,
            @Valid @RequestBody RpaDecisionRequest request) {
        return ResponseEntity.ok(Map.of("data", service.decide(id, request)));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> badRequest(RuntimeException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }
}
