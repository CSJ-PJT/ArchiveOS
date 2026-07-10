package com.archiveos.ai.integration.market;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceClient;
import com.archiveos.ai.ecosystem.IntegrationResult;
import org.springframework.stereotype.Component;

@Component
public class MarketClient {
    private final EcosystemProperties properties;
    private final EcosystemServiceClient client;

    public MarketClient(EcosystemProperties properties, EcosystemServiceClient client) {
        this.properties = properties;
        this.client = client;
    }

    public IntegrationResult health() { return get(config().getHealthPath()); }
    public IntegrationResult operationsSummary() { return get(config().getSummaryPath()); }
    public IntegrationResult marketEconomySummary() { return get(config().getMarketEconomyPath()); }
    public IntegrationResult outboxSummary() { return get(config().getOutboxSummaryPath()); }
    public IntegrationResult orders() { return get(config().getOrdersPath()); }
    public IntegrationResult claims() { return get(config().getClaimsPath()); }
    public IntegrationResult returns() { return get(config().getReturnsPath()); }
    public IntegrationResult workforceSummary() { return get(config().getWorkforceSummaryPath()); }
    public IntegrationResult cashflowSummary() { return get(config().getCashflowSummaryPath()); }
    public IntegrationResult productivitySummary() { return get(config().getProductivitySummaryPath()); }
    public IntegrationResult capacitySummary() { return get(config().getCapacitySummaryPath()); }

    public EcosystemProperties.ServiceConfig config() {
        return properties.getEcosystem().getServices().get("market");
    }

    private IntegrationResult get(String path) {
        return client.get(config().getBaseUrl(), path, properties.getEcosystem().getRefreshTimeoutMs());
    }
}
