package com.archiveos.ai.liveflow;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import com.archiveos.ai.approval.callback.ApprovalCallbackOutboxRepository;
import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.ecosystem.EcosystemService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LiveFlowService {
    private final LiveFlowRepository repository;
    private final EcosystemService ecosystem;
    private final ExternalApprovalRepository approvals;
    private final ApprovalCallbackOutboxRepository callbacks;
    private final AuditLogService audit;
    private volatile Instant lastAutoRefreshAt = Instant.EPOCH;
    private static final Duration AUTO_REFRESH_INTERVAL = Duration.ofSeconds(1);
    private static final long LIVE_THRESHOLD_SECONDS = 60;
    private static final long STALE_THRESHOLD_SECONDS = 300;

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
        ensureFresh();
        return summarySnapshot();
    }

    private Map<String, Object> summarySnapshot() {
        Map<String, Object> value = new LinkedHashMap<>(repository.summary());
        List<Map<String, Object>> recent = repository.recent(12);
        value.put("mode", "LIVE");
        value.put("dataPolicy", "Synthetic Runtime Events");
        value.put("warning", "No real customer, payment, account, or financial data.");
        value.put("recent", recent);
        Map<String, Object> runtime = runtimeSummary(value, recent);
        value.put("runtime", runtime);
        Map<String, Object> approvalSummary = approvals.summary();
        value.put("approvalBacklog", approvalSummary.containsKey("pending") ? number(approvalSummary.get("pending")) : null);
        value.put("approvalBacklogSource", "current synthetic approval queue");
        value.put("processingBacklog", processingBacklog(runtime));
        value.put("processingBacklogSource", "current service outbox and processing backlog");
        return value;
    }

    public Map<String, Object> topology() {
        return Map.of(
                "nodes", List.of(
                        node("market", "Archive-Market", "source", 10, 22),
                        node("nexus", "Archive-Nexus", "factory", 42, 22),
                        node("logistics", "Archive-Logistics", "flow", 76, 22),
                        node("ledger", "Archive-Ledger", "financial", 22, 70),
                        node("archiveos", "ArchiveOS Control Tower", "control", 52, 70),
                        node("settlement", "Settlement", "batch", 84, 70)),
                "lanes", List.of("Demand", "Manufacturing", "Logistics", "Finance", "Control", "Settlement"),
                "edges", List.of(
                        edge("market", "nexus", "production / shipment request"),
                        edge("market", "ledger", "sales / refund / claim"),
                        edge("nexus", "logistics", "shipment / route"),
                        edge("logistics", "ledger", "logistics cost"),
                        edge("nexus", "ledger", "manufacturing cost"),
                        edge("ledger", "archiveos", "approval request"),
                        edge("archiveos", "ledger", "approval callback"),
                        edge("ledger", "settlement", "daily settlement"),
                        edge("archiveos", "settlement", "settlement control"),
                        edge("market", "archiveos", "health / summary"),
                        edge("nexus", "archiveos", "health / summary"),
                        edge("logistics", "archiveos", "health / summary"),
                        edge("ledger", "archiveos", "health / summary")));
    }

    public Map<String, Object> recent(int limit) {
        ensureFresh();
        return Map.of("data", repository.recent(limit));
    }
    public Map<String, Object> replay(String from, String to, int limit) { return Map.of("mode", "REPLAY", "data", repository.replay(from, to, limit)); }
    public Map<String, Object> correlation(String correlationId) { return Map.of("correlationId", correlationId, "data", repository.byCorrelation(correlationId, 200)); }
    public Map<String, Object> entity(String entityId) { return Map.of("entityId", entityId, "data", repository.byEntity(entityId, 200)); }

    @Transactional
    public Map<String, Object> refresh() {
        return refresh(true);
    }

    /** Read-only external collector used when upstream systems do not expose a push/cursor feed yet. */
    @Scheduled(fixedDelayString = "${archive.live-flow.collector-interval-ms:1000}")
    public void collectRealtime() {
        try {
            refresh(false);
        } catch (RuntimeException ignored) {
            // The collector records degraded events inside refresh; scheduler threads must remain alive.
        }
    }

    private Map<String, Object> refresh(boolean auditEnabled) {
        String traceId = "flow-" + UUID.randomUUID().toString().substring(0, 8);
        if (auditEnabled) audit.recordEvent("live_flow_refresh_requested", "live_flow", traceId, traceId, Map.of("mode", "LIVE"));
        List<Map<String, Object>> saved = new ArrayList<>();
        try {
            try {
                Map<String, Object> ecosystemSummary = ecosystem.refresh();
                Map<String, Object> services = map(ecosystemSummary.get("services"));
                collectServiceSnapshots(saved, services);
            } catch (RuntimeException collectorError) {
                saved.add(repository.upsert(event("flow-collector-degraded-" + traceId, traceId, "archiveos", "archiveos",
                        "FLOW_COLLECTOR_DEGRADED", "audit", traceId, "archiveos", "archiveos", "unavailable", "warning",
                        "Live Flow collector degraded: " + collectorError.getClass().getSimpleName(),
                        null, Map.of("riskLevel", "WARNING", "syntheticData", true))));
                if (auditEnabled) audit.recordEvent("flow_collector_degraded", "live_flow", traceId, traceId,
                        Map.of("error", collectorError.getClass().getSimpleName()));
            }
            collectApprovals(saved);
            collectCallbacks(saved);
            Map<String, Object> result = new LinkedHashMap<>(summarySnapshot());
            result.put("traceId", traceId);
            result.put("collected", saved.size());
            if (auditEnabled) audit.recordEvent("live_flow_refresh_completed", "live_flow", traceId, traceId,
                    Map.of("collected", saved.size(), "status", result.get("active_flows")));
            return result;
        } catch (RuntimeException error) {
            if (auditEnabled) audit.recordEvent("live_flow_refresh_failed", "live_flow", traceId, traceId,
                    Map.of("error", error.getClass().getSimpleName()));
            throw error;
        }
    }

    private void ensureFresh() {
        Instant now = Instant.now();
        if (Duration.between(lastAutoRefreshAt, now).compareTo(AUTO_REFRESH_INTERVAL) < 0) return;
        synchronized (this) {
            now = Instant.now();
            if (Duration.between(lastAutoRefreshAt, now).compareTo(AUTO_REFRESH_INTERVAL) < 0) return;
            lastAutoRefreshAt = now;
        }
        try {
            refresh();
        } catch (RuntimeException error) {
            audit.recordEvent("live_flow_auto_refresh_failed", "live_flow", "auto-refresh", "auto-refresh",
                    Map.of("error", error.getClass().getSimpleName()));
        }
    }

    private Map<String, Object> runtimeSummary(Map<String, Object> summary, List<Map<String, Object>> recent) {
        Map<String, Instant> latestByNode = latestByNode(recent);
        Instant latest = parseInstant(summary.get("latest_event_at"));
        if (latest == null) {
            latest = latestByNode.values().stream().max(Instant::compareTo).orElse(null);
        }
        String freshness = freshness(latest);
        List<Map<String, Object>> serviceStates = new ArrayList<>();
        List<String> activeServices = new ArrayList<>();
        List<String> stalledServices = new ArrayList<>();
        try {
            Map<String, Object> ecosystemSummary = ecosystem.summary();
            Map<String, Object> services = map(ecosystemSummary.get("services"));
            for (String key : List.of("market", "nexus", "logitics", "ledger")) {
                Map<String, Object> state = runtimeServiceState(key, map(services.get(key)), latestByNode.get(nodeOf(key)));
                serviceStates.add(state);
                String runtimeStatus = string(state.get("runtimeStatus"), "UNKNOWN");
                String serviceName = string(state.get("serviceName"), systemId(key));
                if (List.of("PROCESSING", "WAITING", "HEALTHY").contains(runtimeStatus)) activeServices.add(serviceName);
                if ("STALLED".equals(runtimeStatus)) stalledServices.add(serviceName);
            }
            Map<String, Object> archiveOs = archiveOsRuntimeState(latestByNode.get("archiveos"));
            serviceStates.add(archiveOs);
            if (List.of("PROCESSING", "WAITING", "HEALTHY").contains(string(archiveOs.get("runtimeStatus"), ""))) activeServices.add("ArchiveOS");
            if ("STALLED".equals(string(archiveOs.get("runtimeStatus"), ""))) stalledServices.add("ArchiveOS");
        } catch (RuntimeException error) {
            stalledServices.add("ArchiveOS collector");
        }
        String pipelineStatus = "NO_RUNTIME_EVENTS".equals(freshness) ? "NO_RUNTIME_EVENTS"
                : !stalledServices.isEmpty() ? "DEGRADED"
                : freshness;
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("activeServices", activeServices);
        value.put("stalledServices", stalledServices);
        value.put("latestEventAt", latest == null ? null : latest.toString());
        value.put("staleThresholdSeconds", STALE_THRESHOLD_SECONDS);
        value.put("freshnessStatus", freshness);
        value.put("pipelineStatus", pipelineStatus);
        value.put("reason", runtimeReason(freshness, stalledServices));
        value.put("services", serviceStates);
        return value;
    }

    @SuppressWarnings("unchecked")
    private Long processingBacklog(Map<String, Object> runtime) {
        Object values = runtime.get("services");
        if (!(values instanceof List<?> services)) return null;
        long total = 0;
        boolean available = false;
        for (Object item : services) {
            if (!(item instanceof Map<?, ?> state)) continue;
            Object status = state.get("serviceStatus");
            if ("UNAVAILABLE".equalsIgnoreCase(String.valueOf(status)) || "DISABLED".equalsIgnoreCase(String.valueOf(status))) continue;
            Object backlog = state.get("backlogCount");
            if (backlog == null) continue;
            total += number(backlog);
            available = true;
        }
        return available ? total : null;
    }

    private Map<String, Object> runtimeServiceState(String key, Map<String, Object> service, Instant latestNodeEventAt) {
        String serviceStatus = string(service.get("status"), "UNKNOWN");
        Map<String, Object> summary = map(service.get("summary"));
        Map<String, Object> body = responseData(summary);
        Map<String, Object> operations = responseData(map(summary.get("operations")));
        Map<String, Object> runtime = firstMap(body, "runtime", "pipeline", "scheduler");
        Map<String, Object> outbox = firstMap(body, "outbox", "outboxSummary");
        Instant lastEventAt = firstInstant(
                runtime.get("lastEventAt"), runtime.get("lastWorkAt"),
                body.get("latestEventAt"), body.get("lastEventAt"), body.get("lastWorkAt"),
                operations.get("latestEventAt"), operations.get("lastEventAt"), operations.get("lastWorkAt"),
                latestNodeEventAt);
        String schedulerStatus = string(firstNonNull(runtime.get("schedulerStatus"), body.get("schedulerStatus")), "");
        String pipelineStatus = string(firstNonNull(runtime.get("pipelineStatus"), body.get("pipelineStatus")), "");
        boolean runtimeActive = bool(firstNonNull(runtime.get("runtimeActive"), body.get("runtimeActive")));
        boolean autoRunEnabled = bool(firstNonNull(runtime.get("autoRunEnabled"), body.get("autoRunEnabled")));
        long produced = number(runtime.get("eventsProducedLastTick"));
        long consumed = number(runtime.get("eventsConsumedLastTick"));
        long backlog = number(firstNonNull(runtime.get("backlogCount"), body.get("backlogCount"), outbox.get("pending")));
        String runtimeStatus = runtimeStatus(serviceStatus, lastEventAt, schedulerStatus, pipelineStatus, runtimeActive, produced, consumed);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("serviceId", systemId(key));
        value.put("serviceName", string(service.get("name"), systemId(key)));
        value.put("serviceStatus", serviceStatus);
        value.put("runtimeStatus", runtimeStatus);
        value.put("lastEventAt", lastEventAt == null ? null : lastEventAt.toString());
        value.put("lastWorkAt", string(firstNonNull(runtime.get("lastWorkAt"), body.get("lastWorkAt")), null));
        value.put("runtimeActive", runtimeActive);
        value.put("autoRunEnabled", autoRunEnabled);
        value.put("eventsProducedLastTick", produced);
        value.put("eventsConsumedLastTick", consumed);
        value.put("backlogCount", backlog);
        value.put("schedulerStatus", schedulerStatus);
        value.put("pipelineStatus", pipelineStatus);
        value.put("reason", runtimeStatusReason(runtimeStatus, serviceStatus, lastEventAt, schedulerStatus, backlog));
        return value;
    }

    private Map<String, Object> archiveOsRuntimeState(Instant latestNodeEventAt) {
        String runtimeStatus = runtimeStatus("HEALTHY", latestNodeEventAt, "RUNNING", "LIVE_FLOW_COLLECTING", true, 0, 0);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("serviceId", "archiveos");
        value.put("serviceName", "ArchiveOS");
        value.put("serviceStatus", "HEALTHY");
        value.put("runtimeStatus", runtimeStatus);
        value.put("lastEventAt", latestNodeEventAt == null ? null : latestNodeEventAt.toString());
        value.put("lastWorkAt", latestNodeEventAt == null ? null : latestNodeEventAt.toString());
        value.put("runtimeActive", true);
        value.put("autoRunEnabled", true);
        value.put("eventsProducedLastTick", 0);
        value.put("eventsConsumedLastTick", 0);
        value.put("backlogCount", 0);
        value.put("schedulerStatus", "RUNNING");
        value.put("pipelineStatus", "LIVE_FLOW_COLLECTING");
        value.put("reason", runtimeStatusReason(runtimeStatus, "HEALTHY", latestNodeEventAt, "RUNNING", 0));
        return value;
    }

    private String runtimeStatus(String serviceStatus, Instant lastEventAt, String schedulerStatus, String pipelineStatus,
                                 boolean runtimeActive, long produced, long consumed) {
        if ("UNAVAILABLE".equalsIgnoreCase(serviceStatus) || "FAILED".equalsIgnoreCase(serviceStatus)) return "FAILED";
        if ("DEGRADED".equalsIgnoreCase(serviceStatus)) return "WARNING";
        long age = ageSeconds(lastEventAt);
        boolean explicitRunning = runtimeActive || "RUNNING".equalsIgnoreCase(schedulerStatus) || pipelineStatus.toUpperCase(Locale.ROOT).contains("LIVE");
        boolean tickMoved = produced > 0 || consumed > 0;
        if (age >= 0 && age <= LIVE_THRESHOLD_SECONDS) return tickMoved || explicitRunning ? "PROCESSING" : "HEALTHY";
        if (age >= 0 && age <= STALE_THRESHOLD_SECONDS) return "WAITING";
        return "STALLED";
    }

    private String freshness(Instant latest) {
        long age = ageSeconds(latest);
        if (age < 0) return "NO_RUNTIME_EVENTS";
        if (age <= LIVE_THRESHOLD_SECONDS) return "LIVE";
        if (age <= STALE_THRESHOLD_SECONDS) return "SLOW";
        return "STALE";
    }

    private String runtimeReason(String freshness, List<String> stalledServices) {
        if ("NO_RUNTIME_EVENTS".equals(freshness)) return "No recent runtime events have been collected.";
        if ("STALE".equals(freshness)) return "Latest runtime event is older than the stale threshold.";
        if ("SLOW".equals(freshness)) return "Runtime events are arriving slowly.";
        if (!stalledServices.isEmpty()) return "Some services are healthy but have no recent runtime activity.";
        return "Runtime events are being collected from Archive services.";
    }

    private String runtimeStatusReason(String runtimeStatus, String serviceStatus, Instant lastEventAt, String schedulerStatus, long backlog) {
        if ("FAILED".equals(runtimeStatus)) return "Service status is " + serviceStatus + ".";
        if ("WARNING".equals(runtimeStatus)) return "Service is degraded.";
        if ("STALLED".equals(runtimeStatus)) return "Service is up, but no recent runtime event was observed.";
        if ("WAITING".equals(runtimeStatus)) return backlog > 0 ? "Service has backlog and is waiting for processing." : "Service has no event in the last minute.";
        if ("PROCESSING".equals(runtimeStatus)) return "Recent runtime event detected" + (schedulerStatus == null || schedulerStatus.isBlank() ? "." : " and scheduler is " + schedulerStatus + ".");
        return lastEventAt == null ? "Runtime timestamp is not available." : "Service is healthy.";
    }

    private Map<String, Instant> latestByNode(List<Map<String, Object>> recent) {
        Map<String, Instant> value = new LinkedHashMap<>();
        for (Map<String, Object> event : recent) {
            Instant occurred = parseInstant(event.get("occurred_at"));
            if (occurred == null) continue;
            for (String key : List.of("from_node", "to_node")) {
                String node = string(event.get(key), "");
                if (node.isBlank()) continue;
                Instant current = value.get(node);
                if (current == null || occurred.isAfter(current)) value.put(node, occurred);
            }
        }
        return value;
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
                        "MARKET_ORDERS_OBSERVED", "order", "market-orders", "market", "nexus", "created", "info",
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
                        "NEXUS_OUTBOX_PENDING", "factory", "nexus-outbox", "nexus", "logistics", "waiting", "info",
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
    private boolean bool(Object value) {
        if (value instanceof Boolean bool) return bool;
        if (value instanceof Number number) return number.intValue() != 0;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }
    private Instant firstInstant(Object... values) {
        for (Object value : values) {
            Instant instant = parseInstant(value);
            if (instant != null) return instant;
        }
        return null;
    }
    private Instant parseInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value == null) return null;
        try {
            String text = String.valueOf(value);
            if (text.isBlank()) return null;
            return Instant.parse(text.endsWith("Z") || text.contains("+") ? text : text + "Z");
        } catch (RuntimeException error) {
            return null;
        }
    }
    private long ageSeconds(Instant instant) {
        if (instant == null) return -1;
        return Math.max(0, Duration.between(instant, Instant.now()).toSeconds());
    }
    private Map<String, Object> responseData(Map<String, Object> response) {
        Map<String, Object> data = firstMap(response, "data");
        return data.isEmpty() ? response : data;
    }
    private Map<String, Object> firstMap(Map<String, Object> source, String... keys) {
        if (source == null || source.isEmpty()) return Map.of();
        for (String key : keys) {
            Object value = source.get(key);
            if (value instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> typed = (Map<String, Object>) map;
                return typed;
            }
        }
        return Map.of();
    }
    private Object firstNonNull(Object... values) {
        for (Object value : values) if (value != null) return value;
        return null;
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
