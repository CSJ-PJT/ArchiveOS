package com.archiveos.ai.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlatformController {
    private final PlatformRuntimeService runtimeService;

    public PlatformController(PlatformRuntimeService runtimeService) { this.runtimeService = runtimeService; }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> liveness() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "archiveos-backend"));
    }

    @GetMapping("/api/runtime/version")
    public ResponseEntity<Map<String, Object>> version() {
        return ResponseEntity.ok(Map.of("data", runtimeService.version()));
    }

    @GetMapping("/api/runtime/public-access")
    public ResponseEntity<Map<String, Object>> publicAccess(HttpServletRequest request) {
        return ResponseEntity.ok(Map.of("data", runtimeService.publicAccess(request)));
    }
}
