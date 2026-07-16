package com.archiveos.ai.ecosystem;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class EcosystemBalanceServiceTest {
    @Test void appliesConfiguredMarginsAndPreservesMissingMetricsAsNoData() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        properties.setProfitConcentrationPercent(95);
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "market", service("Archive-Market", Map.of("totalRevenue", 100, "totalCost", 70, "profit", 30)),
                "nexus", service("Archive-Nexus", Map.of()),
                "logitics", service("Archive-Logistics", Map.of("totalRevenue", 100, "totalCost", 92, "profit", 8)),
                "ledger", service("Archive-Ledger", Map.of("totalRevenue", 100, "totalCost", 95, "profit", 5)))));

        Map<String, Object> summary = new EcosystemBalanceService(ecosystem, properties).summary();
        @SuppressWarnings("unchecked") var rows = (java.util.List<Map<String, Object>>) summary.get("services");
        Map<String, Object> market = rows.stream().filter(row -> "archive-market".equals(row.get("serviceId"))).findFirst().orElseThrow();
        Map<String, Object> nexus = rows.stream().filter(row -> "archive-nexus".equals(row.get("serviceId"))).findFirst().orElseThrow();

        assertThat(market).containsEntry("targetMinMargin", java.math.BigDecimal.valueOf(8))
                .containsEntry("targetMaxMargin", java.math.BigDecimal.valueOf(18))
                .containsEntry("operatingMargin", java.math.BigDecimal.valueOf(30).setScale(2))
                .containsEntry("balance", "CONCENTRATED");
        assertThat(nexus).containsEntry("balance", "NO_DATA").containsEntry("revenue", null).containsEntry("operatingMargin", null);
        assertThat(summary).containsEntry("balanceStatus", "PARTIAL_DATA");
    }

    private Map<String, Object> service(String name, Map<String, Object> summary) {
        return Map.of("name", name, "status", "HEALTHY", "summary", summary);
    }
}
