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
                "dataPolicy", "합성 인력·처리 역량·생산성 요약만 사용합니다. 실제 임직원, 급여 또는 개인정보는 포함하지 않습니다.",
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
                collect("archive-market", "Archive-Market", "MARKET", market.workforceSummary(), market.productivitySummary(), market.capacitySummary(), market.cashflowSummary(), market.operationsSummary()),
                collect("archive-nexus", "Archive-Nexus", "NEXUS", nexus.workforceSummary(), nexus.productivitySummary(), nexus.capacitySummary(), null, nexus.operationsSummary()),
                collect("archive-logistics", "Archive-Logistics", "LOGISTICS", logitics.workforceSummary(), logitics.productivitySummary(), logitics.capacitySummary(), null, logitics.operationsSummary()),
                collect("archive-ledger", "Archive-Ledger", "LEDGER", ledger.workforceSummary(), ledger.productivitySummary(), ledger.capacitySummary(), null, ledger.operationsSummary()));
    }

    private Map<String, Object> collect(String id, String name, String type, IntegrationResult workforce,
                                        IntegrationResult productivity, IntegrationResult capacity, IntegrationResult cashflow,
                                        IntegrationResult operations) {
        Map<String, Object> workforceBody = data(workforce);
        Map<String, Object> productivityBody = data(productivity);
        Map<String, Object> capacityBody = data(capacity);
        Map<String, Object> cashflowBody = data(cashflow);
        Map<String, Object> operationsBody = data(operations);
        int headcount = maxInteger(
                first(workforceBody, "headcount", "totalHeadcount", "workers", "staffCount"),
                path(operationsBody, "workforce.totalHeadcount"), path(operationsBody, "runtimeWorkforce.totalHeadcount"));
        BigDecimal effectiveCapacity = firstPositive(
                first(capacityBody, workforceBody, "effectiveCapacity", "effective_capacity", "capacity", "totalCapacity"),
                path(operationsBody, "workforce.effectiveCapacity"), path(operationsBody, "runtimeWorkforce.effectiveCapacity"),
                path(operationsBody, "balance.effectiveCapacity"));
        BigDecimal usedCapacity = firstPositive(
                first(capacityBody, workforceBody, "usedCapacity", "used_capacity", "used", "load"),
                path(operationsBody, "workforce.usedCapacity"), path(operationsBody, "runtimeWorkforce.usedCapacity"),
                path(operationsBody, "balance.usedCapacity"));
        int backlog = maxInteger(
                first(capacityBody, productivityBody, workforceBody, "backlog", "queueDepth", "pending", "pendingWork"),
                path(operationsBody, "workforce.backlog"), path(operationsBody, "workforce.backlogCount"),
                path(operationsBody, "runtimeWorkforce.backlog"), path(operationsBody, "balance.backlogCount"),
                operationsBody.get("backlogCount"), operationsBody.get("productionBacklog"));
        BigDecimal payrollCost = firstPositive(
                first(cashflowBody, workforceBody, "payrollCost", "payroll_cost", "laborCost", "workforceCost"),
                path(operationsBody, "workforce.payrollCost"), path(operationsBody, "economy.workforceCost"));
        BigDecimal productivityScore = normalizePercent(firstPositive(
                first(productivityBody, workforceBody, "productivityScore", "productivity_score", "score", "efficiency"),
                path(operationsBody, "productivity.productivityScore"), path(operationsBody, "workforce.productivityScore"),
                path(operationsBody, "workforce.productivityRate")));
        if (productivityScore.compareTo(BigDecimal.ZERO) == 0 && effectiveCapacity.compareTo(BigDecimal.ZERO) > 0) {
            productivityScore = usedCapacity.multiply(BigDecimal.valueOf(100)).divide(effectiveCapacity, 2, RoundingMode.HALF_UP);
        }
        String bottleneckRole = string(firstNonBlank(
                first(capacityBody, productivityBody, workforceBody, "bottleneckRole", "bottleneck_role", "role", "largestBottleneck"),
                path(operationsBody, "workforce.bottleneckRole"), path(operationsBody, "balance.bottleneckRole")), defaultRole(type));
        String status = aggregateStatus(workforce, productivity, capacity, cashflow, operations);
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
                case "NEXUS" -> "생산·품질 검사·정비 우선순위를 재조정하세요.";
                case "LOGISTICS" -> "지연 배송 대응 역량과 긴급 할증 기준을 검토하세요.";
                case "LEDGER" -> "승인 검토·대사·정산 배치 역량을 우선 확보하세요.";
                default -> "작업 역량 병목을 검토하세요.";
            };
            if ("MARKET".equals(type)) title = "주문 처리 인력과 고위험 주문 보류 기준을 검토하세요.";
            String severity = integer(service.get("backlog")) > 50 || Boolean.TRUE.equals(service.get("capacityShortage")) ? "high"
                    : integer(service.get("backlog")) > 0 ? "medium" : "info";
            return Map.of(
                    "serviceId", service.get("serviceId"),
                    "serviceName", service.get("serviceName"),
                    "severity", severity,
                    "bottleneckRole", service.get("bottleneckRole"),
                    "title", title,
                    "reason", "적체 " + service.get("backlog") + "건 · 생산성 " + service.get("productivityScore") + "% · 사용 역량 " + service.get("usedCapacity") + "/" + service.get("effectiveCapacity"),
                    "mode", "제안 전용",
                    "externalWrite", "외부 쓰기 없음");
        }).toList();
    }

    private Map<String, Object> largestBottleneck(List<Map<String, Object>> services) {
        return services.stream().max(Comparator
                .<Map<String, Object>, Integer>comparing(service -> integer(service.get("backlog")))
                .thenComparing(service -> decimal(service.get("usedCapacity"))))
                .orElse(Map.of());
    }

    private String recommendationTitle(Map<String, Object> largest) {
        if (largest.isEmpty()) return "추가 작업 역량 조치가 필요하지 않습니다.";
        return largest.getOrDefault("serviceName", "서비스") + " 병목 검토: " + largest.getOrDefault("bottleneckRole", "미확인");
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

    @SuppressWarnings("unchecked")
    private Object path(Map<String, Object> source, String path) {
        Object current = source;
        for (String key : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) return null;
            current = ((Map<String, Object>) map).get(key);
        }
        return current;
    }

    private Object firstNonBlank(Object... values) {
        for (Object value : values) if (value != null && !String.valueOf(value).isBlank()) return value;
        return null;
    }

    private int maxInteger(Object... values) {
        int maximum = 0;
        for (Object value : values) maximum = Math.max(maximum, integer(value));
        return maximum;
    }

    private BigDecimal firstPositive(Object... values) {
        BigDecimal fallback = BigDecimal.ZERO;
        for (Object value : values) {
            BigDecimal decimal = decimal(value);
            if (decimal.compareTo(BigDecimal.ZERO) > 0) return decimal;
            if (fallback.compareTo(BigDecimal.ZERO) == 0) fallback = decimal;
        }
        return fallback;
    }

    private BigDecimal normalizePercent(BigDecimal value) {
        if (value.compareTo(BigDecimal.ZERO) > 0 && value.compareTo(BigDecimal.ONE) <= 0) return value.multiply(BigDecimal.valueOf(100));
        return value;
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
