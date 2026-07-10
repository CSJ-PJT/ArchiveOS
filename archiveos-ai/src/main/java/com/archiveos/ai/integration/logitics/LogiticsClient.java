package com.archiveos.ai.integration.logitics;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceClient;
import com.archiveos.ai.ecosystem.EcosystemServiceStatus;
import com.archiveos.ai.ecosystem.IntegrationResult;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class LogiticsClient {
    private final EcosystemProperties properties;
    private final EcosystemServiceClient client;

    public LogiticsClient(EcosystemProperties properties, EcosystemServiceClient client) {
        this.properties = properties;
        this.client = client;
    }

    public IntegrationResult health() { return get(config().getHealthPath()); }
    public IntegrationResult operationsSummary() { return get(config().getSummaryPath()); }
    public IntegrationResult outboxSummary() { return get(config().getOutboxSummaryPath()); }
    public IntegrationResult routesSummary() { return get(config().getRouteSummaryPath()); }
    public IntegrationResult workforceSummary() { return get(config().getWorkforceSummaryPath()); }
    public IntegrationResult productivitySummary() { return get(config().getProductivitySummaryPath()); }
    public IntegrationResult capacitySummary() { return get(config().getCapacitySummaryPath()); }
    public IntegrationResult publishOutbox() {
        if (!properties.getIntegration().isAllowExternalWrite()) {
            return new IntegrationResult(EcosystemServiceStatus.DEGRADED, null, Map.of("blocked", true, "reason", "SAFE_MODE_BLOCKED"), "SAFE_MODE_BLOCKED", 0);
        }
        return client.post(config().getBaseUrl(), "/api/outbox/publish", Map.of(), timeout());
    }
    public EcosystemProperties.ServiceConfig config() { return properties.getEcosystem().getServices().get("logitics"); }
    private IntegrationResult get(String path) { return client.get(config().getBaseUrl(), path, timeout()); }
    private int timeout() { return properties.getEcosystem().getRefreshTimeoutMs(); }
}
