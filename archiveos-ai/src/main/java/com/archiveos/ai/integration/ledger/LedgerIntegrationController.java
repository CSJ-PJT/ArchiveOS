package com.archiveos.ai.integration.ledger;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LedgerIntegrationController {
    private final LedgerClient client;
    public LedgerIntegrationController(LedgerClient client) { this.client = client; }

    @GetMapping("/api/integrations/ledger/summary")
    public Map<String, Object> summary() { return envelope(client.operationsSummary()); }

    @GetMapping("/api/integrations/ledger/approval-required")
    public Map<String, Object> approvalRequired() { return envelope(client.approvalRequiredTransactions()); }

    @GetMapping("/api/integrations/ledger/reconciliation")
    public Map<String, Object> reconciliation() { return envelope(client.reconciliationSummary()); }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
