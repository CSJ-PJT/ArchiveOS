package com.archiveos.ai.integration.market;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MarketIntegrationController {
    private final MarketClient client;

    public MarketIntegrationController(MarketClient client) {
        this.client = client;
    }

    @GetMapping("/api/integrations/market/summary")
    public Map<String, Object> summary() { return envelope(client.operationsSummary()); }

    @GetMapping("/api/integrations/market/economy")
    public Map<String, Object> economy() { return envelope(client.marketEconomySummary()); }

    @GetMapping("/api/integrations/market/outbox")
    public Map<String, Object> outbox() { return envelope(client.outboxSummary()); }

    @GetMapping("/api/integrations/market/orders")
    public Map<String, Object> orders() { return envelope(client.orders()); }

    @GetMapping("/api/integrations/market/claims")
    public Map<String, Object> claims() { return envelope(client.claims()); }

    @GetMapping("/api/integrations/market/returns")
    public Map<String, Object> returns() { return envelope(client.returns()); }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
