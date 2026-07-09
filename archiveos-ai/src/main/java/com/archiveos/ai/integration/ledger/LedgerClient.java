package com.archiveos.ai.integration.ledger;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceClient;
import com.archiveos.ai.ecosystem.IntegrationResult;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class LedgerClient {
    private final EcosystemProperties properties;
    private final EcosystemServiceClient client;

    public LedgerClient(EcosystemProperties properties, EcosystemServiceClient client) {
        this.properties = properties;
        this.client = client;
    }

    public IntegrationResult health() { return get(config().getHealthPath()); }
    public IntegrationResult operationsSummary() { return get(config().getSummaryPath()); }
    public IntegrationResult approvalRequiredTransactions() { return get(config().getApprovalRequiredPath()); }
    public IntegrationResult reconciliationSummary() { return get(config().getReconciliationSummaryPath()); }
    public IntegrationResult approvalCallback(Map<String, Object> payload) { return client.post(config().getBaseUrl(), config().getApprovalCallbackPath(), payload, timeout()); }
    public IntegrationResult settlementGamePreset() { return get("/api/game/settlement-agency/preset"); }
    public IntegrationResult settlementGameSimulate(Map<String, Object> payload) { return client.post(config().getBaseUrl(), "/api/game/settlement-agency/simulate", payload, timeout()); }
    public EcosystemProperties.ServiceConfig config() { return properties.getEcosystem().getServices().get("ledger"); }
    private IntegrationResult get(String path) { return client.get(config().getBaseUrl(), path, timeout()); }
    private int timeout() { return properties.getEcosystem().getRefreshTimeoutMs(); }
}
