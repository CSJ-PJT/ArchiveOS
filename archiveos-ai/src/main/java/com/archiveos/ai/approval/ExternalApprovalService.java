package com.archiveos.ai.approval;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.approval.callback.ApprovalCallbackOutboxService;
import com.archiveos.ai.ecosystem.EcosystemRepository;
import com.archiveos.ai.notification.NotificationResult;
import com.archiveos.ai.notification.NotificationService;
import com.archiveos.ai.obsidian.AiUnavailableException;
import com.archiveos.ai.obsidian.Json;
import com.archiveos.ai.obsidian.ObsidianRagService;
import com.archiveos.ai.obsidian.RagAnswer;
import com.archiveos.ai.policy.PolicyEvidenceService;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExternalApprovalService {
    private static final BigDecimal HIGH_AMOUNT_THRESHOLD = BigDecimal.valueOf(3_000_000);
    private final ExternalApprovalRepository repository;
    private final AuditLogService audit;
    private final NotificationService notifications;
    private final PolicyEvidenceService policyEvidence;
    private final ApprovalCallbackOutboxService callbackOutbox;
    private final EcosystemRepository ecosystem;
    private final HttpClient httpClient;
    private final String ledgerBaseUrl;
    private final String ledgerCallbackToken;
    private final boolean ledgerEnabled;
    private ObsidianRagService rag;

    @Autowired
    public ExternalApprovalService(
            ExternalApprovalRepository repository,
            AuditLogService audit,
            NotificationService notifications,
            PolicyEvidenceService policyEvidence,
            ApprovalCallbackOutboxService callbackOutbox,
            EcosystemRepository ecosystem,
            @Value("${archiveos.ledger.base-url:}") String ledgerBaseUrl,
            @Value("${archiveos.ledger.callback-token:}") String ledgerCallbackToken,
            @Value("${archiveos.ledger.enabled:false}") boolean ledgerEnabled) {
        this(repository, audit, notifications, policyEvidence, callbackOutbox, ecosystem, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build(),
                ledgerBaseUrl, ledgerCallbackToken, ledgerEnabled);
    }

    ExternalApprovalService(ExternalApprovalRepository repository, AuditLogService audit, NotificationService notifications,
                            HttpClient httpClient, String ledgerBaseUrl, String ledgerCallbackToken, boolean ledgerEnabled) {
        this(repository, audit, notifications, null, null, null, httpClient, ledgerBaseUrl, ledgerCallbackToken, ledgerEnabled);
    }

    ExternalApprovalService(ExternalApprovalRepository repository, AuditLogService audit, NotificationService notifications,
                            PolicyEvidenceService policyEvidence, ApprovalCallbackOutboxService callbackOutbox,
                            EcosystemRepository ecosystem, HttpClient httpClient, String ledgerBaseUrl, String ledgerCallbackToken, boolean ledgerEnabled) {
        this.repository = repository;
        this.audit = audit;
        this.notifications = notifications;
        this.policyEvidence = policyEvidence;
        this.callbackOutbox = callbackOutbox;
        this.ecosystem = ecosystem;
        this.httpClient = httpClient;
        this.ledgerBaseUrl = ledgerBaseUrl == null ? "" : ledgerBaseUrl.trim();
        this.ledgerCallbackToken = ledgerCallbackToken == null ? "" : ledgerCallbackToken.trim();
        this.ledgerEnabled = ledgerEnabled;
    }

    @Autowired(required = false)
    void setRag(ObsidianRagService rag) {
        this.rag = rag;
    }

    @Transactional
    public Map<String, Object> request(JsonNode body) {
        requireObject(body);
        String correlationId = requiredText(body, "correlationId");
        String transactionId = requiredText(body, "transactionId");
        Map<String, Object> duplicate = repository.findDuplicate(correlationId, transactionId);
        if (duplicate != null) {
            audit.recordEvent("external_approval_duplicate_received", "external_approval", string(duplicate.get("approval_request_id")), correlationId,
                    Map.of("source", optionalText(body, "source", "Archive-Ledger"), "transactionId", transactionId));
            return response(duplicate, true);
        }

        Map<String, Object> values = new LinkedHashMap<>();
        values.put("approval_request_id", nextApprovalId());
        values.put("source", optionalText(body, "source", "Archive-Ledger"));
        values.put("target_system_id", callbackValue(body, "targetSystemId", "archive-ledger"));
        values.put("correlation_id", correlationId);
        values.put("transaction_id", transactionId);
        values.put("amount", amount(body.get("amount")));
        values.put("currency", requiredText(body, "currency").toUpperCase(Locale.ROOT));
        values.put("reason", requiredText(body, "reason"));
        values.put("policy_question", optionalText(body, "policyQuestion", null));
        values.put("metadata", metadata(body.get("metadata")));
        values.put("callback_path", callbackValue(body, "callbackPath", "/api/approvals/callback"));
        values.put("source_service", optionalText(body, "sourceService", optionalText(body, "source", "Archive-Ledger")));
        values.put("callback_target", callbackValue(body, "targetSystemId", "archive-ledger"));
        values.put("route_plan_id", optionalText(body, "routePlanId", textFromMetadata(values.get("metadata"), "routePlanId")));
        values.put("event_id", optionalText(body, "eventId", textFromMetadata(values.get("metadata"), "eventId")));

        validateSynthetic(values);
        Map<String, Object> created = repository.createRequest(values);
        audit.recordEvent("external_approval_requested", "external_approval", string(created.get("approval_request_id")), correlationId,
                Map.of("source", values.get("source"), "targetSystemId", values.get("target_system_id"), "amount", values.get("amount"), "currency", values.get("currency")));
        generateEvidence(created);
        if (ecosystem != null) {
            ecosystem.recordTimeline(null, correlationId, string(values.get("source_service")), "APPROVAL_REQUESTED",
                    "external_approval", string(created.get("approval_request_id")),
                    "External approval request received from " + values.get("source_service"),
                    Map.of("transactionId", transactionId, "amount", values.get("amount"), "currency", values.get("currency")));
        }
        notifyRequested(created);
        return response(repository.detail(string(created.get("approval_request_id"))), false);
    }

    public List<Map<String, Object>> list(int limit) {
        return repository.list(limit).stream().map(request -> {
            Map<String, Object> value = new LinkedHashMap<>(request);
            value.put("priority", priority(request));
            value.put("evidence_type", repository.evidence(string(request.get("approval_request_id"))).stream()
                    .findFirst().map(item -> item.get("evidence_type")).orElse("RULE_FALLBACK"));
            return value;
        }).toList();
    }

    public List<Map<String, Object>> list(String status, String source, int limit) {
        return repository.list(status, source, limit).stream().map(request -> {
            Map<String, Object> value = new LinkedHashMap<>(request);
            value.put("priority", priority(request));
            value.put("evidence_type", repository.evidence(string(request.get("approval_request_id"))).stream()
                    .findFirst().map(item -> item.get("evidence_type")).orElse("RULE_FALLBACK"));
            return value;
        }).toList();
    }

    public Map<String, Object> summary() {
        return repository.summary();
    }

    public Map<String, Object> detail(String approvalRequestId) {
        Map<String, Object> detail = repository.detail(approvalRequestId);
        if (detail == null) throw new ExternalApprovalValidationException("External approval request not found.");
        detail.put("priority", priority(detail));
        detail.put("ledger_config", configStatus());
        return detail;
    }

    @Transactional
    public Map<String, Object> decide(String approvalRequestId, String decision, JsonNode body) {
        Map<String, Object> request = detail(approvalRequestId);
        String normalized = decision.toUpperCase(Locale.ROOT);
        if (!List.of("APPROVED", "REJECTED", "HOLD").contains(normalized)) throw new ExternalApprovalValidationException("Unsupported approval decision.");
        String comment = body != null && body.isObject() && body.has("comment") && body.get("comment").isTextual() ? body.get("comment").textValue().trim() : null;
        String actor = audit.actor().name();
        repository.insertDecision(approvalRequestId, normalized, actor, comment);
        repository.updateDecisionState(approvalRequestId, normalized, actor);
        audit.recordEvent("APPROVED".equals(normalized) ? "external_approval_approved" : "REJECTED".equals(normalized) ? "external_approval_rejected" : "external_approval_held",
                "external_approval", approvalRequestId, string(request.get("correlation_id")), Map.of("decision", normalized, "commentProvided", comment != null && !comment.isBlank()));
        if ("APPROVED".equals(normalized) || "REJECTED".equals(normalized)) {
            callback(approvalRequestId, normalized, actor, comment);
        }
        if (ecosystem != null) {
            ecosystem.recordTimeline(null, string(request.get("correlation_id")), "archiveos", "APPROVAL_" + normalized,
                    "external_approval", approvalRequestId, "External approval " + normalized,
                    Map.of("decision", normalized, "transactionId", request.get("transaction_id")));
        }
        if ("REJECTED".equals(normalized)) notifications.send("⛔ Ledger approval rejected: " + approvalRequestId);
        return detail(approvalRequestId);
    }

    public Map<String, Object> configStatus() {
        return Map.of(
                "enabled", ledgerEnabled,
                "baseUrlConfigured", !ledgerBaseUrl.isBlank(),
                "callbackTokenConfigured", !ledgerCallbackToken.isBlank(),
                "secrets", "hidden");
    }

    private void generateEvidence(Map<String, Object> request) {
        String question = string(request.get("policy_question"));
        if (rag != null && question != null && !question.isBlank()) {
            try {
                RagAnswer answer = rag.answer(question);
                repository.insertEvidence(string(request.get("approval_request_id")), "RAG", "Archive-Ledger policy RAG evidence",
                        answer.answer(), "obsidian://archive-ledger-policy", BigDecimal.valueOf(0.78));
                audit.recordEvent("external_approval_evidence_generated", "external_approval", string(request.get("approval_request_id")),
                        string(request.get("correlation_id")), Map.of("evidenceType", "RAG"));
                return;
            } catch (RuntimeException ignored) {
                // Fall through to deterministic evidence. Approval ingestion must not fail when AI/RAG is degraded.
            }
        }
        Map<String, Object> metadata = map(request.get("metadata"));
        Map<String, Object> fallback = policyEvidence == null ? Map.of("text", fallbackEvidence(request, metadata), "policy", "docs/policies/archive-ledger/high-value-maintenance-expense-policy.md")
                : policyEvidence.fallbackEvidence(request);
        String content = string(fallback.get("text"));
        String policy = string(fallback.get("policy"));
        repository.insertEvidence(string(request.get("approval_request_id")), "RULE_FALLBACK",
                "Synthetic Archive Platform fallback policy evidence", content,
                policy, BigDecimal.valueOf(0.64));
        if (policyEvidence != null) {
            String evidenceId = policyEvidence.snapshot(string(request.get("approval_request_id")), string(request.get("source_service")),
                    question == null ? "" : question, content, "RULE_FALLBACK", "FALLBACK", policy);
            repository.linkPolicyEvidence(string(request.get("approval_request_id")), evidenceId);
        }
        audit.recordEvent("external_approval_fallback_evidence_used", "external_approval", string(request.get("approval_request_id")),
                string(request.get("correlation_id")), Map.of("evidenceType", "RULE_FALLBACK"));
    }

    private String fallbackEvidence(Map<String, Object> request, Map<String, Object> metadata) {
        return "정책상 긴급 정비비 또는 고위험 정비 비용이 3,000,000원을 초과하거나 severity가 HIGH 이상이면 PM 승인 대상입니다. "
                + "해당 synthetic 거래는 " + request.get("amount") + " " + request.get("currency")
                + ", severity " + metadata.getOrDefault("severity", "UNKNOWN")
                + " 조건에 해당하므로 APPROVAL_REQUIRED 상태로 분류됩니다.";
    }

    private void callback(String approvalRequestId, String decision, String actor, String comment) {
        Map<String, Object> request = repository.find(approvalRequestId);
        String correlationId = string(request.get("correlation_id"));
        Map<String, Object> body = Map.of(
                "approvalRequestId", approvalRequestId,
                "transactionId", request.get("transaction_id"),
                "decision", decision,
                "decidedBy", actor,
                "comment", comment == null ? "" : comment,
                "decidedAt", Instant.now().toString(),
                "correlationId", correlationId);
        if (callbackOutbox != null) {
            String sourceService = string(request.get("source_service"));
            if (sourceService == null || sourceService.isBlank()) sourceService = "Archive-Ledger";
            Map<String, Object> outbox = callbackOutbox.enqueueLedgerCallback(approvalRequestId, sourceService, body);
            String outboxStatus = string(outbox.get("status"));
            String callbackStatus = "SENT".equals(outboxStatus) ? "CALLBACK_SUCCEEDED" : "SKIPPED".equals(outboxStatus) ? "CALLBACK_SKIPPED" : "CALLBACK_FAILED";
            repository.insertCallback(approvalRequestId, "archive-ledger", masked(string(outbox.get("target_url"))), callbackStatus, integer(outbox.get("retry_count")), string(outbox.get("last_error")), "SENT".equals(outboxStatus));
            repository.updateCallbackState(approvalRequestId, callbackStatus, integer(outbox.get("retry_count")), string(outbox.get("last_error")));
            audit.recordEvent("ledger_callback_attempted", "external_approval", approvalRequestId, correlationId, Map.of("status", callbackStatus, "callbackId", outbox.get("callback_id")));
            return;
        }
        if (!ledgerEnabled || ledgerBaseUrl.isBlank()) {
            repository.insertCallback(approvalRequestId, "archive-ledger", null, "CALLBACK_PENDING", 0, "ARCHIVE_LEDGER_BASE_URL is not configured.", false);
            repository.updateCallbackState(approvalRequestId, "CALLBACK_PENDING", 0, "ARCHIVE_LEDGER_BASE_URL is not configured.");
            audit.recordEvent("ledger_callback_attempted", "external_approval", approvalRequestId, correlationId, Map.of("status", "CALLBACK_PENDING", "reason", "not_configured"));
            return;
        }
        String path = string(request.get("callback_path"));
        String url = ledgerBaseUrl + (path == null || path.isBlank() ? "/api/approvals/callback" : path);
        audit.recordEvent("ledger_callback_attempted", "external_approval", approvalRequestId, correlationId, Map.of("targetSystemId", "archive-ledger"));
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)));
            if (!ledgerCallbackToken.isBlank()) builder.header("X-Archive-Ledger-Callback-Token", ledgerCallbackToken);
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                boolean recovered = "CALLBACK_FAILED".equals(request.get("callback_status"));
                repository.insertCallback(approvalRequestId, "archive-ledger", masked(url), "CALLBACK_SUCCEEDED", 1, null, true);
                repository.updateCallbackState(approvalRequestId, "CALLBACK_SUCCEEDED", 1, null);
                audit.recordEvent("ledger_callback_succeeded", "external_approval", approvalRequestId, correlationId, Map.of("statusCode", response.statusCode()));
                if (recovered) notifications.send("✅ Ledger callback recovered: " + approvalRequestId);
            } else {
                callbackFailed(approvalRequestId, correlationId, url, "HTTP " + response.statusCode());
            }
        } catch (Exception error) {
            callbackFailed(approvalRequestId, correlationId, url, error.getClass().getSimpleName());
        }
    }

    private void callbackFailed(String approvalRequestId, String correlationId, String url, String error) {
        repository.insertCallback(approvalRequestId, "archive-ledger", masked(url), "CALLBACK_FAILED", 1, error, false);
        repository.updateCallbackState(approvalRequestId, "CALLBACK_FAILED", 1, error);
        audit.recordEvent("ledger_callback_failed", "external_approval", approvalRequestId, correlationId, Map.of("status", "CALLBACK_FAILED", "error", error));
        notifications.send("⚠️ Ledger callback failed: " + approvalRequestId);
    }

    private Map<String, Object> response(Map<String, Object> request, boolean duplicate) {
        return Map.of(
                "ok", true,
                "duplicate", duplicate,
                "approvalRequestId", request.get("approval_request_id"),
                "status", request.get("status"),
                "correlationId", request.get("correlation_id"));
    }

    private void notifyRequested(Map<String, Object> request) {
        String priority = priority(request);
        notifications.send("🧾 Ledger approval required (" + priority + "): " + request.get("transaction_id") + " " + request.get("amount") + " " + request.get("currency"));
    }

    private String priority(Map<String, Object> request) {
        Map<String, Object> metadata = map(request.get("metadata"));
        String severity = String.valueOf(metadata.getOrDefault("severity", "")).toUpperCase(Locale.ROOT);
        BigDecimal amount = amountObject(request.get("amount"));
        if ("CRITICAL".equals(severity)) return "critical";
        if ("HIGH".equals(severity) || amount.compareTo(HIGH_AMOUNT_THRESHOLD) >= 0) return "high";
        return "medium";
    }

    private void validateSynthetic(Map<String, Object> values) {
        String source = string(values.get("source")).toLowerCase(Locale.ROOT);
        if (!source.contains("ledger") && !source.contains("logitics") && !source.contains("logistics") && !source.contains("nexus")) {
            throw new ExternalApprovalValidationException("source must identify Archive-Ledger, Archive-Logitics, or Archive-Nexus.");
        }
        Map<String, Object> metadata = map(values.get("metadata"));
        List<String> forbidden = List.of("cardNumber", "accountNumber", "residentRegistrationNumber", "phoneNumber", "ssn", "rrn");
        for (String key : forbidden) {
            if (metadata.containsKey(key)) throw new ExternalApprovalValidationException("Real personal or financial identifiers are not allowed.");
        }
    }

    private void requireObject(JsonNode body) {
        if (body == null || !body.isObject()) throw new ExternalApprovalValidationException("Request body must be a JSON object.");
    }

    private String requiredText(JsonNode body, String name) {
        JsonNode value = body.get(name);
        if (value == null || !value.isTextual() || value.textValue().trim().isEmpty()) {
            throw new ExternalApprovalValidationException(name + " is required.");
        }
        return value.textValue().trim();
    }

    private String optionalText(JsonNode body, String name, String fallback) {
        JsonNode value = body.get(name);
        return value == null || value.isNull() ? fallback : value.asText(fallback).trim();
    }

    private String callbackValue(JsonNode body, String name, String fallback) {
        JsonNode callback = body.get("callback");
        if (callback == null || !callback.isObject()) return fallback;
        JsonNode value = callback.get(name);
        return value == null || value.isNull() ? fallback : value.asText(fallback).trim();
    }

    private BigDecimal amount(JsonNode node) {
        if (node == null || !node.isNumber()) throw new ExternalApprovalValidationException("amount must be a number.");
        return node.decimalValue();
    }

    private Map<String, Object> metadata(JsonNode node) {
        if (node == null || node.isNull()) return Map.of();
        if (!node.isObject()) throw new ExternalApprovalValidationException("metadata must be an object.");
        Map<String, Object> value = new LinkedHashMap<>();
        node.fields().forEachRemaining(entry -> {
            JsonNode item = entry.getValue();
            if (item.isTextual()) value.put(entry.getKey(), item.textValue());
            else if (item.isNumber()) value.put(entry.getKey(), item.numberValue());
            else if (item.isBoolean()) value.put(entry.getKey(), item.booleanValue());
            else value.put(entry.getKey(), item.toString());
        });
        return value;
    }

    private String nextApprovalId() {
        String day = DateTimeFormatter.BASIC_ISO_DATE.withZone(ZoneOffset.UTC).format(Instant.now());
        return "APR-" + day + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private String masked(String url) {
        try {
            URI uri = URI.create(url);
            return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > -1 ? ":****" : "") + uri.getPath();
        } catch (Exception ignored) {
            return "configured://archive-ledger/callback";
        }
    }

    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private BigDecimal amountObject(Object value) { return value instanceof BigDecimal decimal ? decimal : value instanceof Number number ? BigDecimal.valueOf(number.doubleValue()) : BigDecimal.ZERO; }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private int integer(Object value) { return value instanceof Number n ? n.intValue() : 0; }
    private String textFromMetadata(Object metadata, String key) {
        Object value = map(metadata).get(key);
        return value == null ? null : String.valueOf(value);
    }
}
