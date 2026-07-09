package com.archiveos.ai.integration.logitics;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LogiticsIntegrationController {
    private final LogiticsClient client;
    public LogiticsIntegrationController(LogiticsClient client) { this.client = client; }

    @GetMapping("/api/integrations/logitics/summary")
    public Map<String, Object> summary() { return envelope(client.operationsSummary()); }

    @GetMapping("/api/integrations/logitics/outbox")
    public Map<String, Object> outbox() { return envelope(client.outboxSummary()); }

    @GetMapping("/api/integrations/logitics/routes")
    public Map<String, Object> routes() { return envelope(client.routesSummary()); }

    @PostMapping("/api/integrations/logitics/outbox/publish")
    public Map<String, Object> publish() { return envelope(client.publishOutbox()); }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
