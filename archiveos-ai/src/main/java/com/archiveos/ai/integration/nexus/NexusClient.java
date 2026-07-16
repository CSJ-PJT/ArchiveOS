package com.archiveos.ai.integration.nexus;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceClient;
import com.archiveos.ai.ecosystem.EcosystemServiceStatus;
import com.archiveos.ai.ecosystem.IntegrationResult;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class NexusClient {
    private final EcosystemProperties properties;
    private final EcosystemServiceClient client;

    public NexusClient(EcosystemProperties properties, EcosystemServiceClient client) {
        this.properties = properties;
        this.client = client;
    }

    public IntegrationResult health() { return get(config().getHealthPath()); }
    public IntegrationResult outboxSummary() { return get(config().getSummaryPath()); }
    public IntegrationResult operationsSummary() { return get(config().getOperationsSummaryPath()); }
    public IntegrationResult outboxEvents() { return get("/api/outbox/events"); }
    public IntegrationResult workforceSummary() { return get(config().getWorkforceSummaryPath()); }
    public IntegrationResult productivitySummary() { return get(config().getProductivitySummaryPath()); }
    public IntegrationResult capacitySummary() { return get(config().getCapacitySummaryPath()); }
    public IntegrationResult generateEvents(int count) {
        if (!properties.getIntegration().isAllowExternalWrite()) return blocked("DRY_RUN", count);
        return client.post(config().getBaseUrl(), "/api/outbox/events/generate?count=" + Math.max(1, Math.min(count, 1000)), Map.of(), timeout());
    }
    public IntegrationResult publishOutbox() {
        if (!properties.getIntegration().isAllowExternalWrite()) return blocked("SAFE_MODE_BLOCKED", 0);
        return client.post(config().getBaseUrl(), "/api/outbox/events/publish", Map.of(), timeout());
    }
    public EcosystemProperties.ServiceConfig config() { return properties.getEcosystem().getServices().get("nexus"); }
    private IntegrationResult get(String path) { return client.get(config().getBaseUrl(), path, timeout()); }
    private IntegrationResult blocked(String reason, int count) {
        return new IntegrationResult(EcosystemServiceStatus.DEGRADED, null,
                Map.of("blocked", true, "reason", reason, "requestedCount", count), reason, 0);
    }
    private int timeout() { return properties.getEcosystem().getRefreshTimeoutMs(); }
}
