package com.archiveos.ai.ecosystem;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class EcosystemBalanceServiceTest {
    @Test
    void appliesConfiguredMarginsAndPreservesMissingMetricsAsNoData() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        properties.setProfitConcentrationPercent(95);
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "market", service("Archive-Market", Map.of("economy", current24(
                        "ROLLING_24H_RECOGNIZED_EVENTS", "dataAvailable",
                        Map.of("recognizedRevenue", 100, "totalExpense", 70, "operatingProfit", 999)))),
                "nexus", service("Archive-Nexus", Map.of()),
                "logitics", service("Archive-Logistics", Map.of("economy", current24(
                        "ROLLING_24H_RECOGNIZED_LOGISTICS_EVENTS", "dataAvailable",
                        Map.of("recognizedRevenue", 100, "realizedOperatingCost", 92, "operatingProfit", 999)))),
                "ledger", service("Archive-Ledger", Map.of("balance", currentWorkday(
                        Map.of("recognizedRevenue", 100, "realizedOperatingCost", 95, "operatingProfit", 999)))))));

        Map<String, Object> summary = new EcosystemBalanceService(ecosystem, properties).summary();
        Map<String, Object> market = row(rows(summary), "archive-market");
        Map<String, Object> nexus = row(rows(summary), "archive-nexus");

        assertThat(market).containsEntry("targetMinMargin", BigDecimal.valueOf(8))
                .containsEntry("targetMaxMargin", BigDecimal.valueOf(18))
                .containsEntry("profit", BigDecimal.valueOf(30))
                .containsEntry("operatingMargin", BigDecimal.valueOf(30).setScale(2))
                .containsEntry("balance", "CONCENTRATED")
                .containsEntry("includedInTotals", true);
        assertThat(nexus).containsEntry("balance", "NO_DATA")
                .containsEntry("revenue", null)
                .containsEntry("operatingMargin", null)
                .containsEntry("includedInTotals", false);
        assertThat(summary).containsEntry("balanceStatus", "PARTIAL_DATA");
        assertThat(totals(summary)).containsEntry("includedServices", 3L);
    }

    @Test
    void treatsZeroRevenueWithCurrentCostAsPressureInsteadOfMissingData() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "market", service("Archive-Market", Map.of()),
                "nexus", service("Archive-Nexus", Map.of("economy", current24(
                        "PUBLISHED_OUTBOX_EVENTS_LAST_24_HOURS", "available",
                        Map.of("manufacturingRevenue", 0, "totalCost", 200, "operatingProfit", 9_999)))),
                "logitics", service("Archive-Logistics", Map.of()),
                "ledger", service("Archive-Ledger", Map.of()))));

        Map<String, Object> summary = new EcosystemBalanceService(ecosystem, properties).summary();
        Map<String, Object> nexus = row(rows(summary), "archive-nexus");

        assertThat(nexus).containsEntry("revenue", BigDecimal.ZERO)
                .containsEntry("cost", BigDecimal.valueOf(200))
                .containsEntry("profit", BigDecimal.valueOf(-200))
                .containsEntry("balance", "UNDER_PRESSURE")
                .containsEntry("includedInTotals", true);
    }

    @Test
    void marketLifetimeCashflowCannotOverwriteExplicitCurrentEconomy() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        Map<String, Object> currentEconomy = current24(
                "ROLLING_24H_RECOGNIZED_EVENTS", "dataAvailable",
                Map.of("recognizedRevenue", 100, "totalExpense", 70, "operatingProfit", 777, "cashBalance", 500));
        Map<String, Object> lifetimeCashflow = Map.of(
                "recognizedRevenue", 1_000_000_000,
                "totalExpense", 900_000_000,
                "operatingProfit", 100_000_000,
                "cashBalance", 999_999_999,
                "calculationScope", "LIFETIME");
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "market", service("Archive-Market", Map.of("marketEconomy", Map.of("data", Map.of(
                        "economy", currentEconomy,
                        "cashflow", lifetimeCashflow)))))));

        Map<String, Object> summary = new EcosystemBalanceService(ecosystem, properties).summary();
        Map<String, Object> market = row(rows(summary), "archive-market");

        assertThat(market).containsEntry("revenue", BigDecimal.valueOf(100))
                .containsEntry("cost", BigDecimal.valueOf(70))
                .containsEntry("profit", BigDecimal.valueOf(30))
                .containsEntry("cashBalance", BigDecimal.valueOf(500))
                .containsEntry("includedInTotals", true);
        assertThat(totals(summary)).containsEntry("revenue", BigDecimal.valueOf(100))
                .containsEntry("cost", BigDecimal.valueOf(70))
                .containsEntry("profit", BigDecimal.valueOf(30))
                .containsEntry("includedServices", 1L);
    }

    @Test
    void logisticsOperationsEconomyUsesCurrentFieldsAndIgnoresLifetimeSnapshotFields() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        Map<String, Object> logisticsEconomy = current24(
                "ROLLING_24H_RECOGNIZED_LOGISTICS_EVENTS", "dataAvailable",
                Map.of(
                        "recognizedRevenue", 250,
                        "realizedOperatingCost", 150,
                        "operatingProfit", 999,
                        "totalRevenue", 5_000_000,
                        "totalCost", 4_000_000,
                        "totalProfit", 1_000_000,
                        "cashBalance", 99_000_000));
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "logitics", service("Archive-Logistics", Map.of(
                        "operations", Map.of("data", Map.of("economy", logisticsEconomy)),
                        "balance", Map.of("cashBalance", 88_000_000))))));

        Map<String, Object> summary = new EcosystemBalanceService(ecosystem, properties).summary();
        Map<String, Object> logistics = row(rows(summary), "archive-logistics");

        assertThat(logistics).containsEntry("revenue", BigDecimal.valueOf(250))
                .containsEntry("cost", BigDecimal.valueOf(150))
                .containsEntry("profit", BigDecimal.valueOf(100))
                .containsEntry("cashBalance", null)
                .containsEntry("includedInTotals", true);
        assertThat(totals(summary)).containsEntry("revenue", BigDecimal.valueOf(250))
                .containsEntry("cost", BigDecimal.valueOf(150))
                .containsEntry("profit", BigDecimal.valueOf(100))
                .containsEntry("includedServices", 1L);
    }

    @Test
    void failsClosedForLegacyMissingMetadataUnavailableAndStaleContracts() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        Instant staleEnd = Instant.now().minus(Duration.ofHours(2));
        Map<String, Object> unavailableLogistics = current24(
                "ROLLING_24H_RECOGNIZED_LOGISTICS_EVENTS", "dataAvailable",
                Map.of("recognizedRevenue", 300, "realizedOperatingCost", 200));
        unavailableLogistics.put("dataAvailable", false);
        Map<String, Object> legacyLedger = currentWorkday(
                Map.of("recognizedRevenue", 500, "realizedOperatingCost", 400));
        legacyLedger.put("calculationScope", "LEGACY_UNSCOPED");
        Map<String, Object> services = Map.of(
                "market", service("Archive-Market", Map.of("economy", Map.of(
                        "recognizedRevenue", 1_000_000_000,
                        "totalExpense", 10,
                        "operatingProfit", 999_999_990))),
                "nexus", service("Archive-Nexus", Map.of("economy", current24At(
                        staleEnd,
                        "PUBLISHED_OUTBOX_EVENTS_LAST_24_HOURS", "available",
                        Map.of("manufacturingRevenue", 100, "totalCost", 80)))),
                "logitics", service("Archive-Logistics", Map.of("economy", unavailableLogistics)),
                "ledger", service("Archive-Ledger", Map.of("balance", legacyLedger)));
        when(ecosystem.summary()).thenReturn(Map.of("services", services));

        Map<String, Object> summary = new EcosystemBalanceService(ecosystem, properties).summary();
        Map<String, Object> market = row(rows(summary), "archive-market");
        Map<String, Object> nexus = row(rows(summary), "archive-nexus");
        Map<String, Object> logistics = row(rows(summary), "archive-logistics");
        Map<String, Object> ledger = row(rows(summary), "archive-ledger");

        assertThat(market).containsEntry("includedInTotals", false)
                .containsEntry("aggregationStatus", "MISSING_CURRENCY")
                .containsEntry("balance", "NO_DATA");
        assertThat(nexus).containsEntry("includedInTotals", false)
                .containsEntry("aggregationStatus", "STALE_PERIOD")
                .containsEntry("balance", "NO_DATA");
        assertThat(logistics).containsEntry("includedInTotals", false)
                .containsEntry("aggregationStatus", "NO_CURRENT_WINDOW_DATA")
                .containsEntry("balance", "NO_DATA");
        assertThat(ledger).containsEntry("includedInTotals", false)
                .containsEntry("aggregationStatus", "INCOMPARABLE_SCOPE")
                .containsEntry("balance", "NO_DATA");
        assertThat(totals(summary)).containsEntry("revenue", BigDecimal.ZERO)
                .containsEntry("cost", BigDecimal.ZERO)
                .containsEntry("profit", BigDecimal.ZERO)
                .containsEntry("includedServices", 0L);
    }

    @Test
    void failsClosedWhenRollingWindowClaimsAvailabilityWithoutSourceLineage() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        Instant periodEnd = Instant.now();
        Map<String, Object> economy = new LinkedHashMap<>();
        economy.put("recognizedRevenue", 100);
        economy.put("totalExpense", 70);
        economy.put("currency", "SYNTHETIC_KRW");
        economy.put("calculationScope", "ROLLING_24H_RECOGNIZED_EVENTS");
        economy.put("periodStart", periodEnd.minus(Duration.ofHours(24)).toString());
        economy.put("periodEnd", periodEnd.toString());
        economy.put("dataAvailable", true);
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "market", service("Archive-Market", Map.of("economy", economy)))));

        Map<String, Object> market = row(rows(new EcosystemBalanceService(ecosystem, properties).summary()), "archive-market");

        assertThat(market).containsEntry("includedInTotals", false)
                .containsEntry("aggregationStatus", "MISSING_SOURCE_LINEAGE")
                .containsEntry("balance", "NO_DATA");
    }

    @Test
    void includesCurrentWorkdayFinanceWhenTheIndependentSchedulerIsPaused() {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        EcosystemBalanceProperties properties = new EcosystemBalanceProperties();
        Map<String, Object> ledgerSummary = new LinkedHashMap<>();
        ledgerSummary.put("balance", currentWorkday(Map.of(
                "recognizedRevenue", 33_000,
                "realizedOperatingCost", 12_000)));
        ledgerSummary.put("runtime", Map.of("runtimeActive", false));
        when(ecosystem.summary()).thenReturn(Map.of("services", Map.of(
                "ledger", service("Archive-Ledger", ledgerSummary))));

        Map<String, Object> ledger = row(rows(new EcosystemBalanceService(ecosystem, properties).summary()), "archive-ledger");

        assertThat(ledger).containsEntry("includedInTotals", true)
                .containsEntry("aggregationStatus", "INCLUDED")
                .containsEntry("revenue", BigDecimal.valueOf(33_000))
                .containsEntry("cost", BigDecimal.valueOf(12_000))
                .containsEntry("profit", BigDecimal.valueOf(21_000));
    }

    private Map<String, Object> current24(String scope, String availabilityKey, Map<String, Object> values) {
        return current24At(Instant.now(), scope, availabilityKey, values);
    }

    private Map<String, Object> current24At(
            Instant periodEnd,
            String scope,
            String availabilityKey,
            Map<String, Object> values
    ) {
        Map<String, Object> result = new LinkedHashMap<>(values);
        result.put("currency", "SYNTHETIC_KRW");
        result.put("calculationScope", scope);
        result.put("periodStart", periodEnd.minus(Duration.ofHours(24)).toString());
        result.put("periodEnd", periodEnd.toString());
        result.put("sourceLatestEventAt", periodEnd.minus(Duration.ofMinutes(1)).toString());
        result.put(availabilityKey, true);
        return result;
    }

    private Map<String, Object> currentWorkday(Map<String, Object> values) {
        Map<String, Object> result = new LinkedHashMap<>(values);
        result.put("currency", "SYNTHETIC_KRW");
        result.put("calculationScope", "WORKDAY");
        result.put("periodStart", LocalDate.now().toString());
        result.put("periodEnd", LocalDate.now().toString());
        result.put("dataAvailable", true);
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(Map<String, Object> summary) {
        return (List<Map<String, Object>>) summary.get("services");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> totals(Map<String, Object> summary) {
        return (Map<String, Object>) summary.get("totals");
    }

    private Map<String, Object> row(List<Map<String, Object>> rows, String id) {
        return rows.stream().filter(candidate -> id.equals(candidate.get("serviceId"))).findFirst().orElseThrow();
    }

    private Map<String, Object> service(String name, Map<String, Object> summary) {
        return Map.of("name", name, "status", "HEALTHY", "summary", summary);
    }
}
