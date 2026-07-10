package com.archiveos.ai.workforce;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.archiveos.ai.ecosystem.EcosystemServiceStatus;
import com.archiveos.ai.ecosystem.IntegrationResult;
import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.logitics.LogiticsClient;
import com.archiveos.ai.integration.market.MarketClient;
import com.archiveos.ai.integration.nexus.NexusClient;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkforceServiceTest {
    @Mock MarketClient market;
    @Mock NexusClient nexus;
    @Mock LogiticsClient logitics;
    @Mock LedgerClient ledger;

    @Test
    void overviewAggregatesSyntheticWorkforceSummaries() {
        mockMarket();
        mockNexus();
        mockLogistics();
        mockLedger();

        WorkforceService service = new WorkforceService(market, nexus, logitics, ledger);

        Map<String, Object> overview = service.overview();
        Map<String, Object> summary = map(overview.get("summary"));
        List<Map<String, Object>> services = list(overview.get("services"));
        List<Map<String, Object>> recommendations = list(overview.get("recommendations"));

        assertThat(summary.get("totalHeadcount")).isEqualTo(34);
        assertThat(summary.get("totalBacklog")).isEqualTo(73);
        assertThat(summary.get("largestBottleneck")).isEqualTo("approval-reconciliation");
        assertThat(services).hasSize(4);
        assertThat(recommendations).hasSize(4);
        assertThat(overview.get("dataPolicy")).asString().contains("No real employee");
    }

    @Test
    void unavailableExternalSummaryDoesNotBreakOverview() {
        IntegrationResult unavailable = new IntegrationResult(EcosystemServiceStatus.UNAVAILABLE, null, Map.of(), "Connection refused", 3);
        when(market.workforceSummary()).thenReturn(unavailable);
        when(market.productivitySummary()).thenReturn(unavailable);
        when(market.capacitySummary()).thenReturn(unavailable);
        when(market.cashflowSummary()).thenReturn(unavailable);
        when(nexus.workforceSummary()).thenReturn(unavailable);
        when(nexus.productivitySummary()).thenReturn(unavailable);
        when(nexus.capacitySummary()).thenReturn(unavailable);
        when(logitics.workforceSummary()).thenReturn(unavailable);
        when(logitics.productivitySummary()).thenReturn(unavailable);
        when(logitics.capacitySummary()).thenReturn(unavailable);
        when(ledger.workforceSummary()).thenReturn(unavailable);
        when(ledger.productivitySummary()).thenReturn(unavailable);
        when(ledger.capacitySummary()).thenReturn(unavailable);

        WorkforceService service = new WorkforceService(market, nexus, logitics, ledger);

        List<Map<String, Object>> services = list(service.overview().get("services"));

        assertThat(services).hasSize(4);
        assertThat(services).allMatch(row -> "UNAVAILABLE".equals(row.get("status")));
    }

    private void mockMarket() {
        when(market.workforceSummary()).thenReturn(ok(Map.of("headcount", 8, "payrollCost", 1_200_000)));
        when(market.productivitySummary()).thenReturn(ok(Map.of("productivityScore", 78, "backlog", 12, "bottleneckRole", "order-review")));
        when(market.capacitySummary()).thenReturn(ok(Map.of("effectiveCapacity", 100, "usedCapacity", 92)));
        when(market.cashflowSummary()).thenReturn(ok(Map.of("payrollCost", 1_200_000)));
    }

    private void mockNexus() {
        when(nexus.workforceSummary()).thenReturn(ok(Map.of("headcount", 12, "payrollCost", 2_500_000)));
        when(nexus.productivitySummary()).thenReturn(ok(Map.of("productivityScore", 84, "backlog", 10, "bottleneckRole", "production-quality")));
        when(nexus.capacitySummary()).thenReturn(ok(Map.of("effectiveCapacity", 180, "usedCapacity", 170)));
    }

    private void mockLogistics() {
        when(logitics.workforceSummary()).thenReturn(ok(Map.of("headcount", 9, "payrollCost", 1_800_000)));
        when(logitics.productivitySummary()).thenReturn(ok(Map.of("productivityScore", 70, "backlog", 21, "bottleneckRole", "dispatch-delay-response")));
        when(logitics.capacitySummary()).thenReturn(ok(Map.of("effectiveCapacity", 120, "usedCapacity", 130)));
    }

    private void mockLedger() {
        when(ledger.workforceSummary()).thenReturn(ok(Map.of("headcount", 5, "payrollCost", 1_100_000)));
        when(ledger.productivitySummary()).thenReturn(ok(Map.of("productivityScore", 68, "backlog", 30, "bottleneckRole", "approval-reconciliation")));
        when(ledger.capacitySummary()).thenReturn(ok(Map.of("effectiveCapacity", 80, "usedCapacity", 86)));
    }

    private IntegrationResult ok(Map<String, Object> body) {
        return new IntegrationResult(EcosystemServiceStatus.HEALTHY, 200, body, null, 12);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> list(Object value) {
        return (List<Map<String, Object>>) value;
    }
}
