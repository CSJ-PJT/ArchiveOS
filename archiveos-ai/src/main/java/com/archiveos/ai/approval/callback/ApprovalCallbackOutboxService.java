package com.archiveos.ai.approval.callback;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.EcosystemRepository;
import com.archiveos.ai.ecosystem.IntegrationResult;
import com.archiveos.ai.integration.ledger.LedgerClient;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApprovalCallbackOutboxService {
    private final ApprovalCallbackOutboxRepository repository;
    private final EcosystemProperties properties;
    private final LedgerClient ledger;
    private final AuditLogService audit;
    private final EcosystemRepository ecosystem;

    public ApprovalCallbackOutboxService(ApprovalCallbackOutboxRepository repository, EcosystemProperties properties,
                                         LedgerClient ledger, AuditLogService audit, EcosystemRepository ecosystem) {
        this.repository = repository;
        this.properties = properties;
        this.ledger = ledger;
        this.audit = audit;
        this.ecosystem = ecosystem;
    }

    public List<Map<String, Object>> list(int limit) { return repository.list(limit); }
    public Map<String, Object> detail(String callbackId) { return repository.find(callbackId); }

    @Transactional
    public Map<String, Object> enqueueLedgerCallback(String approvalRequestId, String sourceService, Map<String, Object> payload) {
        String callbackId = "CB-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        String targetUrl = ledger.config().getBaseUrl() + ledger.config().getApprovalCallbackPath();
        if (!properties.getIntegration().getCallback().isEnabled() || !properties.getIntegration().isAllowExternalWrite()) {
            Map<String, Object> skipped = repository.create(callbackId, approvalRequestId, sourceService, "Archive-Ledger", targetUrl, payload, "SKIPPED", "SAFE_MODE_BLOCKED");
            audit.recordEvent("approval_callback_outbox_skipped", "approval_callback", callbackId, string(payload.get("correlationId")),
                    Map.of("approvalRequestId", approvalRequestId, "targetService", "Archive-Ledger"));
            ecosystem.recordTimeline(null, string(payload.get("correlationId")), "archiveos", "CALLBACK_SKIPPED",
                    "external_approval", approvalRequestId, "Ledger callback skipped by safe mode", Map.of("callbackId", callbackId));
            return skipped;
        }
        Map<String, Object> row = repository.create(callbackId, approvalRequestId, sourceService, "Archive-Ledger", targetUrl, payload, "PENDING", null);
        return send(row);
    }

    @Transactional
    public Map<String, Object> retry(String callbackId) {
        Map<String, Object> row = repository.find(callbackId);
        if (row == null) throw new IllegalArgumentException("Callback outbox item not found.");
        return send(row);
    }

    @Transactional
    public List<Map<String, Object>> retryFailed() {
        return repository.failedOrRetry(50).stream().map(this::send).toList();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> send(Map<String, Object> row) {
        String callbackId = String.valueOf(row.get("callback_id"));
        String approvalRequestId = String.valueOf(row.get("approval_request_id"));
        Map<String, Object> payload = row.get("payload") instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        if (!properties.getIntegration().isAllowExternalWrite()) {
            repository.markRetry(callbackId, "RETRY", properties.getIntegration().getCallback().getMaxRetryCount(),
                    properties.getIntegration().getCallback().getRetryDelaySeconds(), "SAFE_MODE_BLOCKED");
            audit.recordEvent("approval_callback_outbox_retry_blocked", "approval_callback", callbackId, string(payload.get("correlationId")),
                    Map.of("approvalRequestId", approvalRequestId, "targetService", "Archive-Ledger"));
            return repository.find(callbackId);
        }
        IntegrationResult result = ledger.approvalCallback(payload);
        if (result.ok()) {
            repository.markSent(callbackId);
            audit.recordEvent("approval_callback_outbox_sent", "approval_callback", callbackId, string(payload.get("correlationId")),
                    Map.of("approvalRequestId", approvalRequestId, "targetService", "Archive-Ledger"));
            ecosystem.recordTimeline(null, string(payload.get("correlationId")), "archiveos", "CALLBACK_SENT",
                    "external_approval", approvalRequestId, "Ledger approval callback sent", Map.of("callbackId", callbackId));
        } else {
            repository.markRetry(callbackId, "RETRY", properties.getIntegration().getCallback().getMaxRetryCount(),
                    properties.getIntegration().getCallback().getRetryDelaySeconds(),
                    result.errorMessage() == null ? "Callback failed" : result.errorMessage());
            audit.recordEvent("approval_callback_outbox_retry", "approval_callback", callbackId, string(payload.get("correlationId")),
                    Map.of("approvalRequestId", approvalRequestId, "targetService", "Archive-Ledger", "error", result.errorMessage()));
        }
        return repository.find(callbackId);
    }

    private String string(Object value) { return value == null ? null : String.valueOf(value); }
}
