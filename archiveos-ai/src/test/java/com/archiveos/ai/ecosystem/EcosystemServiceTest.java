package com.archiveos.ai.ecosystem;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.logitics.LogiticsClient;
import com.archiveos.ai.integration.nexus.NexusClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class EcosystemServiceTest {
    @Test void summaryReturnsDegradedWhenExternalServicesAreUnavailable() {
        EcosystemProperties properties = properties();
        EcosystemRepository repository = Mockito.mock(EcosystemRepository.class);
        NexusClient nexus = Mockito.mock(NexusClient.class);
        LogiticsClient logitics = Mockito.mock(LogiticsClient.class);
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        when(repository.recentHealth(3)).thenReturn(List.of());
        when(repository.approvalSummary()).thenReturn(Map.of("pending_external_approvals", 0, "callback_pending", 0, "callback_failed", 0));
        when(repository.callbackSummary()).thenReturn(Map.of("callback_pending", 0, "callback_failed", 0, "callback_sent", 0));
        when(nexus.config()).thenReturn(properties.getEcosystem().getServices().get("nexus"));
        when(logitics.config()).thenReturn(properties.getEcosystem().getServices().get("logitics"));
        when(ledger.config()).thenReturn(properties.getEcosystem().getServices().get("ledger"));
        IntegrationResult unavailable = new IntegrationResult(EcosystemServiceStatus.UNAVAILABLE, null, Map.of(), "Connection refused", 1);
        when(nexus.health()).thenReturn(unavailable); when(nexus.outboxSummary()).thenReturn(unavailable);
        when(logitics.health()).thenReturn(unavailable); when(logitics.operationsSummary()).thenReturn(unavailable);
        when(ledger.health()).thenReturn(unavailable); when(ledger.operationsSummary()).thenReturn(unavailable);
        when(repository.recordHealth(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
                .thenAnswer(invocation -> Map.of("status", invocation.getArgument(3), "checked_at", "2026-07-09T00:00:00Z"));

        EcosystemService service = new EcosystemService(properties, repository, nexus, logitics, ledger);
        Map<String, Object> summary = service.summary();

        assertThat(summary).containsEntry("status", "DEGRADED");
        @SuppressWarnings("unchecked")
        Map<String, Object> services = (Map<String, Object>) summary.get("services");
        assertThat(String.valueOf(((Map<?, ?>) services.get("ledger")).get("status"))).isEqualTo("UNAVAILABLE");
    }

    @Test void topologyReturnsNexusLogiticsLedgerArchiveOsFlow() {
        EcosystemService service = new EcosystemService(properties(), Mockito.mock(EcosystemRepository.class),
                Mockito.mock(NexusClient.class), Mockito.mock(LogiticsClient.class), Mockito.mock(LedgerClient.class));

        Map<String, Object> topology = service.topology();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> edges = (List<Map<String, Object>>) topology.get("edges");
        assertThat(edges).anySatisfy(edge -> assertThat(edge).containsEntry("from", "archive-nexus").containsEntry("to", "archive-logitics"));
        assertThat(edges).anySatisfy(edge -> assertThat(edge).containsEntry("from", "archive-os").containsEntry("to", "archive-ledger"));
    }

    @Test void demoRunIsBlockedByDefaultSafeMode() {
        EcosystemService service = new EcosystemService(properties(), Mockito.mock(EcosystemRepository.class),
                Mockito.mock(NexusClient.class), Mockito.mock(LogiticsClient.class), Mockito.mock(LedgerClient.class));

        assertThat(service.runDemo()).containsEntry("status", "SAFE_MODE_BLOCKED");
    }

    private EcosystemProperties properties() {
        EcosystemProperties properties = new EcosystemProperties();
        Map<String, EcosystemProperties.ServiceConfig> services = new LinkedHashMap<>();
        services.put("nexus", config("Archive-Nexus", "http://localhost:8080", "/api/outbox/summary"));
        services.put("logitics", config("Archive-Logitics", "http://localhost:8092", "/api/operations/summary"));
        services.put("ledger", config("Archive-Ledger", "http://localhost:18080", "/api/operations/summary"));
        services.get("ledger").setApprovalCallbackPath("/api/approvals/callback");
        properties.getEcosystem().setServices(services);
        return properties;
    }

    private EcosystemProperties.ServiceConfig config(String name, String baseUrl, String summaryPath) {
        EcosystemProperties.ServiceConfig config = new EcosystemProperties.ServiceConfig();
        config.setName(name); config.setBaseUrl(baseUrl); config.setHealthPath("/actuator/health"); config.setSummaryPath(summaryPath);
        return config;
    }
}
