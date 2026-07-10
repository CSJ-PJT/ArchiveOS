package com.archiveos.ai.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemServiceStatus;
import com.archiveos.ai.ecosystem.IntegrationResult;
import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.market.MarketClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class SettlementAgencyGameServiceTest {
    @Test
    void fallbackSimulationKeepsArchiveOsAliveWhenLedgerGameIsUnavailable() {
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        MarketClient market = market();
        GameFinanceRepository finance = Mockito.mock(GameFinanceRepository.class);
        when(ledger.settlementGameSimulate(Mockito.anyMap())).thenReturn(unavailable());
        SettlementAgencyGameService service = new SettlementAgencyGameService(ledger, market, properties(), finance);

        Map<String, Object> result = service.simulate(Map.of(), true);

        assertThat(result).containsEntry("simulationSource", "ArchiveOS fallback")
                .containsEntry("syntheticData", true)
                .containsEntry("agentMode", "PROPOSAL_ONLY");
        assertThat(result.get("status")).isIn("RUNNING", "ATTENTION", "BANKRUPTCY_RISK");
        assertThat(result).containsKeys("ecosystemCashBalance", "bankruptcyRisk", "services", "events", "proposals");
        @SuppressWarnings("unchecked")
        Map<String, Object> services = (Map<String, Object>) result.get("services");
        assertThat(services).containsKey("market");
        verify(finance, atLeastOnce()).upsertSnapshot(Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.anyInt(), Mockito.anyString(), Mockito.anyString(), Mockito.anyMap());
        verify(finance, atLeastOnce()).insertTrade(Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.anyInt(), Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.any(), Mockito.anyString(), Mockito.anyMap());
    }

    @Test
    void gameEventsCarrySimulationMetadataAndRespectMaxHop() {
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        when(ledger.settlementGameSimulate(Mockito.anyMap())).thenReturn(unavailable());
        SettlementAgencyGameService service = new SettlementAgencyGameService(ledger, market(), properties(), Mockito.mock(GameFinanceRepository.class));

        Map<String, Object> result = service.simulate(Map.of("maxHop", 2), true);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> events = (List<Map<String, Object>>) result.get("events");
        assertThat(events).isNotEmpty();
        assertThat(events).allSatisfy(event -> {
            assertThat(event).containsKeys("eventId", "idempotencyKey", "simulationRunId", "settlementCycleId",
                    "tickId", "day", "correlationId", "hop", "maxHop");
            assertThat((Integer) event.get("hop")).isLessThanOrEqualTo((Integer) event.get("maxHop"));
        });
    }

    @Test
    void stressScenarioCanSurfaceBankruptcyRiskWithAgentProposals() {
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        when(ledger.settlementGameSimulate(Mockito.anyMap())).thenReturn(unavailable());
        SettlementAgencyGameService service = new SettlementAgencyGameService(ledger, market(), properties(), Mockito.mock(GameFinanceRepository.class));

        Map<String, Object> stress = new LinkedHashMap<>();
        stress.put("nexusInitialCash", 1_200_000);
        stress.put("logisticsInitialCash", 800_000);
        stress.put("ledgerInitialCash", 900_000);
        stress.put("marketInitialCash", 600_000);
        stress.put("marketSalesRevenue", 1_000_000);
        stress.put("marketRefundCost", 2_400_000);
        stress.put("marketClaimCost", 1_500_000);
        stress.put("marketProductionRequestCost", 900_000);
        stress.put("marketLedgerSettlementFee", 300_000);
        stress.put("nexusProductionRevenue", 2_200_000);
        stress.put("nexusMaterialCost", 3_600_000);
        stress.put("nexusMaintenanceCost", 2_400_000);
        stress.put("nexusQualityLossCost", 1_700_000);
        stress.put("logisticsServiceFee", 500_000);
        stress.put("logisticsDailySettlementFee", 80_000);
        stress.put("transactionCount", 360);
        stress.put("approvalReviewCount", 18);
        stress.put("exceptionCount", 12);
        stress.put("callbackFailureCount", 9);
        stress.put("mismatchCount", 5);
        stress.put("ledgerInfraFixedCost", 2_600_000);
        Map<String, Object> result = service.simulate(stress, true);

        assertThat(result).containsEntry("status", "BANKRUPTCY_RISK")
                .containsEntry("bankruptcyRisk", "CRITICAL");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> proposals = (List<Map<String, Object>>) result.get("proposals");
        assertThat(proposals).isNotEmpty();
    }

    @Test
    void ledgerSimulationResponseIsUsedWhenAvailableButControlTowerPolicyIsDecorated() {
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "RUNNING");
        body.put("maxHop", 4);
        body.put("events", List.of());
        body.put("proposals", List.of());
        when(ledger.settlementGameSimulate(Mockito.anyMap()))
                .thenReturn(new IntegrationResult(EcosystemServiceStatus.HEALTHY, 200, body, null, 10));
        SettlementAgencyGameService service = new SettlementAgencyGameService(ledger, market(), properties(), Mockito.mock(GameFinanceRepository.class));

        Map<String, Object> result = service.simulate(Map.of(), true);

        assertThat(result).containsEntry("simulationSource", "Archive-Ledger")
                .containsEntry("safeMode", true)
                .containsEntry("allowExternalWrite", false)
                .containsEntry("agentMode", "PROPOSAL_ONLY");
        assertThat(result).containsKey("processedEventGuard");
    }

    private IntegrationResult unavailable() {
        return new IntegrationResult(EcosystemServiceStatus.UNAVAILABLE, null, Map.of(), "Connection refused", 1);
    }

    private MarketClient market() {
        MarketClient market = Mockito.mock(MarketClient.class);
        when(market.marketEconomySummary()).thenReturn(unavailable());
        return market;
    }

    private EcosystemProperties properties() {
        EcosystemProperties properties = new EcosystemProperties();
        properties.getIntegration().setSafeMode(true);
        properties.getIntegration().setAllowExternalWrite(false);
        return properties;
    }
}
