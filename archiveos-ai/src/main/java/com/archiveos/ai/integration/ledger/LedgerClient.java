package com.archiveos.ai.integration.ledger;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceClient;
import com.archiveos.ai.ecosystem.IntegrationResult;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LedgerClient {
    private final EcosystemProperties properties;
    private final EcosystemServiceClient client;
    private final String approvalCallbackToken;

    public LedgerClient(EcosystemProperties properties, EcosystemServiceClient client,
                        @Value("${archiveos.ledger.callback-token:}") String approvalCallbackToken) {
        this.properties = properties;
        this.client = client;
        this.approvalCallbackToken = approvalCallbackToken == null ? "" : approvalCallbackToken;
    }

    public IntegrationResult health() { return get(config().getHealthPath()); }
    public IntegrationResult operationsSummary() { return get(config().getSummaryPath()); }
    public IntegrationResult approvalRequiredTransactions() { return get(config().getApprovalRequiredPath()); }
    public IntegrationResult reconciliationSummary() { return get(config().getReconciliationSummaryPath()); }
    public IntegrationResult approvalCallback(Map<String, Object> payload) {
        return client.postAuthorized(config().getBaseUrl(), config().getApprovalCallbackPath(), payload, timeout(),
                approvalCallbackToken, "ledger:approval-callback");
    }
    public IntegrationResult settlementGamePreset() { return get("/api/game/settlement-agency/preset"); }
    public IntegrationResult settlementGameSimulate(Map<String, Object> payload) { return client.post(config().getBaseUrl(), "/api/game/settlement-agency/simulate", payload, timeout()); }
    public IntegrationResult workforceSummary() { return get(config().getWorkforceSummaryPath()); }
    public IntegrationResult productivitySummary() { return get(config().getProductivitySummaryPath()); }
    public IntegrationResult capacitySummary() { return get(config().getCapacitySummaryPath()); }
    public EcosystemProperties.ServiceConfig config() { return properties.getEcosystem().getServices().get("ledger"); }
    private IntegrationResult get(String path) { return client.get(config().getBaseUrl(), path, timeout()); }
    private int timeout() {
        int serviceTimeout = config().getRequestTimeoutMs();
        return serviceTimeout > 0 ? serviceTimeout : properties.getEcosystem().getRefreshTimeoutMs();
    }
}
