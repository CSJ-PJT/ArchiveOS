package com.archiveos.ai.workforce;

import com.archiveos.ai.ecosystem.EcosystemServiceStatus;
import com.archiveos.ai.ecosystem.IntegrationResult;
import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.logitics.LogiticsClient;
import com.archiveos.ai.integration.market.MarketClient;
import com.archiveos.ai.integration.nexus.NexusClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class WorkforceService {
    private final MarketClient market;
    private final NexusClient nexus;
    private final LogiticsClient logitics;
    private final LedgerClient ledger;

    public WorkforceService(MarketClient market, NexusClient nexus, LogiticsClient logitics, LedgerClient ledger) {
        this.market = market;
        this.nexus = nexus;
        this.logitics = logitics;
        this.ledger = ledger;
    }

    public Map<String, Object> overview() {
        List<Map<String, Object>> services = services();
        int totalHeadcount = services.stream().mapToInt(service -> integer(service.get("headcount"))).sum();
        int totalBacklog = services.stream().mapToInt(service -> integer(service.get("backlog"))).sum();
        BigDecimal payrollBurn = services.stream()
                .map(service -> decimal(service.get("payrollCost")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal averageProductivity = average(services.stream().map(service -> decimal(service.get("productivityScore"))).toList());
        Map<String, Object> largest = largestBottleneck(services);
        return Map.of(
                "generatedAt", Instant.now().toString(),
                "dataPolicy", "Synthetic workforce/capacity/productivity summaries only. No real employee, payroll, or personal data.",
                "summary", Map.of(
                        "totalHeadcount", totalHeadcount,
                        "averageProductivity", averageProductivity,
                        "largestBottleneck", largest.getOrDefault("bottleneckRole", "none"),
                        "largestBottleneckService", largest.getOrDefault("serviceName", "n/a"),
                        "totalBacklog", totalBacklog,
                        "payrollBurn", payrollBurn,
                        "recommendedAction", recommendationTitle(largest)),
                "services", services,
                "recommendations", recommendations(services));
    }

    public Map<String, Object> bottlenecks() {
        List<Map<String, Object>> services = services();
        return Map.of("generatedAt", Instant.now().toString(), "items", services.stream()
                .filter(service -> integer(service.get("backlog")) > 0 || decimal(service.get("usedCapacity")).compareTo(decimal(service.get("effectiveCapacity"))) >= 0)
                .sorted(Comparator.<Map<String, Object>, Integer>comparing(service -> integer(service.get("backlog"))).reversed())
                .toList());
    }

    public Map<String, Object> recommendations() {
        return Map.of("generatedAt", Instant.now().toString(), "items", recommendations(services()));
    }

    public Map<String, Object> productivityTrend() {
        List<Map<String, Object>> services = services();
        return Map.of("generatedAt", Instant.now().toString(), "points", services.stream()
                .map(service -> Map.of(
                        "serviceId", service.get("serviceId"),
                        "serviceName", service.get("serviceName"),
                        "productivityScore", service.get("productivityScore"),
                        "usedCapacity", service.get("usedCapacity"),
                        "effectiveCapacity", service.get("effectiveCapacity"),
                        "backlog", service.get("backlog")))
                .toList());
    }

    private List<Map<String, Object>> services() {
        return List.of(
                collect("archive-market", "Archive-Market", "MARKET", market.workforceSummary(), market.productivitySummary(), market.capacitySummary(), market.cashflowSummary()),
                collect("archive-nexus", "Archive-Nexus", "NEXUS", nexus.workforceSummary(), nexus.productivitySummary(), nexus.capacitySummary(), null),
                collect("archive-logistics", "Archive-Logistics", "LOGISTICS", logitics.workforceSummary(), logitics.productivitySummary(), logitics.capacitySummary(), null),
                collect("archive-ledger", "Archive-Ledger", "LEDGER", ledger.workforceSummary(), ledger.productivitySummary(), ledger.capacitySummary(), null));
    }

    private Map<String, Object> collect(String id, String name, String type, IntegrationResult workforce,
                                        IntegrationResult productivity, IntegrationResult capacity, IntegrationResult cashflow) {
        Map<String, Object> workforceBody = data(workforce);
        Map<String, Object> productivityBody = data(productivity);
        Map<String, Object> capacityBody = data(capacity);
        Map<String, Object> cashflowBody = data(cashflow);
        int headcount = integer(first(workforceBody, "headcount", "totalHeadcount", "workers", "staffCount"));
        BigDecimal effectiveCapacity = decimal(first(capacityBody, workforceBody, "effectiveCapacity", "effective_capacity", "capacity", "totalCapacity"));
        BigDecimal usedCapacity = decimal(first(capacityBody, workforceBody, "usedCapacity", "used_capacity", "used", "load"));
        int backlog = integer(first(capacityBody, productivityBody, workforceBody, "backlog", "queueDepth", "pending", "pendingWork"));
        BigDecimal payrollCost = decimal(first(cashflowBody, workforceBody, "payrollCost", "payroll_cost", "laborCost", "workforceCost"));
        BigDecimal productivityScore = decimal(first(productivityBody, workforceBody, "productivityScore", "productivity_score", "score", "efficiency"));
        if (productivityScore.compareTo(BigDecimal.ZERO) == 0 && effectiveCapacity.compareTo(BigDecimal.ZERO) > 0) {
            productivityScore = usedCapacity.multiply(BigDecimal.valueOf(100)).divide(effectiveCapacity, 2, RoundingMode.HALF_UP);
        }
        String bottleneckRole = string(first(capacityBody, productivityBody, workforceBody, "bottleneckRole", "bottleneck_role", "role", "largestBottleneck"), defaultRole(type));
        String status = aggregateStatus(workforce, productivity, capacity, cashflow);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("serviceId", id);
        value.put("serviceName", name);
        value.put("serviceType", type);
        value.put("status", status);
        value.put("headcount", headcount);
        value.put("effectiveCapacity", effectiveCapacity);
        value.put("usedCapacity", usedCapacity);
        value.put("backlog", backlog);
        value.put("payrollCost", payrollCost);
        value.put("productivityScore", productivityScore);
        value.put("bottleneckRole", bottleneckRole);
        value.put("capacityShortage", effectiveCapacity.compareTo(BigDecimal.ZERO) > 0 && usedCapacity.compareTo(effectiveCapacity) > 0);
        value.put("source", Map.of(
                "workforce", source(workforce),
                "productivity", source(productivity),
                "capacity", source(capacity),
                "cashflow", source(cashflow)));
        return value;
    }

    private List<Map<String, Object>> recommendations(List<Map<String, Object>> services) {
        return services.stream().map(service -> {
            String type = string(service.get("serviceType"), "UNKNOWN");
            String title = switch (type) {
                case "MARKET" -> "Review order processing staffing and hold high-risk orders.";
                case "NEXUS" -> "Rebalance production, quality inspection, and maintenance priority.";
                case "LOGISTICS" -> "Reinforce delayed-shipment handling and review emergency surcharge.";
                case "LEDGER" -> "Prioritize approval review, reconciliation, and settlement batch capacity.";
                default -> "Review workforce bottleneck.";
            };
            String severity = integer(service.get("backlog")) > 50 || Boolean.TRUE.equals(service.get("capacityShortage")) ? "high"
                    : integer(service.get("backlog")) > 0 ? "medium" : "info";
            return Map.of(
                    "serviceId", service.get("serviceId"),
                    "serviceName", service.get("serviceName"),
                    "severity", severity,
                    "bottleneckRole", service.get("bottleneckRole"),
                    "title", title,
                    "reason", "backlog=" + service.get("backlog") + ", productivity=" + service.get("productivityScore") + ", capacity=" + service.get("usedCapacity") + "/" + service.get("effectiveCapacity"),
                    "mode", "recommendation-only",
                    "externalWrite", "not implemented in MVP");
        }).toList();
    }

    private Map<String, Object> largestBottleneck(List<Map<String, Object>> services) {
        return services.stream().max(Comparator
                .<Map<String, Object>, Integer>comparing(service -> integer(service.get("backlog")))
                .thenComparing(service -> decimal(service.get("usedCapacity"))))
                .orElse(Map.of());
    }

    private String recommendationTitle(Map<String, Object> largest) {
        if (largest.isEmpty()) return "No workforce action required.";
        return "Review " + largest.getOrDefault("serviceName", "service") + " bottleneck: " + largest.getOrDefault("bottleneckRole", "unknown");
    }

    private String aggregateStatus(IntegrationResult... results) {
        boolean unavailable = false;
        boolean degraded = false;
        for (IntegrationResult result : results) {
            if (result == null) continue;
            if (result.status() == EcosystemServiceStatus.UNAVAILABLE) unavailable = true;
            else if (result.status() != EcosystemServiceStatus.HEALTHY) degraded = true;
        }
        if (unavailable) return "UNAVAILABLE";
        if (degraded) return "DEGRADED";
        return "HEALTHY";
    }

    private Map<String, Object> source(IntegrationResult result) {
        if (result == null) return Map.of("status", "NOT_CONFIGURED");
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("status", result.status().name());
        value.put("httpStatus", result.httpStatus());
        value.put("latencyMs", result.latencyMs());
        value.put("errorMessage", result.errorMessage());
        return value;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> data(IntegrationResult result) {
        if (result == null || result.body() == null) return Map.of();
        Object data = result.body().get("data");
        if (data instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return result.body();
    }

    private Object first(Map<String, Object> primary, String... keys) {
        return first(primary, Map.of(), keys);
    }

    private Object first(Map<String, Object> primary, Map<String, Object> secondary, String... keys) {
        for (String key : keys) {
            Object value = primary.get(key);
            if (value != null) return value;
            value = secondary.get(key);
            if (value != null) return value;
        }
        return null;
    }

    private Object first(Map<String, Object> a, Map<String, Object> b, Map<String, Object> c, String... keys) {
        for (String key : keys) {
            if (a.get(key) != null) return a.get(key);
            if (b.get(key) != null) return b.get(key);
            if (c.get(key) != null) return c.get(key);
        }
        return null;
    }

    private BigDecimal average(List<BigDecimal> values) {
        List<BigDecimal> positives = values.stream().filter(value -> value.compareTo(BigDecimal.ZERO) > 0).toList();
        if (positives.isEmpty()) return BigDecimal.ZERO;
        return positives.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(positives.size()), 2, RoundingMode.HALF_UP);
    }

    private String defaultRole(String type) {
        return switch (type) {
            case "MARKET" -> "order-review";
            case "NEXUS" -> "production-quality";
            case "LOGISTICS" -> "dispatch-delay-response";
            case "LEDGER" -> "approval-reconciliation";
            default -> "operations";
        };
    }

    private int integer(Object value) {
        if (value instanceof Number number) return number.intValue();
        try { return value == null ? 0 : Integer.parseInt(String.valueOf(value)); }
        catch (NumberFormatException error) { return 0; }
    }

    private BigDecimal decimal(Object value) {
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        try { return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException error) { return BigDecimal.ZERO; }
    }

    private String string(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value);
        return text.isBlank() ? fallback : text.toLowerCase(Locale.ROOT).contains("null") ? fallback : text;
    }
}
