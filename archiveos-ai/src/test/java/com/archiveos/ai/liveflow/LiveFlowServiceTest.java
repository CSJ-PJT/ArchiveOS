package com.archiveos.ai.liveflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import com.archiveos.ai.approval.callback.ApprovalCallbackOutboxRepository;
import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.ecosystem.EcosystemService;
import com.archiveos.ai.security.PlatformRole;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
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
        when(repository.latestBusinessEventByNode()).thenReturn(Map.of());
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

    @Test void readEndpointsUsePersistedSnapshotsWithoutTriggeringExternalRefresh() {
        LiveFlowRepository repository = repositoryBase(Map.of("market", Instant.now().minusSeconds(2)));
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        ExternalApprovalRepository approvals = Mockito.mock(ExternalApprovalRepository.class);
        ApprovalCallbackOutboxRepository callbacks = Mockito.mock(ApprovalCallbackOutboxRepository.class);
        when(ecosystem.summary()).thenReturn(healthyServices(Map.of()));
        when(approvals.summary()).thenReturn(Map.of());
        when(repository.recent(30)).thenReturn(List.of());
        LiveFlowService service = new LiveFlowService(repository, ecosystem, approvals, callbacks, audit());

        service.summary();
        service.recent(30);

        verify(ecosystem, never()).refresh();
        verify(repository).recent(30);
    }

    @Test void dashboardCanRequestRouteBalancedPersistedSample() {
        LiveFlowRepository repository = repositoryBase(Map.of());
        when(repository.recentBalanced(30)).thenReturn(List.of(Map.of("event_id", "balanced-1")));
        LiveFlowService service = new LiveFlowService(repository, Mockito.mock(EcosystemService.class),
                Mockito.mock(ExternalApprovalRepository.class), Mockito.mock(ApprovalCallbackOutboxRepository.class), audit());

        assertThat((List<?>) service.recent(30, true).get("data")).hasSize(1);
        verify(repository).recentBalanced(30);
        verify(repository, never()).recent(30);
    }

    @Test void runtimeUsesPerNodeBusinessAggregateInsteadOfGlobalLatestSample() {
        LiveFlowRepository repository = repositoryBase(Map.of(
                "market", Instant.now().minusSeconds(1),
                "nexus", Instant.now().minusSeconds(10),
                "logistics", Instant.now().minusSeconds(15)));
        LiveFlowService service = service(repository, healthyServices(Map.of()));

        Map<String, Object> result = service.refresh();

        assertThat(runtimeStatus(result, "Archive-Market")).isEqualTo("PROCESSING");
        assertThat(runtimeStatus(result, "Archive-Nexus")).isEqualTo("PROCESSING");
        assertThat(runtimeStatus(result, "Archive-Logistics")).isEqualTo("PROCESSING");
        verify(repository, never()).latestBusinessEvents(anyInt());
    }

    @Test void runtimeDoesNotLoseQuietNodesWhenMarketHasManyRecentEvents() {
        LiveFlowRepository repository = repositoryBase(Map.of(
                "market", Instant.now().minusSeconds(1),
                "nexus", Instant.now().minusSeconds(10),
                "logistics", Instant.now().minusSeconds(15)));
        when(repository.businessEventCountByNode("archive-market", 30)).thenReturn(1000L);
        when(repository.businessEventCountByNode("archive-nexus", 30)).thenReturn(1L);
        when(repository.businessEventCountByNode("archive-logistics", 30)).thenReturn(1L);
        LiveFlowService service = service(repository, healthyServices(Map.of()));

        Map<String, Object> result = service.refresh();

        assertThat(runtimeStatus(result, "Archive-Nexus")).isEqualTo("PROCESSING");
        assertThat(runtimeStatus(result, "Archive-Logistics")).isEqualTo("PROCESSING");
        verify(repository).latestBusinessEventByNode();
        verify(repository, never()).latestBusinessEvents(anyInt());
    }

    @Test void runtimeUsesCurrentTickWhenPersistedSourceEventsHaveNotArrivedYet() {
        LiveFlowRepository repository = repositoryBase(Map.of("logistics", Instant.now().minusSeconds(5)));
        when(repository.businessEventCountByNode("archive-logistics", 30)).thenReturn(0L);
        LiveFlowService service = service(repository, healthyServices(Map.of("logitics", Map.of(
                "runtime", Map.of(
                        "runtimeActive", true,
                        "autoRunEnabled", true,
                        "schedulerStatus", "RUNNING",
                        "pipelineStatus", "LIVE_WITH_BACKLOG",
                        "eventsProducedLastTick", 10,
                        "eventsConsumedLastTick", 8)))));

        Map<String, Object> result = service.refresh();
        Map<String, Object> logistics = runtimeService(result, "Archive-Logistics");

        assertThat(logistics).containsEntry("recentThroughput", 10L)
                .containsEntry("throughputSource", "runtime_tick");
    }

    @Test void runtimeNormalizesTimezoneLessUpstreamWorkTimestampToUtc() {
        LiveFlowRepository repository = repositoryBase(Map.of("logistics", Instant.parse("2026-08-21T06:50:22Z")));
        LiveFlowService service = service(repository, healthyServices(Map.of("logitics", Map.of(
                "runtime", Map.of(
                        "runtimeActive", true,
                        "schedulerStatus", "BACKLOG_LIMITED",
                        "pipelineStatus", "LIVE_WITH_BACKLOG",
                        "lastWorkAt", "2026-08-21T06:56:54.4832319")))));

        Map<String, Object> logistics = runtimeService(service.refresh(), "Archive-Logistics");

        assertThat(logistics).containsEntry("lastWorkAt", "2026-08-21T06:56:54.483231900Z");
    }

    @Test void runtimeReadsMarketTickFromNestedOperationsContract() {
        LiveFlowRepository repository = repositoryBase(Map.of("market", Instant.now().minusSeconds(5)));
        when(repository.businessEventCountByNode("archive-market", 30)).thenReturn(0L);
        LiveFlowService service = service(repository, healthyServices(Map.of("market", Map.of(
                "operations", Map.of("runtime", Map.of(
                        "runtimeActive", true,
                        "autoRunEnabled", true,
                        "schedulerStatus", "RUNNING",
                        "pipelineStatus", "LIVE",
                        "eventsProducedLastTick", 1,
                        "eventsConsumedLastTick", 0))))));

        Map<String, Object> market = runtimeService(service.refresh(), "Archive-Market");

        assertThat(market).containsEntry("runtimeActive", true)
                .containsEntry("autoRunEnabled", true)
                .containsEntry("recentThroughput", 1L)
                .containsEntry("throughputSource", "runtime_tick");
    }

    @Test void runtimeKeepsExplicitNoWorkStateInsteadOfInventingProcessingVolume() {
        LiveFlowRepository repository = repositoryBase(Map.of("nexus", Instant.now().minusSeconds(600)));
        when(repository.businessEventCountByNode("archive-nexus", 30)).thenReturn(0L);
        LiveFlowService service = service(repository, healthyServices(Map.of("nexus", Map.of(
                "runtime", Map.of(
                        "runtimeActive", false,
                        "autoRunEnabled", false,
                        "schedulerStatus", "DISABLED",
                        "pipelineStatus", "DISABLED",
                        "eventsProducedLastTick", 0,
                        "eventsConsumedLastTick", 0)))));

        Map<String, Object> result = service.refresh();
        Map<String, Object> nexus = runtimeService(result, "Archive-Nexus");

        assertThat(nexus).containsEntry("recentThroughput", 0L)
                .containsEntry("throughputSource", "no_work_in_window")
                .containsEntry("schedulerStatus", "DISABLED")
                .containsEntry("pipelineStatus", "DISABLED");
    }

    @Test void runtimeIgnoresRecentHealthOnlyEventsForProcessingState() {
        LiveFlowRepository repository = repositoryBase(Map.of("nexus", Instant.now().minusSeconds(400)));
        when(repository.summary()).thenReturn(Map.of(
                "active_flows", 1,
                "recent_events", 1,
                "latest_event_at", Instant.now().minusSeconds(5).toString()));
        LiveFlowService service = service(repository, healthyServices(Map.of("nexus", Map.of(
                "runtime", Map.of("schedulerStatus", "RUNNING")))));

        Map<String, Object> result = service.refresh();

        assertThat(runtimeStatus(result, "Archive-Nexus")).isEqualTo("STALLED");
        assertThat(runtimeStatus(result, "Archive-Nexus")).isNotEqualTo("PROCESSING");
    }

    @Test void runtimeMarksHealthyServiceProcessingWhenBusinessEventIsFresh() {
        LiveFlowRepository repository = repositoryBase(Map.of("nexus", Instant.now().minusSeconds(10)));
        LiveFlowService service = service(repository, healthyServices(Map.of()));

        assertThat(runtimeStatus(service.refresh(), "Archive-Nexus")).isEqualTo("PROCESSING");
    }

    @Test void runtimeMarksHealthyServiceWaitingWhenBusinessEventIsSlow() {
        LiveFlowRepository repository = repositoryBase(Map.of("nexus", Instant.now().minusSeconds(120)));
        LiveFlowService service = service(repository, healthyServices(Map.of()));

        assertThat(runtimeStatus(service.refresh(), "Archive-Nexus")).isEqualTo("WAITING");
    }

    @Test void runtimeMarksHealthyExpectedRuntimeStalledWhenBusinessEventIsStale() {
        LiveFlowRepository repository = repositoryBase(Map.of("nexus", Instant.now().minusSeconds(301)));
        LiveFlowService service = service(repository, healthyServices(Map.of("nexus", Map.of(
                "runtime", Map.of("schedulerStatus", "RUNNING")))));

        assertThat(runtimeStatus(service.refresh(), "Archive-Nexus")).isEqualTo("STALLED");
    }

    @Test void runtimeMarksBacklogLimitedServiceWaitingInsteadOfBlockedWhenBusinessEventIsStale() {
        LiveFlowRepository repository = repositoryBase(Map.of("logistics", Instant.now().minusSeconds(600)));
        LiveFlowService service = service(repository, healthyServices(Map.of("logitics", Map.of(
                "runtime", Map.of("schedulerStatus", "BACKLOG_LIMITED", "pipelineStatus", "LIVE_WITH_BACKLOG", "runtimeActive", true)))));

        assertThat(runtimeStatus(service.refresh(), "Archive-Logistics")).isEqualTo("WAITING");
    }

    @Test void runtimeDoesNotStallWhenAutorunIsIntentionallyDisabled() {
        LiveFlowRepository repository = repositoryBase(Map.of("nexus", Instant.now().minusSeconds(301)));
        LiveFlowService service = service(repository, healthyServices(Map.of("nexus", Map.of(
                "runtime", Map.of("schedulerStatus", "RUNNING", "autoRunEnabled", false)))));

        assertThat(runtimeStatus(service.refresh(), "Archive-Nexus")).isIn("HEALTHY", "WAITING");
    }

    @Test void settlementUsesCanonicalLedgerIdAndShowsPersistedWorkAsProcessing() {
        LiveFlowRepository repository = repositoryBase(Map.of());
        when(repository.businessEventCountByNode("archive-ledger", 30)).thenReturn(42L);
        LiveFlowService service = service(repository, healthyServices(Map.of()));

        Map<String, Object> result = service.refresh();
        Map<String, Object> settlement = runtimeService(result, "Settlement");

        assertThat(settlement).containsEntry("runtimeStatus", "PROCESSING")
                .containsEntry("recentThroughput", 42L)
                .containsEntry("throughputSource", "ledger_persisted_business_events_30m");
        verify(repository, atLeast(2)).businessEventCountByNode("archive-ledger", 30);
        verify(repository, never()).businessEventCountByNode("Archive-Ledger", 30);
    }

    private LiveFlowRepository repositoryBase(Map<String, Instant> latestByNode) {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        when(repository.upsert(any())).thenReturn(Map.of("event_id", "stored"));
        when(repository.summary()).thenReturn(Map.of(
                "active_flows", 1,
                "recent_events", 1,
                "latest_event_at", latestByNode.values().stream().max(Instant::compareTo)
                        .orElse(Instant.now().minus(Duration.ofHours(1))).toString()));
        when(repository.recent(12)).thenReturn(List.of());
        when(repository.latestBusinessEventByNode()).thenReturn(latestByNode);
        return repository;
    }

    private Map<String, Object> healthyServices(Map<String, Map<String, Object>> summaries) {
        return Map.of("services", Map.of(
                "market", service("Archive-Market", summaries.get("market")),
                "logitics", service("Archive-Logistics", summaries.get("logitics")),
                "nexus", service("Archive-Nexus", summaries.get("nexus")),
                "ledger", service("Archive-Ledger", summaries.get("ledger"))));
    }

    private Map<String, Object> service(String name, Map<String, Object> summary) {
        return Map.of("status", "HEALTHY", "name", name, "summary", summary == null ? Map.of() : summary);
    }

    private LiveFlowService service(LiveFlowRepository repository, Map<String, Object> ecosystemSnapshot) {
        EcosystemService ecosystem = Mockito.mock(EcosystemService.class);
        ExternalApprovalRepository approvals = Mockito.mock(ExternalApprovalRepository.class);
        ApprovalCallbackOutboxRepository callbacks = Mockito.mock(ApprovalCallbackOutboxRepository.class);
        when(ecosystem.summary()).thenReturn(ecosystemSnapshot);
        when(ecosystem.refresh()).thenReturn(ecosystemSnapshot);
        when(approvals.pending(50)).thenReturn(List.of());
        when(approvals.summary()).thenReturn(Map.of());
        when(callbacks.list(50)).thenReturn(List.of());
        return new LiveFlowService(repository, ecosystem, approvals, callbacks, audit());
    }

    @SuppressWarnings("unchecked")
    private String runtimeStatus(Map<String, Object> result, String serviceName) {
        return String.valueOf(runtimeService(result, serviceName).get("runtimeStatus"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> runtimeService(Map<String, Object> result, String serviceName) {
        Map<String, Object> runtime = (Map<String, Object>) result.get("runtime");
        List<Map<String, Object>> services = (List<Map<String, Object>>) runtime.get("services");
        return services.stream()
                .filter(service -> serviceName.equals(service.get("serviceName")))
                .findFirst()
                .orElseThrow();
    }

    private AuditLogService audit() {
        AuditLogService audit = Mockito.mock(AuditLogService.class);
        when(audit.actor()).thenReturn(new AuditLogService.Actor("archiveos-admin", PlatformRole.ADMIN));
        return audit;
    }
}
