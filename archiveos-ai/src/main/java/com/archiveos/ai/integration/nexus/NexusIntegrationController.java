package com.archiveos.ai.integration.nexus;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class NexusIntegrationController {
    private final NexusClient client;
    public NexusIntegrationController(NexusClient client) { this.client = client; }

    @GetMapping("/api/integrations/nexus/outbox")
    public Map<String, Object> outbox() { return envelope(client.outboxSummary()); }

    @GetMapping("/api/integrations/nexus/events")
    public Map<String, Object> events() { return envelope(client.outboxEvents()); }

    @PostMapping("/api/integrations/nexus/outbox/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "100") int count) { return envelope(client.generateEvents(count)); }

    @PostMapping("/api/integrations/nexus/outbox/publish")
    public Map<String, Object> publish() { return envelope(client.publishOutbox()); }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
