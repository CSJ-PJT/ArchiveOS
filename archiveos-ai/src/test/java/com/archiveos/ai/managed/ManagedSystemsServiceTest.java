package com.archiveos.ai.managed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ManagedSystemsServiceTest {
    @Test void overviewAggregatesArchiveOsNexusAtlasAndDeepStake() {
        ManagedSystemsRepository repository = Mockito.mock(ManagedSystemsRepository.class);
        ExternalApprovalRepository approvals = baseApprovalRepository();
        when(repository.pmTasks()).thenReturn(List.of());
        when(repository.queueSummary()).thenReturn(Map.of("pendingApprovalCount", 0, "failedCount", 0, "taskCount", 0));
        when(repository.atlasSystem()).thenReturn(Map.of(
                "current_status", "normal",
                "reason", "All enabled Atlas healthchecks returned expected status.",
                "environment", "production",
                "provider", "OCI",
                "public_base_url", "http://161.33.17.84",
                "updated_at", "2026-07-08T00:00:00Z"));
        when(repository.atlasServices()).thenReturn(List.of(Map.of("current_status", "normal"), Map.of("current_status", "normal")));
        when(repository.latestAtlasHealthcheck()).thenReturn(Map.of("id", "check-1", "status", "ok", "checked_at", "2026-07-08T00:00:00Z"));
        when(repository.atlasWorkLogs(1)).thenReturn(List.of());
        when(repository.atlasWorkLogs(20)).thenReturn(List.of());
        when(repository.latestDailyReport()).thenReturn(null);
        when(repository.recentAuditLogs(100)).thenReturn(List.of());

        ManagedSystemsService service = new ManagedSystemsService(repository, approvals);

        Map<String, Object> overview = service.overview();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> systems = (List<Map<String, Object>>) overview.get("systems");
        assertThat(systems).extracting(system -> system.get("systemId"))
                .containsExactly("archiveos", "archive-nexus", "archive-logitics", "atlas-platform", "archive-ledger", "deepstake-placeholder");
        assertThat(systems).anySatisfy(system -> {
            assertThat(system).containsEntry("systemId", "deepstake-placeholder");
            assertThat(system).containsEntry("status", "not_connected");
        });
        assertThat(systems).anySatisfy(system -> {
            assertThat(system).containsEntry("systemId", "archive-ledger");
            assertThat(system).containsEntry("type", "FINANCIAL_OPERATIONS_BACKEND");
            assertThat(system).containsEntry("status", "not_connected");
            assertThat(system).containsEntry("secrets", "hidden");
            assertThat(system).containsKey("environmentRequirements");
        });
    }

    @Test void nexusPendingWorkflowCreatesHighPmInboxItem() {
        ManagedSystemsRepository repository = baseRepository();
        when(repository.pmTasks()).thenReturn(List.of(Map.of(
                "id", "task-1",
                "title", "Nexus workflow waiting approval",
                "priority", "high",
                "status", "pm_decision_required",
                "target_project", "Archive-Nexus",
                "metadata", Map.of("source", "archive-nexus"),
                "created_at", "2026-07-08T00:00:00Z",
                "updated_at", "2026-07-08T00:00:00Z")));
        when(repository.queueSummary()).thenReturn(Map.of("pendingApprovalCount", 1, "failedCount", 0, "taskCount", 1));

        ManagedSystemsService service = new ManagedSystemsService(repository, baseApprovalRepository());

        List<Map<String, Object>> inbox = service.pmInbox();

        assertThat(inbox).anySatisfy(item -> {
            assertThat(item).containsEntry("severity", "high");
            assertThat(item).containsEntry("sourceSystemId", "archive-nexus");
            assertThat(String.valueOf(item.get("title"))).contains("Nexus workflow");
        });
    }

    @Test void ledgerPendingApprovalCreatesPmInboxItem() {
        ManagedSystemsRepository repository = baseRepository();
        ExternalApprovalRepository approvals = baseApprovalRepository();
        when(approvals.pending(50)).thenReturn(List.of(Map.of(
                "approval_request_id", "APR-1",
                "transaction_id", "TX-1",
                "amount", java.math.BigDecimal.valueOf(4_800_000),
                "currency", "KRW",
                "reason", "Maintenance expense exceeds approval threshold",
                "metadata", Map.of("severity", "HIGH"),
                "created_at", "2026-07-08T00:00:00Z")));
        ManagedSystemsService service = new ManagedSystemsService(repository, approvals);

        List<Map<String, Object>> inbox = service.pmInbox();

        assertThat(inbox).anySatisfy(item -> {
            assertThat(item).containsEntry("severity", "high");
            assertThat(item).containsEntry("sourceSystemId", "archive-ledger");
            assertThat(String.valueOf(item.get("title"))).contains("Ledger approval required");
            assertThat(String.valueOf(item.get("recommendedAction"))).contains("approve or reject");
        });
    }

    @Test void acknowledgeAndResolvePersistInboxStateAndTimeline() {
        ManagedSystemsRepository repository = baseRepository();
        when(repository.updateInboxState(eq("item-1"), eq("acknowledged"), any()))
                .thenReturn(Map.of("id", "item-1", "status", "acknowledged"));
        when(repository.updateInboxState(eq("item-1"), eq("resolved"), any()))
                .thenReturn(Map.of("id", "item-1", "status", "resolved"));
        ManagedSystemsService service = new ManagedSystemsService(repository, baseApprovalRepository());

        assertThat(service.acknowledge("item-1")).containsEntry("status", "acknowledged");
        assertThat(service.resolve("item-1")).containsEntry("status", "resolved");

        verify(repository).recordTimeline(eq("approval"), eq("success"), eq("PM inbox item acknowledged"), eq("item-1"), eq("archiveos"), eq("item-1"), any());
        verify(repository).recordTimeline(eq("approval"), eq("success"), eq("PM inbox item resolved"), eq("item-1"), eq("archiveos"), eq("item-1"), any());
    }

    private ManagedSystemsRepository baseRepository() {
        ManagedSystemsRepository repository = Mockito.mock(ManagedSystemsRepository.class);
        when(repository.pmTasks()).thenReturn(List.of());
        when(repository.queueSummary()).thenReturn(Map.of("pendingApprovalCount", 0, "failedCount", 0, "taskCount", 0));
        when(repository.atlasSystem()).thenReturn(Map.of("current_status", "normal", "reason", "Atlas normal."));
        when(repository.atlasServices()).thenReturn(List.of());
        when(repository.latestAtlasHealthcheck()).thenReturn(null);
        when(repository.atlasWorkLogs(1)).thenReturn(List.of());
        when(repository.atlasWorkLogs(20)).thenReturn(List.of());
        when(repository.latestDailyReport()).thenReturn(null);
        when(repository.recentAuditLogs(100)).thenReturn(List.of());
        return repository;
    }

    private ExternalApprovalRepository baseApprovalRepository() {
        ExternalApprovalRepository approvals = Mockito.mock(ExternalApprovalRepository.class);
        when(approvals.summary()).thenReturn(Map.of("pending", 0, "callback_failed", 0, "total", 0));
        when(approvals.latest()).thenReturn(null);
        when(approvals.pending(50)).thenReturn(List.of());
        when(approvals.callbackFailed(50)).thenReturn(List.of());
        return approvals;
    }
}
