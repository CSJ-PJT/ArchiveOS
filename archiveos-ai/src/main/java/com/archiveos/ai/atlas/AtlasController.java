package com.archiveos.ai.atlas;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AtlasController {
    private final AtlasService service;
    public AtlasController(AtlasService service) { this.service = service; }

    @GetMapping("/api/atlas/overview")
    public Map<String, Object> overview() { return envelope(service.overview()); }

    @GetMapping("/api/atlas/services")
    public Map<String, Object> services() { return envelope(service.services()); }

    @GetMapping("/api/atlas/healthchecks/recent")
    public Map<String, Object> healthchecks(@RequestParam(defaultValue = "20") int limit) {
        return envelope(service.recentHealthchecks(limit));
    }

    @PostMapping("/api/atlas/healthchecks/run")
    public Map<String, Object> runHealthchecks() { return envelope(service.runHealthchecks()); }

    @GetMapping("/api/atlas/work-logs")
    public Map<String, Object> workLogs(@RequestParam(defaultValue = "20") int limit) {
        return envelope(service.workLogs(limit));
    }

    @PostMapping("/api/atlas/work-logs")
    public ResponseEntity<Map<String, Object>> createWorkLog(@RequestBody(required = false) JsonNode body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(service.createWorkLog(body)));
    }

    @ExceptionHandler(AtlasValidationException.class)
    public ResponseEntity<Map<String, Object>> validation(AtlasValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
