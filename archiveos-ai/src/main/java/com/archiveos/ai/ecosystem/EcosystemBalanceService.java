package com.archiveos.ai.ecosystem;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Read-only explanation of synthetic cross-service financial and capacity balance. */
@Service
public class EcosystemBalanceService {
    private final EcosystemService ecosystem;

    public EcosystemBalanceService(EcosystemService ecosystem) { this.ecosystem = ecosystem; }

    public Map<String, Object> summary() {
        Map<String, Object> services = map(ecosystem.summary().get("services"));
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        for (String key : List.of("market", "nexus", "logitics", "ledger", "archiveos")) {
            Map<String, Object> source = "archiveos".equals(key) ? Map.of() : map(services.get(key));
            Map<String, Object> body = map(source.get("summary"));
            BigDecimal revenue = amount(body, "totalRevenue", "revenue", "revenueAmount");
            BigDecimal cost = amount(body, "totalCost", "cost", "costAmount");
            BigDecimal profit = amount(body, "profit", "profitAmount");
            BigDecimal cash = amount(body, "cashBalance", "cash", "balance");
            BigDecimal backlog = amount(body, "backlog", "pending", "approvalRequired");
            if ("archiveos".equals(key)) {
                revenue = BigDecimal.ZERO;
                cost = BigDecimal.ZERO;
                profit = BigDecimal.ZERO;
            }
            totalRevenue = totalRevenue.add(revenue);
            totalCost = totalCost.add(cost);
            totalProfit = totalProfit.add(profit);
            rows.add(row(key, source, revenue, cost, profit, cash, backlog));
        }
        for (Map<String, Object> row : rows) {
            BigDecimal profit = decimal(row.get("profit"));
            row.put("revenueShare", ratio(decimal(row.get("revenue")), totalRevenue));
            row.put("expenseShare", ratio(decimal(row.get("cost")), totalCost));
            row.put("profitShare", ratio(profit.max(BigDecimal.ZERO), totalProfit.max(BigDecimal.ZERO)));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("syntheticData", true);
        result.put("targetMargins", Map.of("market", "8-18%", "nexus", "5-12%", "logistics", "3-10%", "ledger", "4-12%", "archiveos", "0-8%"));
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
            BigDecimal margin = decimal(row.get("operatingMargin"));
            BigDecimal backlog = decimal(row.get("backlog"));
            if (margin.compareTo(BigDecimal.valueOf(40)) > 0) actions.add(action(service, "수익 집중", "영업이익률이 기준 범위를 크게 넘습니다. 수수료·비용 반영 기준을 검토하세요.", "READ_ONLY"));
            if (margin.compareTo(BigDecimal.valueOf(-10)) < 0) actions.add(action(service, "손익 악화", "손실 구간이므로 비용·처리량·수수료 구조를 점검하세요.", "READ_ONLY"));
            if (backlog.compareTo(BigDecimal.valueOf(20)) > 0) actions.add(action(service, "적체 증가", "처리 대기량이 높습니다. 작업 역량과 자동 처리 상태를 확인하세요.", "READ_ONLY"));
        }
        if (actions.isEmpty()) actions.add(action("archive-platform", "균형 범위", "현재 수집된 합성 지표에서 즉시 조정이 필요한 불균형은 없습니다.", "READ_ONLY"));
        return Map.of("syntheticData", true, "recommendations", actions);
    }

    public Map<String, Object> simulate(Map<String, Object> request) {
        return Map.of("status", "DRY_RUN", "syntheticData", true, "message", "외부 수수료나 자금은 변경하지 않았습니다.", "current", summary(), "request", request == null ? Map.of() : request);
    }

    private Map<String, Object> row(String key, Map<String, Object> source, BigDecimal revenue, BigDecimal cost, BigDecimal profit, BigDecimal cash, BigDecimal backlog) {
        BigDecimal margin = revenue.signum() == 0 ? BigDecimal.ZERO : profit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("serviceId", "archiveos".equals(key) ? "archiveos" : "logitics".equals(key) ? "archive-logistics" : "archive-" + key);
        row.put("serviceName", "archiveos".equals(key) ? "ArchiveOS" : string(source.get("name"), "Archive-" + key));
        row.put("status", "archiveos".equals(key) ? "HEALTHY" : string(source.get("status"), "UNKNOWN"));
        row.put("revenue", revenue); row.put("cost", cost); row.put("profit", profit); row.put("cashBalance", cash); row.put("backlog", backlog);
        row.put("operatingMargin", margin);
        row.put("balance", margin.compareTo(BigDecimal.valueOf(40)) > 0 ? "CONCENTRATED" : margin.compareTo(BigDecimal.valueOf(-10)) < 0 ? "UNDER_PRESSURE" : "WITHIN_RANGE");
        return row;
    }
    private Map<String, Object> action(String service, String title, String reason, String mode) { return Map.of("serviceId", service, "title", title, "reason", reason, "mode", mode); }
    private String balanceStatus(List<Map<String, Object>> rows) { return rows.stream().anyMatch(row -> "UNDER_PRESSURE".equals(row.get("balance"))) ? "WATCH" : rows.stream().anyMatch(row -> "CONCENTRATED".equals(row.get("balance"))) ? "REVIEW" : "BALANCED"; }
    private String reviewReason(List<Map<String, Object>> rows) {
        return rows.stream().filter(row -> "CONCENTRATED".equals(row.get("balance"))).findFirst()
                .map(row -> row.get("serviceName") + " 수익 집중도가 권장 범위를 초과했습니다.")
                .orElseGet(() -> rows.stream().filter(row -> "UNDER_PRESSURE".equals(row.get("balance"))).findFirst()
                        .map(row -> row.get("serviceName") + " 손익이 권장 범위 아래입니다.").orElse("현재 수집된 합성 지표는 균형 범위에 있습니다."));
    }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private String string(Object value, String fallback) { return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value); }
    private BigDecimal amount(Map<String, Object> source, String... keys) { for (String key : keys) if (source.get(key) != null) return decimal(source.get(key)); return BigDecimal.ZERO; }
    private BigDecimal decimal(Object value) { try { return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value)); } catch (NumberFormatException error) { return BigDecimal.ZERO; } }
    private BigDecimal ratio(BigDecimal value, BigDecimal total) { return total.signum() == 0 ? BigDecimal.ZERO : value.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP); }
}
