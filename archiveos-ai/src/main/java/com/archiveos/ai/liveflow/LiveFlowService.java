package com.archiveos.ai.liveflow;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import com.archiveos.ai.approval.callback.ApprovalCallbackOutboxRepository;
import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.ecosystem.EcosystemService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LiveFlowService {
    private final LiveFlowRepository repository;
    private final EcosystemService ecosystem;
    private final ExternalApprovalRepository approvals;
    private final ApprovalCallbackOutboxRepository callbacks;
    private final AuditLogService audit;

    public LiveFlowService(LiveFlowRepository repository, EcosystemService ecosystem,
                           ExternalApprovalRepository approvals, ApprovalCallbackOutboxRepository callbacks,
                           AuditLogService audit) {
        this.repository = repository;
        this.ecosystem = ecosystem;
        this.approvals = approvals;
        this.callbacks = callbacks;
        this.audit = audit;
    }

    public Map<String, Object> summary() {
        Map<String, Object> value = new LinkedHashMap<>(repository.summary());
        value.put("mode", "LIVE");
        value.put("dataPolicy", "Synthetic Runtime Events");
        value.put("warning", "No real customer, payment, account, or financial data.");
        value.put("recent", repository.recent(12));
        return value;
    }

    public Map<String, Object> topology() {
        return Map.of(
                "nodes", List.of(
                        node("market", "Archive-Market", "source", 10, 38),
                        node("logistics", "Archive-Logistics", "flow", 34, 30),
                        node("nexus", "Archive-Nexus", "factory", 34, 68),
                        node("ledger", "Archive-Ledger", "financial", 62, 38),
                        node("archiveos", "ArchiveOS Control Tower", "control", 84, 38),
                        node("settlement", "Settlement", "batch", 84, 70)),
                "lanes", List.of("Market", "Logistics", "Factory", "Ledger", "Control", "Settlement"),
                "edges", List.of(
                        edge("market", "logistics", "shipment request"),
                        edge("market", "ledger", "sales / refund / claim"),
                        edge("logistics", "ledger", "logistics cost"),
                        edge("nexus", "ledger", "manufacturing cost"),
                        edge("ledger", "archiveos", "approval request"),
                        edge("archiveos", "ledger", "approval callback"),
                        edge("ledger", "settlement", "daily settlement")));
    }

    public Map<String, Object> recent(int limit) { return Map.of("data", repository.recent(limit)); }
    public Map<String, Object> replay(String from, String to, int limit) { return Map.of("mode", "REPLAY", "data", repository.replay(from, to, limit)); }
    public Map<String, Object> correlation(String correlationId) { return Map.of("correlationId", correlationId, "data", repository.byCorrelation(correlationId, 200)); }
    public Map<String, Object> entity(String entityId) { return Map.of("entityId", entityId, "data", repository.byEntity(entityId, 200)); }

    @Transactional
    public Map<String, Object> refresh() {
        String traceId = "flow-" + UUID.randomUUID().toString().substring(0, 8);
        audit.recordEvent("live_flow_refresh_requested", "live_flow", traceId, traceId, Map.of("mode", "LIVE"));
        List<Map<String, Object>> saved = new ArrayList<>();
        try {
            try {
                Map<String, Object> ecosystemSummary = ecosystem.summary();
                Map<String, Object> services = map(ecosystemSummary.get("services"));
                collectServiceSnapshots(saved, services);
            } catch (RuntimeException collectorError) {
                saved.add(repository.upsert(event("flow-collector-degraded-" + traceId, traceId, "archiveos", "archiveos",
                        "FLOW_COLLECTOR_DEGRADED", "audit", traceId, "archiveos", "archiveos", "unavailable", "warning",
                        "Live Flow collector degraded: " + collectorError.getClass().getSimpleName(),
                        null, Map.of("riskLevel", "WARNING", "syntheticData", true))));
                audit.recordEvent("flow_collector_degraded", "live_flow", traceId, traceId,
                        Map.of("error", collectorError.getClass().getSimpleName()));
            }
            collectApprovals(saved);
            collectCallbacks(saved);
            Map<String, Object> result = new LinkedHashMap<>(summary());
            result.put("traceId", traceId);
            result.put("collected", saved.size());
            audit.recordEvent("live_flow_refresh_completed", "live_flow", traceId, traceId,
                    Map.of("collected", saved.size(), "status", result.get("active_flows")));
            return result;
        } catch (RuntimeException error) {
            audit.recordEvent("live_flow_refresh_failed", "live_flow", traceId, traceId,
                    Map.of("error", error.getClass().getSimpleName()));
            throw error;
        }
    }

    private void collectServiceSnapshots(List<Map<String, Object>> saved, Map<String, Object> services) {
        for (String key : List.of("market", "logitics", "nexus", "ledger")) {
            Map<String, Object> service = map(services.get(key));
            if (service.isEmpty()) continue;
            String status = lower(string(service.get("status"), "unknown"));
            if ("unavailable".equals(status) || "degraded".equals(status) || "unknown".equals(status)) {
                saved.add(repository.upsert(event(key + "-availability-" + status, "health-" + key, systemId(key), domain(key),
                        "SERVICE_" + status.toUpperCase(Locale.ROOT), "audit", key, nodeOf(key), "archiveos",
                        "unavailable".equals(status) ? "unavailable" : "waiting",
                        "unavailable".equals(status) ? "critical" : "warning",
                        service.getOrDefault("name", key) + " " + status,
                        null, Map.of("serviceStatus", status, "syntheticData", true))));
            } else {
                collectHealthyService(saved, key, service);
            }
        }
    }

    private void collectHealthyService(List<Map<String, Object>> saved, String key, Map<String, Object> service) {
        Map<String, Object> summary = map(service.get("summary"));
        if ("market".equals(key)) {
            Map<String, Object> orders = map(summary.get("orders"));
            long total = number(orders.get("total"));
            if (total > 0) {
                saved.add(repository.upsert(event("market-orders-" + total, "market-orders", "archive-market", "market",
                        "MARKET_ORDERS_OBSERVED", "order", "market-orders", "market", "logistics", "created", "info",
                        "Market orders observed: " + total, bucket(summary.get("totalRevenue")),
                        Map.of("orderId", "market-orders", "orderCount", total, "riskLevel", string(summary.get("bankruptcyRisk"), "UNKNOWN"), "syntheticData", true))));
            }
        }
        if ("logitics".equals(key)) {
            Map<String, Object> outbox = map(summary.get("outbox"));
            Map<String, Object> risk = map(summary.get("risk"));
            long delayed = number(risk.get("delayedRoutes"));
            if (delayed > 0) {
                saved.add(repository.upsert(event("logistics-delayed-" + delayed, "logistics-routes", "archive-logistics", "logistics",
                        "DELIVERY_DELAYED", "route", "logistics-delayed-routes", "logistics", "ledger", "delayed", "warning",
                        "Delayed logistics routes: " + delayed, null,
                        Map.of("routeId", "delayed-routes", "riskLevel", "WARNING", "syntheticData", true))));
            }
            long failed = number(outbox.get("failed"));
            if (failed > 0) unavailable(saved, "archive-logistics", "logistics", "LOGISTICS_OUTBOX_FAILED", "callback", "logistics", failed);
        }
        if ("nexus".equals(key)) {
            long pending = number(summary.get("pending"));
            if (pending > 0) {
                saved.add(repository.upsert(event("nexus-outbox-pending-" + pending, "nexus-outbox", "archive-nexus", "nexus",
                        "NEXUS_OUTBOX_PENDING", "factory", "nexus-outbox", "nexus", "ledger", "waiting", "info",
                        "Nexus outbox pending: " + pending, null, Map.of("factoryId", "nexus-factory", "syntheticData", true))));
            }
        }
        if ("ledger".equals(key)) {
            long approvals = number(summary.get("approvalRequired"));
            if (approvals > 0) {
                saved.add(repository.upsert(event("ledger-approvals-" + approvals, "ledger-approval", "archive-ledger", "ledger",
                        "APPROVAL_REQUIRED", "approval", "ledger-approval-required", "ledger", "archiveos", "approval_required", "warning",
                        "Ledger approvals required: " + approvals, null, Map.of("approvalRequestId", "ledger-approval-required", "riskLevel", "WARNING", "syntheticData", true))));
            }
        }
    }

    private void collectApprovals(List<Map<String, Object>> saved) {
        for (Map<String, Object> approval : approvals.pending(50)) {
            String approvalId = string(approval.get("approval_request_id"), "approval");
            Map<String, Object> metadata = map(approval.get("metadata"));
            saved.add(repository.upsert(event("approval-" + approvalId, string(approval.get("correlation_id"), approvalId),
                    systemIdForSource(string(approval.get("source_service"), "ArchiveOS")), "archiveos",
                    "APPROVAL_REQUESTED", "approval", approvalId, "ledger", "archiveos", "approval_required",
                    severity(metadata), "Approval required: " + string(approval.get("transaction_id"), approvalId),
                    bucket(approval.get("amount")), allowMetadata(metadata, Map.of("approvalRequestId", approvalId,
                            "transactionId", string(approval.get("transaction_id"), approvalId),
                            "riskLevel", severity(metadata), "syntheticData", true)))));
        }
    }

    private void collectCallbacks(List<Map<String, Object>> saved) {
        for (Map<String, Object> callback : callbacks.list(50)) {
            String status = lower(string(callback.get("status"), "PENDING"));
            if (!List.of("FAILED", "RETRY", "PENDING", "failed", "retry", "pending").contains(status) && !"SENT".equalsIgnoreCase(status)) continue;
            String callbackId = string(callback.get("callback_id"), "callback");
            saved.add(repository.upsert(event("callback-" + callbackId, callbackId, "archiveos", "archiveos",
                    "CALLBACK_" + status.toUpperCase(Locale.ROOT), "callback", callbackId, "archiveos", "ledger",
                    "failed".equals(status) ? "failed" : "sent".equals(status) ? "completed" : "waiting",
                    "failed".equals(status) ? "critical" : "info", "Approval callback " + status,
                    null, Map.of("approvalRequestId", string(callback.get("approval_request_id"), ""),
                            "riskLevel", "failed".equals(status) ? "CRITICAL" : "INFO", "syntheticData", true))));
        }
    }

    private void unavailable(List<Map<String, Object>> saved, String systemId, String domain, String type, String entityType, String node, long count) {
        saved.add(repository.upsert(event(type + "-" + count, type, systemId, domain, type, entityType, type, node, "archiveos",
                "failed", "critical", type + ": " + count, null, Map.of("riskLevel", "CRITICAL", "syntheticData", true))));
    }

    private LiveFlowEvent event(String eventId, String correlationId, String sourceSystem, String domain, String eventType,
                                String entityType, String entityId, String from, String to, String status, String severity,
                                String label, String amountBucket, Map<String, Object> metadata) {
        return new LiveFlowEvent(eventId, correlationId, sourceSystem, null, domain, eventType, entityType, entityId,
                from, to, status, severity, label, amountBucket, Instant.now(), allowMetadata(metadata, Map.of("syntheticData", true)));
    }

    private Map<String, Object> node(String id, String label, String type, int x, int y) {
        return Map.of("id", id, "label", label, "type", type, "x", x, "y", y);
    }
    private Map<String, Object> edge(String from, String to, String label) { return Map.of("from", from, "to", to, "label", label); }

    private String systemId(String key) {
        return switch (key) {
            case "market" -> "archive-market";
            case "logitics" -> "archive-logistics";
            case "nexus" -> "archive-nexus";
            case "ledger" -> "archive-ledger";
            default -> "archiveos";
        };
    }
    private String domain(String key) { return "logitics".equals(key) ? "logistics" : key; }
    private String nodeOf(String key) { return "logitics".equals(key) ? "logistics" : key; }
    private String systemIdForSource(String source) {
        String lower = source.toLowerCase(Locale.ROOT);
        if (lower.contains("market")) return "archive-market";
        if (lower.contains("logit")) return "archive-logistics";
        if (lower.contains("nexus")) return "archive-nexus";
        if (lower.contains("ledger")) return "archive-ledger";
        return "archiveos";
    }
    private String severity(Map<String, Object> metadata) {
        String severity = string(metadata.get("severity"), "info").toLowerCase(Locale.ROOT);
        if ("critical".equals(severity)) return "critical";
        if ("high".equals(severity)) return "warning";
        return severity;
    }
    private String bucket(Object value) {
        BigDecimal amount = decimal(value);
        if (amount.compareTo(BigDecimal.valueOf(10_000_000)) >= 0) return "critical";
        if (amount.compareTo(BigDecimal.valueOf(3_000_000)) >= 0) return "high";
        if (amount.compareTo(BigDecimal.valueOf(500_000)) >= 0) return "medium";
        if (amount.compareTo(BigDecimal.ZERO) > 0) return "small";
        return null;
    }
    private BigDecimal decimal(Object value) {
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        try { return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException error) { return BigDecimal.ZERO; }
    }
    private long number(Object value) {
        if (value instanceof Number number) return number.longValue();
        try { return value == null ? 0 : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException error) { return 0; }
    }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private String string(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private String lower(String value) { return value == null ? "" : value.toLowerCase(Locale.ROOT); }

    private Map<String, Object> allowMetadata(Map<String, Object> input, Map<String, Object> defaults) {
        Map<String, Object> value = new LinkedHashMap<>(defaults);
        if (input == null) return value;
        for (String key : List.of("syntheticBuyerId", "syntheticSellerId", "orderId", "shipmentId", "routeId",
                "truckId", "factoryId", "equipmentId", "vendorId", "transactionId", "approvalRequestId",
                "amountRange", "riskLevel", "syntheticData", "orderCount")) {
            if (input.containsKey(key)) value.put(key, input.get(key));
        }
        return value;
    }
}
