package com.archiveos.ai.ecosystem;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
            Map<String, Object> body = financeBody(map(source.get("summary")));
            BigDecimal revenue = revenueFor(key, body);
            BigDecimal cost = costFor(key, body);
            BigDecimal profit = profitFor(key, body);
            if (profit == null && revenue != null && cost != null) profit = revenue.subtract(cost);
            BigDecimal cash = amount(body, "cashBalance", "availableCash", "cash", "balance");
            BigDecimal backlog = amount(body, "backlog", "pending", "approvalRequired");
            if (!"archiveos".equals(key)) {
                totalRevenue = totalRevenue.add(orZero(revenue));
                totalCost = totalCost.add(orZero(cost));
                totalProfit = totalProfit.add(orZero(profit));
            }
            rows.add(row(key, source, body, revenue, cost, profit, cash, backlog));
        }
        for (Map<String, Object> row : rows) {
            row.put("revenueShare", ratio(decimal(row.get("revenue")), totalRevenue));
            row.put("expenseShare", ratio(decimal(row.get("cost")), totalCost));
            BigDecimal rowProfit = decimal(row.get("profit"));
            row.put("profitShare", ratio(rowProfit == null ? null : rowProfit.max(BigDecimal.ZERO), totalProfit.max(BigDecimal.ZERO)));
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
        result.put("totals", Map.of("revenue", totalRevenue, "cost", totalCost, "profit", totalProfit));
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
        BigDecimal margin = revenue == null || revenue.signum() == 0 || profit == null ? null : profit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("serviceId", "archiveos".equals(key) ? "archiveos" : "logitics".equals(key) ? "archive-logistics" : "archive-" + key);
        row.put("serviceName", "archiveos".equals(key) ? "ArchiveOS" : string(source.get("name"), "Archive-" + key));
        row.put("status", "archiveos".equals(key) ? "HEALTHY" : string(source.get("status"), "UNKNOWN"));
        row.put("financeSource", key + " latest summary");
        row.put("revenue", revenue); row.put("cost", cost); row.put("profit", profit); row.put("cashBalance", cash); row.put("backlog", backlog);
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
        BigDecimal margin = decimal(row.get("operatingMargin"));
        BigDecimal min = decimal(row.get("targetMinMargin"));
        BigDecimal max = decimal(row.get("targetMaxMargin"));
        if (margin == null || min == null || max == null) { row.put("balance", "NO_DATA"); row.put("balanceReason", "손익률을 판단할 수 있는 합성 재무 데이터가 아직 수집되지 않았습니다."); return; }
        if (margin.compareTo(max) > 0) { row.put("balance", "CONCENTRATED"); row.put("balanceReason", "영업이익률이 정책 상한을 초과했습니다."); return; }
        if (margin.compareTo(min) < 0) { row.put("balance", "UNDER_PRESSURE"); row.put("balanceReason", "영업이익률이 정책 하한보다 낮습니다."); return; }
        row.put("balance", "WITHIN_RANGE"); row.put("balanceReason", "영업이익률이 정책 목표 범위 안에 있습니다.");
    }

    private Map<String, Object> action(String service, String title, String reason, String mode) { return Map.of("serviceId", service, "title", title, "reason", reason, "mode", mode); }
    private String balanceStatus(List<Map<String, Object>> rows) { long available = rows.stream().filter(row -> !"NO_DATA".equals(row.get("balance"))).count(); if (available == 0) return "NO_DATA"; if (available < rows.size()) return "PARTIAL_DATA"; return rows.stream().anyMatch(row -> "UNDER_PRESSURE".equals(row.get("balance")) || "CONCENTRATED".equals(row.get("balance")) || concentrationExceeded(row)) ? "COMPLETE_REVIEW" : "COMPLETE_BALANCED"; }
    private String reviewReason(List<Map<String, Object>> rows) { long missing = rows.stream().filter(row -> "NO_DATA".equals(row.get("balance"))).count(); if (missing == rows.size()) return "수집된 재무 데이터가 없어 생태계 균형을 평가할 수 없습니다."; if (missing > 0) return "일부 서비스의 재무 데이터가 아직 수집되지 않아 생태계 균형은 부분 평가 상태입니다."; return rows.stream().filter(row -> "UNDER_PRESSURE".equals(row.get("balance"))).findFirst().map(row -> row.get("serviceName") + " 손익이 권장 범위 아래입니다.").orElse("현재 수집된 합성 지표는 균형 범위에 있습니다."); }
    private boolean concentrationExceeded(Map<String, Object> row) { BigDecimal share = decimal(row.get("profitShare")); return share != null && share.compareTo(BigDecimal.valueOf(policy.getProfitConcentrationPercent())) > 0; }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private String string(Object value, String fallback) { return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value); }
    private BigDecimal amount(Map<String, Object> source, String... keys) { for (String key : keys) if (source.containsKey(key) && source.get(key) != null) return decimal(source.get(key)); return null; }
    private BigDecimal firstAmount(Map<String, Object> source, String... keys) { return amount(source, keys); }
    private BigDecimal decimal(Object value) { try { return value == null ? null : new BigDecimal(String.valueOf(value)); } catch (NumberFormatException error) { return null; } }
    private BigDecimal orZero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private BigDecimal ratio(BigDecimal value, BigDecimal total) { return value == null || total.signum() == 0 ? null : value.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP); }
    private BigDecimal revenueFor(String key, Map<String, Object> body) { return switch (key) { case "market" -> amount(body, "recognizedRevenue", "totalRevenue", "revenue"); case "nexus" -> amount(body, "manufacturingRevenue", "totalRevenue", "revenue"); case "logitics" -> amount(body, "logisticsRevenue", "totalRevenue", "revenue"); case "ledger" -> amount(body, "settlementAgencyRevenue", "totalRevenue", "revenue"); default -> amount(body, "costRecoveryRevenue", "totalRevenue", "revenue"); }; }
    private BigDecimal costFor(String key, Map<String, Object> body) { return switch (key) { case "market" -> amount(body, "totalExpense", "totalCost", "cost"); case "nexus" -> amount(body, "totalCost", "materialCost", "maintenanceCost", "qualityLossCost", "workforceCost"); case "logitics" -> amount(body, "totalCost", "fuelCost", "tollCost", "workforceCost", "delayPenaltyCost"); case "ledger" -> amount(body, "operatingCost", "totalCost", "cost"); default -> amount(body, "operatingCost", "totalCost", "cost"); }; }
    private BigDecimal profitFor(String key, Map<String, Object> body) { return amount(body, "operatingProfit", "profit", "profitAmount"); }
    private Map<String, Object> financeBody(Map<String, Object> source) { Map<String, Object> result = new LinkedHashMap<>(source); for (String key : List.of("data", "summary", "economy", "marketEconomy", "settlementAgency", "cashflow", "workforce")) if (result.get(key) instanceof Map<?, ?>) result.putAll(financeBody(map(result.get(key)))); return result; }
}
