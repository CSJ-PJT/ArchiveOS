package com.archiveos.ai.activity;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ActivityController {
    private final ActivityService service;
    public ActivityController(ActivityService service) { this.service = service; }

    @GetMapping("/api/work-logs/recent") public Map<String, Object> workLogs() { return Map.of("data", service.recentWorkLogs()); }
    @PostMapping("/api/work-logs") public ResponseEntity<Map<String, Object>> createWorkLog(@RequestBody(required = false) JsonNode body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", service.createWorkLog(body)));
    }
    @GetMapping("/api/commands/recent") public Map<String, Object> commands() { return Map.of("data", service.recentCommands()); }
    @PostMapping("/api/commands") public ResponseEntity<Map<String, Object>> createCommand(@RequestBody(required = false) JsonNode body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", service.createCommand(body)));
    }

    @ExceptionHandler(ActivityValidationException.class)
    public ResponseEntity<Map<String, Object>> validation(ActivityValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }
}
