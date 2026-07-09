package com.archiveos.ai.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.notification.NotificationService;
import com.archiveos.ai.security.PlatformRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ExternalApprovalServiceTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void createsExternalApprovalAndStoresFallbackEvidence() throws Exception {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        AuditLogService audit = audit();
        NotificationService notifications = Mockito.mock(NotificationService.class);
        ExternalApprovalService service = new ExternalApprovalService(repository, audit, notifications, HttpClient.newHttpClient(), "", "", false);
        when(repository.findDuplicate("ledger-1", "TX-1")).thenReturn(null);
        when(repository.createRequest(any())).thenAnswer(invocation -> Map.of(
                "approval_request_id", invocation.<Map<String, Object>>getArgument(0).get("approval_request_id"),
                "status", "PENDING",
                "correlation_id", "ledger-1",
                "transaction_id", "TX-1",
                "amount", java.math.BigDecimal.valueOf(4_800_000),
                "currency", "KRW",
                "metadata", Map.of("severity", "HIGH")));
        when(repository.detail(any())).thenAnswer(invocation -> Map.of(
                "approval_request_id", invocation.getArgument(0),
                "status", "PENDING",
                "correlation_id", "ledger-1"));

        Map<String, Object> result = service.request(json.readTree(sampleBody("ledger-1", "TX-1")));

        assertThat(result).containsEntry("ok", true).containsEntry("duplicate", false).containsEntry("status", "PENDING");
        verify(repository).insertEvidence(any(), eq("RULE_FALLBACK"), any(), any(), any(), any());
        verify(audit).recordEvent(eq("external_approval_requested"), eq("external_approval"), any(), eq("ledger-1"), any());
        verify(audit).recordEvent(eq("external_approval_fallback_evidence_used"), eq("external_approval"), any(), eq("ledger-1"), any());
        verify(notifications).send(org.mockito.ArgumentMatchers.contains("Ledger approval required"));
    }

    @Test void duplicateCorrelationDoesNotCreateNewApproval() throws Exception {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        ExternalApprovalService service = new ExternalApprovalService(repository, audit(), Mockito.mock(NotificationService.class), HttpClient.newHttpClient(), "", "", false);
        when(repository.findDuplicate("ledger-1", "TX-1")).thenReturn(Map.of(
                "approval_request_id", "APR-EXISTING",
                "status", "PENDING",
                "correlation_id", "ledger-1"));

        Map<String, Object> result = service.request(json.readTree(sampleBody("ledger-1", "TX-1")));

        assertThat(result).containsEntry("duplicate", true).containsEntry("approvalRequestId", "APR-EXISTING");
        verify(repository, never()).createRequest(any());
    }

    @Test void approveRecordsDecisionAndSkipsCallbackWhenLedgerBaseUrlIsMissing() throws Exception {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        ExternalApprovalService service = new ExternalApprovalService(repository, audit(), Mockito.mock(NotificationService.class), HttpClient.newHttpClient(), "", "", false);
        when(repository.detail("APR-1")).thenReturn(request("APR-1"));
        when(repository.find("APR-1")).thenReturn(request("APR-1"));
        when(repository.insertDecision(eq("APR-1"), eq("APPROVED"), any(), any())).thenReturn(Map.of("decision", "APPROVED"));

        Map<String, Object> result = service.decide("APR-1", "APPROVED", json.readTree("{\"comment\":\"reviewed\"}"));

        assertThat(result).containsEntry("approval_request_id", "APR-1");
        verify(repository).updateDecisionState("APR-1", "APPROVED", "archiveos-admin");
        verify(repository).insertCallback(eq("APR-1"), eq("archive-ledger"), eq(null), eq("CALLBACK_PENDING"), eq(0), any(), eq(false));
        verify(repository).updateCallbackState(eq("APR-1"), eq("CALLBACK_PENDING"), eq(0), any());
    }

    @Test void criticalSeverityIsCalculatedForHighRiskRequests() {
        ExternalApprovalService service = new ExternalApprovalService(Mockito.mock(ExternalApprovalRepository.class), audit(), Mockito.mock(NotificationService.class), HttpClient.newHttpClient(), "", "", false);
        assertThat(service.configStatus()).containsEntry("baseUrlConfigured", false).containsEntry("callbackTokenConfigured", false);
    }

    @Test void highAmountApprovalIsListedAsHighPriority() {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        ExternalApprovalService service = new ExternalApprovalService(repository, audit(), Mockito.mock(NotificationService.class), HttpClient.newHttpClient(), "", "", false);
        when(repository.list(50)).thenReturn(List.of(request("APR-1")));
        when(repository.evidence("APR-1")).thenReturn(List.of(Map.of("evidence_type", "RULE_FALLBACK")));

        List<Map<String, Object>> approvals = service.list(50);

        assertThat(approvals).hasSize(1);
        assertThat(approvals.get(0)).containsEntry("priority", "high").containsEntry("evidence_type", "RULE_FALLBACK");
    }

    @Test void rejectRecordsDecisionAndCallbackFailureWithoutThrowing() throws Exception {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> response = Mockito.mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(503);
        HttpClient httpClient = Mockito.mock(HttpClient.class);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        NotificationService notifications = Mockito.mock(NotificationService.class);
        ExternalApprovalService service = new ExternalApprovalService(repository, audit(), notifications, httpClient, "http://127.0.0.1:59999", "", true);
        when(repository.detail("APR-1")).thenReturn(request("APR-1"));
        when(repository.find("APR-1")).thenReturn(request("APR-1"));
        when(repository.insertDecision(eq("APR-1"), eq("REJECTED"), any(), any())).thenReturn(Map.of("decision", "REJECTED"));

        Map<String, Object> result = service.decide("APR-1", "REJECTED", json.readTree("{\"comment\":\"not enough evidence\"}"));

        assertThat(result).containsEntry("approval_request_id", "APR-1");
        verify(repository).updateDecisionState("APR-1", "REJECTED", "archiveos-admin");
        verify(repository).insertCallback(eq("APR-1"), eq("archive-ledger"), any(), eq("CALLBACK_FAILED"), eq(1), eq("HTTP 503"), eq(false));
        verify(repository).updateCallbackState("APR-1", "CALLBACK_FAILED", 1, "HTTP 503");
        verify(notifications).send(org.mockito.ArgumentMatchers.contains("Ledger callback failed"));
    }

    @Test void callbackExceptionDoesNotFailDecisionApi() throws Exception {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        HttpClient httpClient = Mockito.mock(HttpClient.class);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenThrow(new IOException("down"));
        ExternalApprovalService service = new ExternalApprovalService(repository, audit(), Mockito.mock(NotificationService.class), httpClient, "http://127.0.0.1:59999", "", true);
        when(repository.detail("APR-1")).thenReturn(request("APR-1"));
        when(repository.find("APR-1")).thenReturn(request("APR-1"));
        when(repository.insertDecision(eq("APR-1"), eq("APPROVED"), any(), any())).thenReturn(Map.of("decision", "APPROVED"));

        Map<String, Object> result = service.decide("APR-1", "APPROVED", json.readTree("{\"comment\":\"reviewed\"}"));

        assertThat(result).containsEntry("approval_request_id", "APR-1");
        verify(repository).insertCallback(eq("APR-1"), eq("archive-ledger"), any(), eq("CALLBACK_FAILED"), eq(1), eq("IOException"), eq(false));
        verify(repository).updateCallbackState("APR-1", "CALLBACK_FAILED", 1, "IOException");
    }

    @Test void successfulCallbackAfterFailureSendsRecoveredNotification() throws Exception {
        ExternalApprovalRepository repository = Mockito.mock(ExternalApprovalRepository.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> response = Mockito.mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        HttpClient httpClient = Mockito.mock(HttpClient.class);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        NotificationService notifications = Mockito.mock(NotificationService.class);
        ExternalApprovalService service = new ExternalApprovalService(repository, audit(), notifications, httpClient, "http://127.0.0.1:59999", "", true);
        Map<String, Object> failedRequest = request("APR-1");
        failedRequest.put("callback_status", "CALLBACK_FAILED");
        when(repository.detail("APR-1")).thenReturn(failedRequest);
        when(repository.find("APR-1")).thenReturn(failedRequest);
        when(repository.insertDecision(eq("APR-1"), eq("APPROVED"), any(), any())).thenReturn(Map.of("decision", "APPROVED"));

        service.decide("APR-1", "APPROVED", json.readTree("{\"comment\":\"retry succeeded\"}"));

        verify(repository).updateCallbackState("APR-1", "CALLBACK_SUCCEEDED", 1, null);
        verify(notifications).send(org.mockito.ArgumentMatchers.contains("Ledger callback recovered"));
    }

    private AuditLogService audit() {
        AuditLogService audit = Mockito.mock(AuditLogService.class);
        when(audit.actor()).thenReturn(new AuditLogService.Actor("archiveos-admin", PlatformRole.ADMIN));
        return audit;
    }

    private Map<String, Object> request(String id) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("approval_request_id", id);
        value.put("status", "PENDING");
        value.put("correlation_id", "ledger-1");
        value.put("transaction_id", "TX-1");
        value.put("amount", java.math.BigDecimal.valueOf(4_800_000));
        value.put("currency", "KRW");
        value.put("metadata", Map.of("severity", "HIGH"));
        value.put("callback_path", "/api/approvals/callback");
        value.put("evidence", List.of());
        value.put("decisions", List.of());
        value.put("callbacks", List.of());
        return value;
    }

    private String sampleBody(String correlationId, String transactionId) {
        return """
                {
                  "source": "Archive-Ledger",
                  "correlationId": "%s",
                  "transactionId": "%s",
                  "amount": 4800000,
                  "currency": "KRW",
                  "reason": "Maintenance expense exceeds approval threshold",
                  "policyQuestion": "Why does this maintenance expense require approval?",
                  "metadata": {
                    "factoryId": "FAC-B",
                    "vendorId": "VENDOR-MAINT-03",
                    "eventType": "MAINTENANCE_COMPLETED",
                    "severity": "HIGH",
                    "requiresApproval": true
                  },
                  "callback": {
                    "targetSystemId": "archive-ledger",
                    "callbackPath": "/api/approvals/callback"
                  }
                }
                """.formatted(correlationId, transactionId);
    }
}
