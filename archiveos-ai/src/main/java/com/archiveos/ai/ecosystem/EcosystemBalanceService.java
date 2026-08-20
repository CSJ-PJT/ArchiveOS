package com.archiveos.ai.ecosystem;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Read-only explanation of synthetic cross-service financial and capacity balance. */
@Service
public class EcosystemBalanceService {
    private final EcosystemService ecosystem;
    private final EcosystemBalanceProperties policy;

    public EcosystemBalanceService(EcosystemService ecosystem, EcosystemBalanceProperties policy) {
        this.ecosystem = ecosystem;
        this.policy = policy;
    }

    public Map<String, Object> summary() {
        Map<String, Object> services = map(ecosystem.summary().get("services"));
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        for (String key : List.of("market", "nexus", "logitics", "ledger", "archiveos")) {
            Map<String, Object> source = "archiveos".equals(key) ? Map.of("status", "HEALTHY", "name", "ArchiveOS") : map(services.get(key));
            Map<String, Object> body = financeBody(key, map(source.get("summary")));
            BigDecimal revenue = amount(body, "recognizedRevenue");
            BigDecimal cost = amount(body, "realizedOperatingCost");
            BigDecimal profit = revenue == null || cost == null ? null : revenue.subtract(cost);
            BigDecimal cash = amount(body, "cashBalance", "availableCash", "cash", "balance");
            BigDecimal backlog = amount(body, "backlog", "pending", "approvalRequired");
            AggregationGate gate = aggregationGate(key, source, body, revenue, cost, profit);
            if (gate.included()) {
                totalRevenue = totalRevenue.add(orZero(revenue));
                totalCost = totalCost.add(orZero(cost));
                totalProfit = totalProfit.add(orZero(profit));
            }
            Map<String, Object> row = row(key, source, body, revenue, cost, profit, cash, backlog);
            row.put("includedInTotals", gate.included());
            row.put("aggregationStatus", gate.status());
            row.put("aggregationReason", gate.reason());
            rows.add(row);
        }
        BigDecimal positiveProfitTotal = rows.stream()
                .filter(row -> Boolean.TRUE.equals(row.get("includedInTotals")))
                .map(row -> decimal(row.get("profit")))
                .filter(value -> value != null && value.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        for (Map<String, Object> row : rows) {
            row.put("revenueShare", ratio(decimal(row.get("revenue")), totalRevenue));
            row.put("expenseShare", ratio(decimal(row.get("cost")), totalCost));
            BigDecimal rowProfit = decimal(row.get("profit"));
            row.put("profitShare", Boolean.TRUE.equals(row.get("includedInTotals")) ? ratio(rowProfit == null ? null : rowProfit.max(BigDecimal.ZERO), positiveProfitTotal) : null);
            enrichBalance(row);
        }
        Map<String, Object> targetMargins = new LinkedHashMap<>();
        for (String key : List.of("market", "nexus", "logistics", "ledger", "archiveos")) {
            EcosystemBalanceProperties.Margin margin = policy.marginFor(key);
            targetMargins.put(key, margin.getMinMargin() + "-" + margin.getMaxMargin() + "%");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("syntheticData", true);
        result.put("targetMargins", targetMargins);
        result.put("policy", Map.of("backlogWarning", policy.getBacklogWarning(), "capacityWarningPercent", policy.getCapacityWarningPercent(), "profitConcentrationPercent", policy.getProfitConcentrationPercent()));
        result.put("totals", Map.of("revenue", totalRevenue, "cost", totalCost, "profit", totalProfit,
                "scope", "COMPARABLE_CURRENT_OPERATING_WINDOWS",
                "includedServices", rows.stream().filter(row -> Boolean.TRUE.equals(row.get("includedInTotals"))).count()));
        result.put("services", rows);
        result.put("balanceStatus", balanceStatus(rows));
        result.put("reviewReason", reviewReason(rows));
        return result;
    }

    public Map<String, Object> recommendations() {
        Map<String, Object> summary = summary();
        @SuppressWarnings("unchecked") List<Map<String, Object>> rows = (List<Map<String, Object>>) summary.get("services");
        List<Map<String, Object>> actions = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String service = String.valueOf(row.get("serviceId"));
            String balance = String.valueOf(row.get("balance"));
            BigDecimal backlog = decimal(row.get("backlog"));
            if ("CONCENTRATED".equals(balance)) actions.add(action(service, "수익 집중", String.valueOf(row.get("balanceReason")), "READ_ONLY"));
            if ("UNDER_PRESSURE".equals(balance)) actions.add(action(service, "손익 압박", String.valueOf(row.get("balanceReason")), "READ_ONLY"));
            if (backlog != null && backlog.compareTo(BigDecimal.valueOf(policy.getBacklogWarning())) > 0) actions.add(action(service, "적체 증가", "처리 대기량이 정책 경고 기준을 초과했습니다. 작업 역량과 자동 처리 상태를 확인하세요.", "READ_ONLY"));
            BigDecimal capacity = decimal(row.get("capacityUtilization"));
            if (capacity != null && capacity.compareTo(BigDecimal.valueOf(policy.getCapacityWarningPercent())) >= 0) actions.add(action(service, "처리 역량 주의", "처리 역량 사용률이 정책 경고 기준을 초과했습니다.", "READ_ONLY"));
        }
        if (actions.isEmpty()) actions.add(action("archive-platform", "균형 범위", "현재 수집된 합성 지표에서 즉시 조정이 필요한 불균형은 없습니다.", "READ_ONLY"));
        return Map.of("syntheticData", true, "recommendations", actions);
    }

    public Map<String, Object> simulate(Map<String, Object> request) {
        return Map.of("status", "DRY_RUN", "syntheticData", true, "message", "외부 수수료나 자금은 변경하지 않습니다.", "current", summary(), "request", request == null ? Map.of() : request);
    }

    private Map<String, Object> row(String key, Map<String, Object> source, Map<String, Object> body, BigDecimal revenue, BigDecimal cost, BigDecimal profit, BigDecimal cash, BigDecimal backlog) {
        EcosystemBalanceProperties.Margin target = policy.marginFor(key);
        BigDecimal margin = revenue != null && cost != null && profit != null && revenue.signum() == 0 && cost.signum() == 0 && profit.signum() == 0
                ? BigDecimal.ZERO.setScale(2)
                : revenue == null || revenue.signum() == 0 || profit == null ? null : profit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("serviceId", "archiveos".equals(key) ? "archiveos" : "logitics".equals(key) ? "archive-logistics" : "archive-" + key);
        row.put("serviceName", "archiveos".equals(key) ? "ArchiveOS" : string(source.get("name"), "Archive-" + key));
        row.put("status", "archiveos".equals(key) ? "HEALTHY" : string(source.get("status"), "UNKNOWN"));
        row.put("financeSource", key + " latest summary");
        row.put("currency", body.get("currency"));
        row.put("calculationScope", body.get("calculationScope"));
        row.put("periodStart", body.get("periodStart"));
        row.put("periodEnd", body.get("periodEnd"));
        row.put("sourceLatestEventAt", body.get("sourceLatestEventAt"));
        row.put("revenue", revenue); row.put("cost", cost); row.put("profit", profit); row.put("cashBalance", cash); row.put("backlog", backlog);
        row.put("backlogExposure", firstAmount(body, "backlogExposure"));
        row.put("targetMinMargin", target.getMinMargin()); row.put("targetMaxMargin", target.getMaxMargin()); row.put("operatingMargin", margin);
        row.put("marginGap", margin == null ? null : margin.compareTo(target.getMinMargin()) < 0 ? margin.subtract(target.getMinMargin()) : margin.compareTo(target.getMaxMargin()) > 0 ? margin.subtract(target.getMaxMargin()) : BigDecimal.ZERO);
        row.put("capacityUtilization", firstAmount(body, "capacityUtilization", "usedCapacityPercent"));
        row.put("approvalBacklog", firstAmount(body, "approvalBacklog", "approvalRequired"));
        row.put("settlementBacklog", firstAmount(body, "settlementBacklog", "settlementPending"));
        row.put("feeConcentration", firstAmount(body, "feeConcentration"));
        row.put("negativeProfitStreak", firstAmount(body, "negativeProfitStreak"));
        return row;
    }

    private void enrichBalance(Map<String, Object> row) {
        if (!Boolean.TRUE.equals(row.get("includedInTotals"))) {
            row.put("balance", "NO_DATA");
            row.put("balanceReason", row.get("aggregationReason"));
            return;
        }
        BigDecimal margin = decimal(row.get("operatingMargin"));
        BigDecimal min = decimal(row.get("targetMinMargin"));
        BigDecimal max = decimal(row.get("targetMaxMargin"));
        BigDecimal revenue = decimal(row.get("revenue"));
        BigDecimal cost = decimal(row.get("cost"));
        BigDecimal profit = decimal(row.get("profit"));
        if (revenue != null && revenue.signum() == 0 && cost != null && cost.signum() == 0
                && profit != null && profit.signum() == 0) {
            row.put("balance", "WITHIN_RANGE");
            row.put("balanceReason", "현재 운영 기간의 합성 손익 조회가 정상 완료되었으며 인식된 수익과 비용 변동은 0원입니다.");
            return;
        }
        if (revenue != null && revenue.signum() == 0
                && ((cost != null && cost.signum() > 0) || (profit != null && profit.signum() < 0))) {
            row.put("balance", "UNDER_PRESSURE");
            row.put("balanceReason", "합성 매출은 0이고 운영 비용이 발생해 손익 압박 상태입니다.");
            return;
        }
        if (margin == null || min == null || max == null) { row.put("balance", "NO_DATA"); row.put("balanceReason", "손익률을 판단할 수 있는 합성 재무 데이터가 아직 수집되지 않았습니다."); return; }
        if (margin.compareTo(max) > 0) { row.put("balance", "CONCENTRATED"); row.put("balanceReason", "영업이익률이 정책 상한을 초과했습니다."); return; }
        if (margin.compareTo(min) < 0) { row.put("balance", "UNDER_PRESSURE"); row.put("balanceReason", "영업이익률이 정책 하한보다 낮습니다."); return; }
        row.put("balance", "WITHIN_RANGE"); row.put("balanceReason", "영업이익률이 정책 목표 범위 안에 있습니다.");
    }

    private Map<String, Object> action(String service, String title, String reason, String mode) { return Map.of("serviceId", service, "title", title, "reason", reason, "mode", mode); }
    private String balanceStatus(List<Map<String, Object>> rows) { long available = rows.stream().filter(row -> !"NO_DATA".equals(row.get("balance"))).count(); if (available == 0) return "NO_DATA"; if (available < rows.size()) return "PARTIAL_DATA"; return rows.stream().anyMatch(row -> "UNDER_PRESSURE".equals(row.get("balance")) || "CONCENTRATED".equals(row.get("balance")) || concentrationExceeded(row)) ? "COMPLETE_REVIEW" : "COMPLETE_BALANCED"; }
    private String reviewReason(List<Map<String, Object>> rows) { long missing = rows.stream().filter(row -> "NO_DATA".equals(row.get("balance"))).count(); if (missing == rows.size()) return "수집된 재무 데이터가 없어 생태계 균형을 평가할 수 없습니다."; if (missing > 0) return "일부 서비스의 재무 데이터가 아직 수집되지 않아 생태계 균형은 부분 평가 상태입니다."; return rows.stream().filter(row -> "UNDER_PRESSURE".equals(row.get("balance"))).findFirst().map(row -> row.get("serviceName") + " 손익이 권장 범위 아래입니다.").orElse("현재 수집된 합성 지표는 균형 범위에 있습니다."); }
    private boolean concentrationExceeded(Map<String, Object> row) { BigDecimal share = decimal(row.get("profitShare")); return share != null && share.compareTo(BigDecimal.valueOf(policy.getProfitConcentrationPercent())) > 0; }
    private AggregationGate aggregationGate(String key, Map<String, Object> source, Map<String, Object> body,
                                            BigDecimal revenue, BigDecimal cost, BigDecimal profit) {
        if (revenue == null || cost == null || profit == null) {
            return new AggregationGate(false, "INCOMPLETE_FINANCE_CONTRACT", "현재 기간의 인식 매출과 실현 비용 계약이 완전하지 않습니다.");
        }
        if (revenue.signum() < 0 || cost.signum() < 0) {
            return new AggregationGate(false, "INVALID_FINANCE_AMOUNT", "인식 매출 또는 실현 비용이 음수여서 합계에서 제외했습니다.");
        }
        String currency = requiredText(body.get("currency"));
        if (currency == null) {
            return new AggregationGate(false, "MISSING_CURRENCY", "합성 통화가 명시되지 않아 합계에서 제외했습니다.");
        }
        if (!"SYNTHETIC_KRW".equals(currency)) {
            return new AggregationGate(false, "CURRENCY_MISMATCH", "합성 통화 기준이 달라 생태계 합계에서 제외했습니다.");
        }
        String scope = requiredText(body.get("calculationScope"));
        if (scope == null) {
            return new AggregationGate(false, "MISSING_SCOPE", "계산 범위가 명시되지 않아 합계에서 제외했습니다.");
        }
        if (!allowedScope(key, scope)) {
            return new AggregationGate(false, "INCOMPARABLE_SCOPE", "허용된 현재 운영 기간 범위가 아니어서 합계에서 제외했습니다.");
        }
        Boolean available = booleanValue(body.get("available"));
        Boolean dataAvailable = booleanValue(body.get("dataAvailable"));
        if (available == null && dataAvailable == null) {
            return new AggregationGate(false, "MISSING_AVAILABILITY", "현재 기간 데이터 가용성이 명시되지 않아 합계에서 제외했습니다.");
        }
        if (Boolean.FALSE.equals(available) || Boolean.FALSE.equals(dataAvailable)) {
            return new AggregationGate(false, "NO_CURRENT_WINDOW_DATA", "현재 운영 기간에 인식된 합성 재무 이벤트가 없습니다.");
        }
        Boolean querySucceeded = booleanValue(body.get("querySucceeded"));
        BigDecimal financialEventCount = amount(body, "financialEventCount");
        boolean verifiedZeroActivity = Boolean.TRUE.equals(querySucceeded)
                && financialEventCount != null && financialEventCount.signum() == 0
                && revenue.signum() == 0 && cost.signum() == 0 && profit.signum() == 0;
        PeriodGate period = periodGate(scope, body.get("periodStart"), body.get("periodEnd"), body.get("sourceLatestEventAt"), verifiedZeroActivity);
        if (!period.included()) return new AggregationGate(false, period.status(), period.reason());
        return new AggregationGate(true, "INCLUDED", "동일 합성 통화의 검증된 현재 운영 기간 손익입니다.");
    }
    private boolean allowedScope(String key, String scope) {
        return switch (key) {
            case "market" -> "ROLLING_24H_RECOGNIZED_EVENTS".equals(scope);
            case "nexus" -> scope.equals("PUBLISHED_OUTBOX_EVENTS_LAST_24_HOURS")
                    || scope.startsWith("PUBLISHED_OUTBOX_EVENTS_LAST_24_HOURS_FALLBACK_");
            case "logitics" -> "ROLLING_24H_RECOGNIZED_NON_RUNTIME_LOGISTICS_EVENTS".equals(scope);
            case "ledger" -> "WORKDAY".equals(scope);
            case "archiveos" -> "ARCHIVEOS_CONTROL_TOWER_CURRENT_24H".equals(scope);
            default -> false;
        };
    }
    private PeriodGate periodGate(String scope, Object startValue, Object endValue, Object latestValue, boolean verifiedZeroActivity) {
        if (startValue == null || endValue == null) {
            return new PeriodGate(false, "MISSING_PERIOD", "계산 시작일과 종료일이 모두 필요합니다.");
        }
        if ("WORKDAY".equals(scope)) {
            LocalDate start = localDate(startValue);
            LocalDate end = localDate(endValue);
            if (start == null || end == null || start.isAfter(end) || ChronoUnit.DAYS.between(start, end) > 1) {
                return new PeriodGate(false, "INVALID_PERIOD", "업무일 계산 기간이 유효하지 않습니다.");
            }
            if (!end.equals(LocalDate.now(ZoneId.systemDefault()))) {
                return new PeriodGate(false, "STALE_PERIOD", "현재 업무일 계산이 아니어서 합계에서 제외했습니다.");
            }
            return new PeriodGate(true, "INCLUDED", "현재 업무일 범위입니다.");
        }
        Instant start = instant(startValue);
        Instant end = instant(endValue);
        if (start == null || end == null || start.isAfter(end)) {
            return new PeriodGate(false, "INVALID_PERIOD", "계산 기간 형식을 해석할 수 없습니다.");
        }
        if (latestValue == null && !verifiedZeroActivity) {
            return new PeriodGate(false, "MISSING_SOURCE_LINEAGE", "최신 원천 재무 이벤트 시각이 없어 합계에서 제외했습니다.");
        }
        Duration length = Duration.between(start, end);
        if (length.compareTo(Duration.ofHours(23)) < 0 || length.compareTo(Duration.ofHours(25)) > 0) {
            return new PeriodGate(false, "INVALID_PERIOD_LENGTH", "24시간 손익 계약의 기간 길이가 허용 범위를 벗어났습니다.");
        }
        Instant now = Instant.now();
        if (end.isBefore(now.minus(Duration.ofMinutes(10)))) {
            return new PeriodGate(false, "STALE_PERIOD", "계산 종료 시각이 오래되어 합계에서 제외했습니다.");
        }
        if (end.isAfter(now.plus(Duration.ofMinutes(5)))) {
            return new PeriodGate(false, "FUTURE_PERIOD", "계산 종료 시각이 현재보다 미래여서 합계에서 제외했습니다.");
        }
        if (!verifiedZeroActivity) {
            Instant latest = instant(latestValue);
            if (latest == null || latest.isBefore(start) || latest.isAfter(end)) {
                return new PeriodGate(false, "INVALID_SOURCE_LINEAGE", "최신 원천 이벤트 시각이 계산 기간 밖에 있습니다.");
            }
        }
        return new PeriodGate(true, "INCLUDED", verifiedZeroActivity ? "현재 24시간 조회가 정상 완료되었고 재무 이벤트가 0건입니다." : "검증된 최근 24시간 범위입니다.");
    }
    private record AggregationGate(boolean included, String status, String reason) { }
    private record PeriodGate(boolean included, String status, String reason) { }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private String string(Object value, String fallback) { return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value); }
    private String requiredText(Object value) { String text = value == null ? "" : String.valueOf(value).trim().toUpperCase(); return text.isBlank() ? null : text; }
    private Boolean booleanValue(Object value) { if (value instanceof Boolean bool) return bool; if (value == null) return null; String text = String.valueOf(value).trim(); return "true".equalsIgnoreCase(text) ? true : "false".equalsIgnoreCase(text) ? false : null; }
    private LocalDate localDate(Object value) { try { return value instanceof LocalDate date ? date : LocalDate.parse(String.valueOf(value)); } catch (RuntimeException error) { return null; } }
    private Instant instant(Object value) {
        try {
            if (value instanceof Instant instant) return instant;
            if (value instanceof OffsetDateTime offset) return offset.toInstant();
            if (value instanceof ZonedDateTime zoned) return zoned.toInstant();
            if (value instanceof LocalDateTime local) return local.atZone(ZoneId.systemDefault()).toInstant();
            String text = String.valueOf(value);
            try { return Instant.parse(text); } catch (RuntimeException ignored) { }
            try { return OffsetDateTime.parse(text).toInstant(); } catch (RuntimeException ignored) { }
            return LocalDateTime.parse(text).atZone(ZoneId.systemDefault()).toInstant();
        } catch (RuntimeException error) {
            return null;
        }
    }
    private BigDecimal amount(Map<String, Object> source, String... keys) { for (String key : keys) if (source.containsKey(key) && source.get(key) != null) return decimal(source.get(key)); return null; }
    private BigDecimal firstAmount(Map<String, Object> source, String... keys) { return amount(source, keys); }
    private BigDecimal decimal(Object value) { try { return value == null ? null : new BigDecimal(String.valueOf(value)); } catch (NumberFormatException error) { return null; } }
    private BigDecimal orZero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private BigDecimal ratio(BigDecimal value, BigDecimal total) { return value == null || total.signum() == 0 ? null : value.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP); }
    private Map<String, Object> financeBody(String key, Map<String, Object> source) {
        if ("archiveos".equals(key)) return archiveOsFinanceBody();
        Map<String, Object> candidate = financeCandidate(key, source);
        if (candidate.isEmpty()) return Map.of();
        Map<String, Object> result = new LinkedHashMap<>();
        for (String field : List.of("currency", "calculationScope", "periodStart", "periodEnd", "sourceLatestEventAt", "available", "dataAvailable", "financialEventCount", "querySucceeded")) {
            if (candidate.containsKey(field)) result.put(field, candidate.get(field));
        }
        BigDecimal revenue = switch (key) {
            case "market", "logitics", "ledger" -> amount(candidate, "recognizedRevenue");
            case "nexus" -> amount(candidate, "recognizedRevenue", "manufacturingRevenue", "revenue");
            default -> null;
        };
        BigDecimal cost = switch (key) {
            case "market" -> amount(candidate, "realizedOperatingCost", "totalExpense");
            case "nexus" -> amount(candidate, "realizedOperatingCost", "totalCost", "cost");
            case "logitics", "ledger" -> amount(candidate, "realizedOperatingCost");
            default -> null;
        };
        if (revenue != null) result.put("recognizedRevenue", revenue);
        if (cost != null) result.put("realizedOperatingCost", cost);
        if (!"logitics".equals(key) && candidate.containsKey("cashBalance")) result.put("cashBalance", candidate.get("cashBalance"));
        copyMetric(result, candidate, "backlogExposure", "approvalBacklog", "settlementBacklog", "feeConcentration", "negativeProfitStreak", "capacityUtilization");
        BigDecimal backlog = amount(candidate, "backlog", "backlogCount", "approvalBacklog");
        if (backlog == null) backlog = amount(source, "backlog", "backlogCount", "productionBacklog", "approvalRequired");
        if (backlog != null) result.put("backlog", backlog);
        Object runtimeActive = nestedValue(source, "runtime", "runtimeActive");
        if (runtimeActive == null) runtimeActive = nestedValue(map(source.get("operations")), "runtime", "runtimeActive");
        if (runtimeActive != null) result.put("runtimeActive", runtimeActive);
        return result;
    }
    private Map<String, Object> archiveOsFinanceBody() {
        Instant end = Instant.now();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("currency", "SYNTHETIC_KRW");
        result.put("calculationScope", "ARCHIVEOS_CONTROL_TOWER_CURRENT_24H");
        result.put("periodStart", end.minus(Duration.ofHours(24)).toString());
        result.put("periodEnd", end.toString());
        result.put("available", true);
        result.put("querySucceeded", true);
        result.put("financialEventCount", 0);
        result.put("recognizedRevenue", BigDecimal.ZERO);
        result.put("realizedOperatingCost", BigDecimal.ZERO);
        return result;
    }
    private Map<String, Object> financeCandidate(String key, Map<String, Object> source) {
        return switch (key) {
            case "market" -> firstMap(
                    map(unwrap(map(source.get("marketEconomy"))).get("economy")),
                    map(unwrap(map(source.get("operations"))).get("economy")),
                    map(source.get("economy")), source);
            case "nexus", "logitics" -> firstMap(
                    map(source.get("economy")),
                    map(unwrap(map(source.get("operations"))).get("economy")), source);
            case "ledger" -> firstMap(
                    map(source.get("balance")),
                    map(unwrap(map(source.get("settlementAgency"))).get("balance")), source);
            default -> Map.of();
        };
    }
    @SafeVarargs private final Map<String, Object> firstMap(Map<String, Object>... candidates) { for (Map<String, Object> candidate : candidates) if (!candidate.isEmpty()) return unwrap(candidate); return Map.of(); }
    private Map<String, Object> unwrap(Map<String, Object> value) { Map<String, Object> data = map(value.get("data")); if (!data.isEmpty()) return unwrap(data); Map<String, Object> summary = map(value.get("summary")); return !summary.isEmpty() && !value.containsKey("calculationScope") ? unwrap(summary) : value; }
    private Object nestedValue(Map<String, Object> source, String objectKey, String valueKey) { return map(source.get(objectKey)).get(valueKey); }
    private void copyMetric(Map<String, Object> target, Map<String, Object> source, String... keys) { for (String key : keys) if (source.containsKey(key)) target.put(key, source.get(key)); }
}
