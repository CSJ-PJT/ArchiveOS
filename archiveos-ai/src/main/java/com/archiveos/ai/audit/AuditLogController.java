package com.archiveos.ai.audit;

import java.util.Map;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditLogController {
    private final AuditLogService audit;
    public AuditLogController(AuditLogService audit) { this.audit = audit; }
    @GetMapping("/logs") public Map<String, Object> logs(@RequestParam(defaultValue = "50") int limit) { return Map.of("data", audit.recent(limit)); }
    @GetMapping("/summary") public Map<String, Object> summary() { return Map.of("data", audit.summary()); }

    @PostMapping("/compatibility")
    public Map<String, Object> compatibility(@RequestBody JsonNode body) {
        audit.record(text(body, "method", "POST"), text(body, "path", "/api/compatibility"),
                body.path("status").asInt(200), text(body, "correlationId", null),
                body.get("oldValue"), body.get("newValue"));
        return Map.of("data", Map.of("recorded", true));
    }

    private String text(JsonNode body, String name, String fallback) {
        JsonNode value = body.get(name);
        return value != null && value.isTextual() ? value.textValue() : fallback;
    }
}
