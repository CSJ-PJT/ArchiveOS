package com.archiveos.ai.architect;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ArchitectController {
    private final ArchitectService service;
    public ArchitectController(ArchitectService service) { this.service = service; }
    @PostMapping("/api/architect/review")
    public ResponseEntity<Map<String, Object>> review(@RequestBody(required = false) JsonNode body) {
        try { return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", service.review(body))); }
        catch (ArchitectValidationException error) { return ResponseEntity.badRequest().body(Map.of("error", error.getMessage())); }
        catch (DataAccessException error) { return ResponseEntity.status(500).body(Map.of("error", "Failed to record architecture review.")); }
    }
    @GetMapping("/api/architect/reviews/recent")
    public ResponseEntity<Map<String, Object>> recent(@RequestParam(defaultValue = "20") int limit) {
        try { return ResponseEntity.ok(Map.of("data", service.recent(limit))); }
        catch (DataAccessException error) { return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch architecture reviews.")); }
    }
    @GetMapping("/api/architect/reviews/latest")
    public ResponseEntity<Map<String, Object>> latest() {
        try { var out = new java.util.LinkedHashMap<String, Object>(); out.put("data", service.latest()); return ResponseEntity.ok(out); }
        catch (DataAccessException error) { return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch latest architecture review.")); }
    }
}
