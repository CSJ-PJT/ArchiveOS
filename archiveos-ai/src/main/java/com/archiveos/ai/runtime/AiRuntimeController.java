package com.archiveos.ai.runtime;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiRuntimeController {
    private final AiRuntimeService service;

    public AiRuntimeController(AiRuntimeService service) {
        this.service = service;
    }

    @GetMapping("/api/ai/runtime")
    public ResponseEntity<Map<String, Object>> runtime() {
        return ResponseEntity.ok(service.runtime());
    }

    @PostMapping("/api/ai/runtime/check")
    public ResponseEntity<Map<String, Object>> check() {
        return service.check();
    }
}
