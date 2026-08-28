package com.archiveos.ai.audit;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit/usage")
public class UsageAuditController {
    private final UsageAuditService usage;

    public UsageAuditController(UsageAuditService usage) {
        this.usage = usage;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> record(@RequestBody(required = false) UsageRequest body,
                                                       HttpServletRequest request) {
        try {
            UsageAuditService.RecordResult result = usage.recordPageView(body == null ? null : body.route(), request);
            return ResponseEntity.accepted().body(Map.of("data", result));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping
    public Map<String, Object> recent(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "25") int size) {
        return Map.of("data", usage.recent(page, size));
    }

    @PostMapping("/atlas-report")
    public ResponseEntity<Map<String, Object>> importAtlasReport(@RequestBody(required = false) Map<String, Object> body) {
        try {
            return ResponseEntity.accepted().body(Map.of("data", usage.importAtlasReport(body)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    public record UsageRequest(String route) { }
}
