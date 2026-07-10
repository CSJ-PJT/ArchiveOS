package com.archiveos.ai.ecosystem;

import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.logitics.LogiticsClient;
import com.archiveos.ai.integration.market.MarketClient;
import com.archiveos.ai.integration.nexus.NexusClient;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EcosystemService {
    private static final Duration SNAPSHOT_TTL = Duration.ofSeconds(60);

    private final EcosystemProperties properties;
    private final EcosystemRepository repository;
    private final NexusClient nexus;
    private final MarketClient market;
    private final LogiticsClient logitics;
    private final LedgerClient ledger;

    public EcosystemService(EcosystemProperties properties, EcosystemRepository repository,
                            NexusClient nexus, MarketClient market, LogiticsClient logitics, LedgerClient ledger) {
        this.properties = properties;
        this.repository = repository;
        this.nexus = nexus;
        this.market = market;
        this.logitics = logitics;
        this.ledger = ledger;
    }

    public Map<String, Object> services() {
        String traceId = traceId();
        return Map.of("traceId", traceId, "services", List.of(
                service("MARKET", market.config(), latest("MARKET")),
                service("NEXUS", nexus.config(), latest("NEXUS")),
                service("LOGITICS", logitics.config(), latest("LOGITICS")),
                service("LEDGER", ledger.config(), latest("LEDGER"))));
    }

    @Transactional
    public Map<String, Object> refresh() {
        String traceId = traceId();
        Map<String, Object> services = checkAll(traceId);
        String status = aggregateStatus(services);
        repository.recordTimeline(traceId, null, "archiveos", "ECOSYSTEM_REFRESH", "ecosystem", "archive-platform",
                "Archive Platform ecosystem status refreshed", Map.of("status", status));
        return Map.of("traceId", traceId, "status", status, "checkedAt", Instant.now().toString(), "services", services);
    }

    public Map<String, Object> summary() {
        String traceId = traceId();
        Map<String, Object> services = currentOrCheck(traceId);
        Map<String, Object> approval = new LinkedHashMap<>(repository.approvalSummary());
        approval.putAll(repository.callbackSummary());
        return Map.of("traceId", traceId, "status", aggregateStatus(services), "checkedAt", Instant.now().toString(),
                "services", services, "approval", approval);
    }

    public Map<String, Object> topology() {
        Map<String, Object> services = currentOrCheck(traceId());
        return Map.of(
                "nodes", List.of(
                        node("archive-market", "Archive-Market", "MARKET", serviceStatus(services, "market")),
                        node("archive-nexus", "Archive-Nexus", "DOMAIN", serviceStatus(services, "nexus")),
                        node("archive-logitics", "Archive-Logistics", "LOGISTICS", serviceStatus(services, "logitics")),
                        node("archive-ledger", "Archive-Ledger", "FINANCE", serviceStatus(services, "ledger")),
                        node("archive-os", "ArchiveOS", "CONTROL_TOWER", "HEALTHY")),
                "edges", List.of(
                        edge("archive-market", "archive-nexus", "production / shipment request"),
                        edge("archive-market", "archive-ledger", "sales / payment / refund event"),
                        edge("archive-market", "archive-os", "market economy summary"),
                        edge("archive-nexus", "archive-logitics", "shipment event"),
                        edge("archive-nexus", "archive-ledger", "direct cost event"),
                        edge("archive-logitics", "archive-ledger", "logistics cost event"),
                        edge("archive-ledger", "archive-os", "approval request"),
                        edge("archive-os", "archive-ledger", "approval callback")));
    }

    public Map<String, Object> timeline(int limit) {
        return Map.of("traceId", traceId(), "events", repository.timeline(limit));
    }

    public Map<String, Object> dryRun() {
        String traceId = traceId();
        return Map.of(
                "traceId", traceId,
                "safeMode", properties.getIntegration().isSafeMode(),
                "allowExternalWrite", properties.getIntegration().isAllowExternalWrite(),
                "status", "DRY_RUN",
                "steps", List.of(
                        step(1, "Archive-Market", "Generate synthetic demand, order, payment, revenue, return, and claim events", "dry-run only"),
                        step(2, "Archive-Nexus", "Produce inventory and route shipment/cost events", "dry-run only"),
                        step(3, "Archive-Logistics", "Calculate route, ETA, delay, and logistics cost", "dry-run only"),
                        step(4, "Archive-Ledger", "Create synthetic transaction and mark high-risk items APPROVAL_REQUIRED", "dry-run only"),
                        step(5, "ArchiveOS", "Generate policy evidence, present approval queue, audit decision", "dry-run only"),
                        step(5, "ArchiveOS → Ledger", "Send approval callback through callback outbox", "blocked unless allow-external-write=true")));
    }

    public Map<String, Object> runDemo() {
        if (!properties.getIntegration().isAllowExternalWrite()) {
            return Map.of("traceId", traceId(), "status", "SAFE_MODE_BLOCKED",
                    "message", "External write demo is disabled. Set ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=true to run it.");
        }
        return Map.of("traceId", traceId(), "status", "NOT_IMPLEMENTED",
                "message", "Write demo orchestration is intentionally deferred; use dry-run for portfolio validation.");
    }

    private Map<String, Object> checkAll(String traceId) {
        Map<String, Object> services = new LinkedHashMap<>();
        services.put("market", checkMarket());
        services.put("nexus", check("NEXUS", nexus.config(), nexus.health(), nexus.outboxSummary()));
        services.put("logitics", check("LOGITICS", logitics.config(), logitics.health(), logitics.operationsSummary()));
        services.put("ledger", check("LEDGER", ledger.config(), ledger.health(), ledger.operationsSummary()));
        return services;
    }

    private Map<String, Object> currentOrCheck(String traceId) {
        if (List.of("MARKET", "NEXUS", "LOGITICS", "LEDGER").stream().allMatch(this::hasFreshSnapshot)) {
            Map<String, Object> services = new LinkedHashMap<>();
            services.put("market", fromSnapshot("MARKET"));
            services.put("nexus", fromSnapshot("NEXUS"));
            services.put("logitics", fromSnapshot("LOGITICS"));
            services.put("ledger", fromSnapshot("LEDGER"));
            return services;
        }
        return checkAll(traceId);
    }

    private Map<String, Object> checkMarket() {
        EcosystemProperties.ServiceConfig config = market.config();
        if (config == null || !config.isEnabled()) return disabled(config);
        IntegrationResult health = market.health();
        IntegrationResult operations = market.operationsSummary();
        IntegrationResult economy = market.marketEconomySummary();
        IntegrationResult outbox = market.outboxSummary();
        EcosystemServiceStatus status = aggregateServiceStatus(List.of(health, operations, economy, outbox));
        Map<String, Object> body = normalizeMarketSummary(operations, economy, outbox);
        body.put("health", health.body());
        Map<String, Object> capabilities = new LinkedHashMap<>();
        capabilities.put("operations", capability(operations));
        capabilities.put("marketEconomy", capability(economy));
        capabilities.put("outbox", capability(outbox));
        capabilities.put("orders", config.getOrdersPath());
        capabilities.put("claims", config.getClaimsPath());
        capabilities.put("returns", config.getReturnsPath());
        body.put("capabilities", capabilities);
        String error = firstError(health, operations, economy, outbox);
        Map<String, Object> snapshot = repository.recordHealth("MARKET", config.getName(), config.getBaseUrl(), status.name(),
                firstHttpStatus(economy, operations, outbox, health), body, error);
        return serviceMap(config, status.name(), snapshot.get("checked_at"), body, error);
    }

    private Map<String, Object> check(String type, EcosystemProperties.ServiceConfig config, IntegrationResult health, IntegrationResult summary) {
        if (config == null || !config.isEnabled()) return disabled(config);
        EcosystemServiceStatus status = health.status() == EcosystemServiceStatus.HEALTHY && summary.status() == EcosystemServiceStatus.HEALTHY
                ? EcosystemServiceStatus.HEALTHY
                : health.status() == EcosystemServiceStatus.UNAVAILABLE || summary.status() == EcosystemServiceStatus.UNAVAILABLE
                    ? EcosystemServiceStatus.UNAVAILABLE
                    : EcosystemServiceStatus.DEGRADED;
        Map<String, Object> body = new LinkedHashMap<>(summary.body());
        body.put("health", health.body());
        Map<String, Object> snapshot = repository.recordHealth(type, config.getName(), config.getBaseUrl(), status.name(),
                summary.httpStatus() != null ? summary.httpStatus() : health.httpStatus(), body,
                summary.errorMessage() != null ? summary.errorMessage() : health.errorMessage());
        return serviceMap(config, status.name(), snapshot.get("checked_at"), body,
                summary.errorMessage() != null ? summary.errorMessage() : health.errorMessage());
    }

    private Map<String, Object> fromSnapshot(String type) {
        Map<String, Object> snapshot = repository.latestHealth(type);
        EcosystemProperties.ServiceConfig config = properties.getEcosystem().getServices().get(type.toLowerCase(Locale.ROOT));
        if (snapshot == null) return serviceMap(config, latestStatus(type), null, Map.of(), "No health snapshot yet.");
        return serviceMap(config, String.valueOf(snapshot.get("status")), snapshot.get("checked_at"), map(snapshot.get("summary")), string(snapshot.get("error_message")));
    }

    private Map<String, Object> service(String type, EcosystemProperties.ServiceConfig config, Map<String, Object> latest) {
        return Map.of("type", type, "name", config.getName(), "enabled", config.isEnabled(), "baseUrl", config.getBaseUrl(),
                "status", latest == null ? (config.isEnabled() ? "UNKNOWN" : "DISABLED") : latest.get("status"));
    }

    private String latestStatus(String type) {
        Map<String, Object> latest = latest(type);
        return latest == null ? "UNKNOWN" : String.valueOf(latest.get("status"));
    }

    private Map<String, Object> latest(String type) { return repository.latestHealth(type); }
    private boolean hasFreshSnapshot(String type) {
        Map<String, Object> snapshot = repository.latestHealth(type);
        return snapshot != null && snapshot.get("status") != null && !isStale(snapshot.get("checked_at"));
    }
    private boolean isStale(Object checkedAt) {
        if (checkedAt == null) return true;
        try {
            return Instant.parse(String.valueOf(checkedAt)).isBefore(Instant.now().minus(SNAPSHOT_TTL));
        } catch (RuntimeException error) {
            return true;
        }
    }
    private String serviceStatus(Map<String, Object> services, String key) {
        Object value = services.get(key);
        if (!(value instanceof Map<?, ?> service)) return "UNKNOWN";
        Object status = service.get("status");
        return status == null ? "UNKNOWN" : String.valueOf(status);
    }
    private Map<String, Object> disabled(EcosystemProperties.ServiceConfig config) { return serviceMap(config, "DISABLED", null, Map.of(), "Service is disabled."); }
    private Map<String, Object> serviceMap(EcosystemProperties.ServiceConfig config, String status, Object checkedAt, Map<String, Object> summary, String error) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("status", status);
        value.put("name", config == null ? "unknown" : config.getName());
        value.put("baseUrl", config == null ? null : config.getBaseUrl());
        value.put("lastCheckedAt", checkedAt);
        value.put("summary", summary == null ? Map.of() : summary);
        value.put("errorMessage", error);
        return value;
    }

    private String aggregateStatus(Map<String, Object> services) {
        boolean unavailable = services.values().stream().map(this::status).anyMatch("UNAVAILABLE"::equals);
        boolean degraded = services.values().stream().map(this::status).anyMatch(status -> List.of("DEGRADED", "UNKNOWN").contains(status));
        return unavailable || degraded ? "DEGRADED" : "HEALTHY";
    }

    private EcosystemServiceStatus aggregateServiceStatus(List<IntegrationResult> results) {
        if (results.stream().anyMatch(result -> result.status() == EcosystemServiceStatus.UNAVAILABLE)) return EcosystemServiceStatus.UNAVAILABLE;
        if (results.stream().anyMatch(result -> result.status() != EcosystemServiceStatus.HEALTHY)) return EcosystemServiceStatus.DEGRADED;
        return EcosystemServiceStatus.HEALTHY;
    }

    private Map<String, Object> normalizeMarketSummary(IntegrationResult operations, IntegrationResult economy, IntegrationResult outbox) {
        Map<String, Object> operationsData = responseData(operations.body());
        Map<String, Object> economyData = responseData(economy.body());
        Map<String, Object> source = !economyData.isEmpty() ? economyData : operationsData;
        Map<String, Object> orders = firstMap(source, "orders", "orderSummary", "order_summary");
        Map<String, Object> risk = firstMap(source, "risk", "bankruptcy", "bankruptcyRisk");
        Map<String, Object> finance = firstMap(source, "finance", "economy", "cash");
        Map<String, Object> outboxBody = responseData(outbox.body());
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("orders", Map.of(
                "total", number(source, orders, "total", "totalOrders", "orderCount"),
                "confirmed", number(source, orders, "confirmed", "confirmedOrders"),
                "cancelled", number(source, orders, "cancelled", "cancelledOrders"),
                "returned", number(source, orders, "returned", "returnedOrders", "returnCount"),
                "claimed", number(source, orders, "claimed", "claimedOrders", "claimCount")));
        value.put("totalRevenue", decimal(source, finance, "totalRevenue", "revenue", "revenueAmount"));
        value.put("totalCost", decimal(source, finance, "totalCost", "cost", "costAmount"));
        value.put("profit", decimal(source, finance, "profit", "profitAmount"));
        value.put("cashBalance", decimal(source, finance, "cashBalance", "cash", "balance"));
        value.put("burnRate", decimal(source, finance, "burnRate", "burn_rate"));
        value.put("bankruptcyRisk", stringValue(firstNonNull(source.get("bankruptcyRisk"), finance.get("bankruptcyRisk"), risk.get("bankruptcyRisk"), risk.get("level"), risk.get("status")), "UNKNOWN"));
        value.put("returnRate", decimal(source, risk, "returnRate", "return_rate"));
        value.put("claimRate", decimal(source, risk, "claimRate", "claim_rate"));
        value.put("highRiskOrders", number(source, risk, "highRiskOrders", "high_risk_orders"));
        value.put("outbox", Map.of(
                "pending", number(outboxBody, outboxBody, "pending", "pendingCount"),
                "failed", number(outboxBody, outboxBody, "failed", "failedCount")));
        value.put("syntheticData", true);
        value.put("operations", operationsData);
        value.put("marketEconomy", economyData);
        return value;
    }

    private Map<String, Object> responseData(Map<String, Object> response) {
        Map<String, Object> data = firstMap(response, "data");
        return data.isEmpty() ? response : data;
    }

    private Map<String, Object> firstMap(Map<String, Object> source, String... keys) {
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

    private long number(Map<String, Object> primary, Map<String, Object> secondary, String... keys) {
        Object value = firstNonNull(primary, secondary, keys);
        if (value instanceof Number number) return number.longValue();
        try { return value == null ? 0 : Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return 0; }
    }

    private String decimal(Map<String, Object> primary, Map<String, Object> secondary, String... keys) {
        Object value = firstNonNull(primary, secondary, keys);
        return value == null ? "0" : String.valueOf(value);
    }

    private Object firstNonNull(Map<String, Object> primary, Map<String, Object> secondary, String... keys) {
        for (String key : keys) {
            Object value = primary.get(key);
            if (value != null) return value;
            value = secondary.get(key);
            if (value != null) return value;
        }
        return null;
    }

    private Object firstNonNull(Object... values) {
        for (Object value : values) if (value != null) return value;
        return null;
    }

    private String stringValue(Object value, String fallback) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isBlank() ? fallback : text;
    }

    private Map<String, Object> capability(IntegrationResult result) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("status", result.status().name());
        value.put("httpStatus", result.httpStatus());
        value.put("errorMessage", result.errorMessage());
        return value;
    }

    private Integer firstHttpStatus(IntegrationResult... results) {
        for (IntegrationResult result : results) if (result.httpStatus() != null) return result.httpStatus();
        return null;
    }

    private String firstError(IntegrationResult... results) {
        for (IntegrationResult result : results) if (result.errorMessage() != null && !result.errorMessage().isBlank()) return result.errorMessage();
        return null;
    }

    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of(); }
    private String status(Object value) { return String.valueOf(map(value).getOrDefault("status", "UNKNOWN")); }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private Map<String, Object> node(String id, String label, String type, String status) { return Map.of("id", id, "label", label, "type", type, "status", status); }
    private Map<String, Object> edge(String from, String to, String label) { return Map.of("from", from, "to", to, "label", label); }
    private Map<String, Object> step(int order, String service, String action, String mode) { return Map.of("order", order, "service", service, "action", action, "mode", mode); }
    private String traceId() { return "eco-" + UUID.randomUUID().toString().substring(0, 8); }
}
