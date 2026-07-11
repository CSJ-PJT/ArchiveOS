package com.archiveos.ai.liveflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import com.archiveos.ai.approval.callback.ApprovalCallbackOutboxRepository;
import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.ecosystem.EcosystemService;
import com.archiveos.ai.security.PlatformRole;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class LiveFlowServiceTest {
    @Test void refreshCollectsRuntimeEventsWithoutFailingOnUnavailableService() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        ExternalApprovalRepository approvals = Mockito.mock(ExternalApprovalRepository.class);
        ApprovalCallbackOutboxRepository callbacks = Mockito.mock(ApprovalCallbackOutboxRepository.class);
        AuditLogService audit = audit();
        when(repository.upsert(any())).thenReturn(Map.of("event_id", "stored"));
        when(repository.summary()).thenReturn(Map.of(
                "active_flows", 2,
                "recent_events", 2,
                "pending_approvals", 1,
                "delayed_shipments", 0,
                "failed_callbacks", 1,
                "degraded_systems", 1));
        when(repository.recent(12)).thenReturn(List.of());
        Map<String, Object> ecosystemSnapshot = Map.of("services", Map.of(
                "market", Map.of("status", "HEALTHY", "name", "Archive-Market", "summary", Map.of(
                        "orders", Map.of("total", 3), "totalRevenue", "1000000", "bankruptcyRisk", "LOW")),
                "logitics", Map.of("status", "UNAVAILABLE", "name", "Archive-Logistics", "summary", Map.of()),
                "nexus", Map.of("status", "HEALTHY", "name", "Archive-Nexus", "summary", Map.of("pending", 2)),
                "ledger", Map.of("status", "HEALTHY", "name", "Archive-Ledger", "summary", Map.of("approvalRequired", 1))));
        when(ecosystem.summary()).thenReturn(ecosystemSnapshot);
        when(ecosystem.refresh()).thenReturn(ecosystemSnapshot);
        when(approvals.pending(50)).thenReturn(List.of(Map.of(
                "approval_request_id", "APR-1",
                "correlation_id", "corr-1",
                "source_service", "Archive-Market",
                "transaction_id", "MKT-ORD-1",
                "amount", BigDecimal.valueOf(4_800_000),
                "metadata", Map.of("severity", "HIGH", "orderId", "ORD-1"))));
        when(callbacks.list(50)).thenReturn(List.of(Map.of(
                "callback_id", "CB-1",
                "approval_request_id", "APR-1",
                "status", "FAILED")));

        LiveFlowService service = new LiveFlowService(repository, ecosystem, approvals, callbacks, audit);

        Map<String, Object> result = service.refresh();

        assertThat(result).containsEntry("active_flows", 2);
        assertThat(result).containsKey("traceId");
        verify(repository, atLeast(4)).upsert(any(LiveFlowEvent.class));
        verify(audit).recordEvent(org.mockito.ArgumentMatchers.eq("live_flow_refresh_completed"),
                org.mockito.ArgumentMatchers.eq("live_flow"), any(), any(), any());
    }

    @Test void topologyReturnsOperationalTwinNodes() {
        LiveFlowService service = new LiveFlowService(Mockito.mock(LiveFlowRepository.class), Mockito.mock(EcosystemService.class),
                Mockito.mock(ExternalApprovalRepository.class), Mockito.mock(ApprovalCallbackOutboxRepository.class), audit());

        Map<String, Object> topology = service.topology();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) topology.get("nodes");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> edges = (List<Map<String, Object>>) topology.get("edges");
        assertThat(nodes).extracting(node -> node.get("id")).contains("market", "logistics", "nexus", "ledger", "archiveos", "settlement");
        assertThat(edges).anySatisfy(edge -> assertThat(edge).containsEntry("from", "market").containsEntry("to", "nexus"));
        assertThat(edges).anySatisfy(edge -> assertThat(edge).containsEntry("from", "nexus").containsEntry("to", "logistics"));
        assertThat(edges).anySatisfy(edge -> assertThat(edge).containsEntry("from", "archiveos").containsEntry("to", "settlement"));
    }

    private AuditLogService audit() {
        AuditLogService audit = Mockito.mock(AuditLogService.class);
        when(audit.actor()).thenReturn(new AuditLogService.Actor("archiveos-admin", PlatformRole.ADMIN));
        return audit;
    }
}
