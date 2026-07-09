package com.archiveos.ai.approval.callback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemRepository;
import com.archiveos.ai.ecosystem.EcosystemServiceStatus;
import com.archiveos.ai.ecosystem.IntegrationResult;
import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.security.PlatformRole;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ApprovalCallbackOutboxServiceTest {
    @Test void safeModeCreatesSkippedCallbackOutboxWithoutExternalWrite() {
        ApprovalCallbackOutboxRepository repository = Mockito.mock(ApprovalCallbackOutboxRepository.class);
        EcosystemProperties properties = properties(false);
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        when(ledger.config()).thenReturn(ledgerConfig());
        when(repository.create(Mockito.any(), Mockito.eq("APR-1"), Mockito.eq("Archive-Ledger"), Mockito.eq("Archive-Ledger"), Mockito.any(), Mockito.any(), Mockito.eq("SKIPPED"), Mockito.eq("SAFE_MODE_BLOCKED")))
                .thenReturn(Map.of("callback_id", "CB-1", "status", "SKIPPED"));

        ApprovalCallbackOutboxService service = new ApprovalCallbackOutboxService(repository, properties, ledger, audit(), Mockito.mock(EcosystemRepository.class));

        assertThat(service.enqueueLedgerCallback("APR-1", "Archive-Ledger", Map.of("correlationId", "c-1"))).containsEntry("status", "SKIPPED");
    }

    @Test void failedLedgerCallbackIsMarkedRetry() {
        ApprovalCallbackOutboxRepository repository = Mockito.mock(ApprovalCallbackOutboxRepository.class);
        EcosystemProperties properties = properties(true);
        LedgerClient ledger = Mockito.mock(LedgerClient.class);
        when(ledger.approvalCallback(Mockito.any())).thenReturn(new IntegrationResult(EcosystemServiceStatus.UNAVAILABLE, null, Map.of(), "Connection refused", 1));
        when(repository.find("CB-1")).thenReturn(Map.of("callback_id", "CB-1", "approval_request_id", "APR-1", "payload", Map.of("correlationId", "c-1")));

        ApprovalCallbackOutboxService service = new ApprovalCallbackOutboxService(repository, properties, ledger, audit(), Mockito.mock(EcosystemRepository.class));
        service.retry("CB-1");

        verify(repository).markRetry("CB-1", "RETRY", 5, 30, "Connection refused");
    }

    private EcosystemProperties properties(boolean allowWrite) {
        EcosystemProperties properties = new EcosystemProperties();
        properties.getIntegration().setAllowExternalWrite(allowWrite);
        return properties;
    }

    private EcosystemProperties.ServiceConfig ledgerConfig() {
        EcosystemProperties.ServiceConfig config = new EcosystemProperties.ServiceConfig();
        config.setBaseUrl("http://localhost:18080");
        config.setApprovalCallbackPath("/api/approvals/callback");
        return config;
    }

    private AuditLogService audit() {
        AuditLogService audit = Mockito.mock(AuditLogService.class);
        when(audit.actor()).thenReturn(new AuditLogService.Actor("archiveos-admin", PlatformRole.ADMIN));
        return audit;
    }
}
