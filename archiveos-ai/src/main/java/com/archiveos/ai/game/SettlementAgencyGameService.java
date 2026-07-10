package com.archiveos.ai.game;

import com.archiveos.ai.ecosystem.EcosystemProperties;
import com.archiveos.ai.ecosystem.IntegrationResult;
import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.market.MarketClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class SettlementAgencyGameService {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private final LedgerClient ledger;
    private final MarketClient market;
    private final EcosystemProperties properties;
    private final GameFinanceRepository finance;

    public SettlementAgencyGameService(LedgerClient ledger, MarketClient market, EcosystemProperties properties, GameFinanceRepository finance) {
        this.ledger = ledger;
        this.market = market;
        this.properties = properties;
        this.finance = finance;
    }

    public Map<String, Object> summary() {
        return simulate(Map.of(), true);
    }

    public Map<String, Object> preset() {
        IntegrationResult result = ledger.settlementGamePreset();
        if (result.ok() && !result.body().isEmpty()) {
            return decoratePreset(new LinkedHashMap<>(result.body()), "Archive-Ledger");
        }
        return decoratePreset(defaultPreset(), "ArchiveOS fallback");
    }

    public Map<String, Object> simulate(Map<String, Object> input, boolean dryRun) {
        Map<String, Object> request = merge(merge(defaultPreset(), marketEconomyPreset()), input == null ? Map.of() : input);
        request.put("maxHop", clamp(intValue(request.get("maxHop"), 4), 1, 12));
        if (dryRun) request.put("dryRun", true);

        IntegrationResult ledgerResult = ledger.settlementGameSimulate(request);
        Map<String, Object> response;
        String simulationSource;
        String ledgerError = null;
        if (ledgerResult.ok() && !ledgerResult.body().isEmpty()) {
            response = new LinkedHashMap<>(ledgerResult.body());
            simulationSource = "Archive-Ledger";
        } else {
            response = simulateLocally(request);
            simulationSource = "ArchiveOS fallback";
            ledgerError = ledgerResult.errorMessage();
        }
        response.put("simulationSource", simulationSource);
        response.put("syntheticData", true);
        response.put("dryRun", dryRun);
        response.put("gameNamespace", "GAME/SIMULATION");
        response.put("safeMode", properties.getIntegration().isSafeMode());
        response.put("allowExternalWrite", properties.getIntegration().isAllowExternalWrite());
        response.put("agentMode", "PROPOSAL_ONLY");
        response.put("writePolicy", properties.getIntegration().isAllowExternalWrite()
                ? "External writes still require explicit user decision/approval."
                : "External writes are blocked by default. Agents only propose actions.");
        response.put("processedEventGuard", Map.of(
                "maxHop", intValue(response.get("maxHop"), intValue(request.get("maxHop"), 4)),
                "idempotencyKeys", List.of("eventId", "idempotencyKey", "simulationRunId", "settlementCycleId", "tickId"),
                "infiniteLoopGuard", "Events with hop > maxHop are ignored and processed idempotency keys must not be replayed."
        ));
        if (ledgerError != null) response.put("ledgerSimulationError", ledgerError);
        ensureMarketService(response, request);
        persistFinance(response);
        return response;
    }

    public Map<String, Object> financeSummary() {
        return finance.financeSummary();
    }

    public Map<String, Object> systemFinance(String systemId) {
        return finance.systemFinance(systemId);
    }

    private Map<String, Object> decoratePreset(Map<String, Object> preset, String source) {
        preset.put("simulationSource", source);
        preset.put("syntheticData", true);
        preset.put("gameNamespace", "GAME/SIMULATION");
        preset.put("safeMode", properties.getIntegration().isSafeMode());
        preset.put("allowExternalWrite", properties.getIntegration().isAllowExternalWrite());
        return preset;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> marketEconomyPreset() {
        if (market == null) return Map.of();
        IntegrationResult result = market.marketEconomySummary();
        if (!result.ok() || result.body().isEmpty()) {
            Map<String, Object> unavailable = new LinkedHashMap<>();
            unavailable.put("marketDataStatus", "UNAVAILABLE");
            unavailable.put("marketDataError", result.errorMessage());
            return unavailable;
        }
        Map<String, Object> body = responseData(result.body());
        Map<String, Object> orders = body.get("orders") instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        Map<String, Object> finance = body.get("economy") instanceof Map<?, ?> map ? (Map<String, Object>) map
                : body.get("finance") instanceof Map<?, ?> map ? (Map<String, Object>) map : body;
        Map<String, Object> preset = new LinkedHashMap<>();
        preset.put("marketDataStatus", "HEALTHY");
        putIfPresent(preset, "marketSalesRevenue", firstNonNull(finance.get("totalRevenue"), finance.get("revenue"), body.get("totalRevenue")));
        putIfPresent(preset, "marketRefundCost", firstNonNull(finance.get("refundCost"), body.get("refundCost")));
        putIfPresent(preset, "marketClaimCost", firstNonNull(finance.get("claimCost"), body.get("claimCost")));
        putIfPresent(preset, "marketHighRiskOrders", firstNonNull(orders.get("highRiskOrders"), body.get("highRiskOrders")));
        return preset;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> responseData(Map<String, Object> response) {
        Object data = response.get("data");
        return data instanceof Map<?, ?> map ? (Map<String, Object>) map : response;
    }

    @SuppressWarnings("unchecked")
    private void ensureMarketService(Map<String, Object> response, Map<String, Object> request) {
        Object servicesValue = response.get("services");
        if (!(servicesValue instanceof Map<?, ?> rawServices)) return;
        Map<String, Object> services = (Map<String, Object>) rawServices;
        if (services.containsKey("market")) return;
        BigDecimal revenue = money(request.get("marketSalesRevenue"));
        BigDecimal cost = money(request.get("marketRefundCost"))
                .add(money(request.get("marketClaimCost")))
                .add(money(request.get("marketProductionRequestCost")))
                .add(money(request.get("marketLedgerSettlementFee")));
        services.put("market", economics("Archive-Market", money(request.get("marketInitialCash")), revenue, cost,
                "Synthetic commerce revenue minus refund, claim, production request, and Ledger settlement fees."));
        response.put("marketDataStatus", "HEALTHY");
    }

    private Map<String, Object> simulateLocally(Map<String, Object> r) {
        String run = stringValue(r.get("simulationRunId"), "SIM-RUN-" + UUID.randomUUID());
        int day = Math.max(1, intValue(r.get("day"), 1));
        String cycle = stringValue(r.get("settlementCycleId"), "CYCLE-DAY-" + day);
        String tick = stringValue(r.get("tickId"), "TICK-" + day);
        String correlation = stringValue(r.get("correlationId"), UUID.randomUUID().toString());
        int maxHop = clamp(intValue(r.get("maxHop"), 4), 1, 12);

        BigDecimal marketRevenue = money(r.get("marketSalesRevenue"));
        BigDecimal marketCost = money(r.get("marketRefundCost"))
                .add(money(r.get("marketClaimCost")))
                .add(money(r.get("marketProductionRequestCost")))
                .add(money(r.get("marketLedgerSettlementFee")));
        BigDecimal nexusRevenue = money(r.get("nexusProductionRevenue"));
        BigDecimal nexusCost = money(r.get("nexusMaterialCost"))
                .add(money(r.get("nexusMaintenanceCost")))
                .add(money(r.get("nexusQualityLossCost")))
                .add(money(r.get("logisticsServiceFee")))
                .add(money(r.get("logisticsDailySettlementFee")));
        BigDecimal logisticsRevenue = money(r.get("logisticsServiceFee")).add(money(r.get("logisticsDailySettlementFee")));
        BigDecimal logisticsCost = money(r.get("ledgerDailySettlementAgencyFee"))
                .add(money(r.get("ledgerReconciliationVerificationFee")))
                .add(money(r.get("ledgerTransactionProcessingFee")).multiply(count(r.get("transactionCount"))));
        BigDecimal ledgerRevenue = money(r.get("ledgerTransactionProcessingFee")).multiply(count(r.get("transactionCount")))
                .add(money(r.get("ledgerDailySettlementAgencyFee")).multiply(count(r.get("settlementBatchCount"))))
                .add(money(r.get("ledgerReconciliationVerificationFee")).multiply(count(r.get("reconciliationCount"))))
                .add(money(r.get("ledgerApprovalReviewFee")).multiply(count(r.get("approvalReviewCount"))))
                .add(money(r.get("ledgerExceptionHandlingFee")).multiply(count(r.get("exceptionCount"))))
                .add(money(r.get("ledgerEarlySettlementFee")))
                .add(money(r.get("ledgerDelayedSettlementPenaltyRevenue")));
        BigDecimal ledgerCost = money(r.get("ledgerProcessingOperatingCost")).multiply(count(r.get("transactionCount")))
                .add(money(r.get("ledgerSettlementBatchRunCost")).multiply(count(r.get("settlementBatchCount"))))
                .add(money(r.get("ledgerReconciliationRunCost")).multiply(count(r.get("reconciliationCount"))))
                .add(money(r.get("ledgerCallbackFailureCost")).multiply(count(r.get("callbackFailureCount"))))
                .add(money(r.get("ledgerMismatchInvestigationCost")).multiply(count(r.get("mismatchCount"))))
                .add(money(r.get("ledgerInfraFixedCost")));

        Map<String, Object> services = new LinkedHashMap<>();
        services.put("market", economics("Archive-Market", money(r.get("marketInitialCash")), marketRevenue, marketCost,
                "Synthetic commerce revenue minus refund, claim, production request, and Ledger settlement fees."));
        services.put("nexus", economics("Archive-Nexus", money(r.get("nexusInitialCash")), nexusRevenue, nexusCost,
                "Production revenue minus material, maintenance, quality loss, and Logistics fees."));
        services.put("logistics", economics("Archive-Logistics", money(r.get("logisticsInitialCash")), logisticsRevenue, logisticsCost,
                "Route/ETA/cost service revenue minus Ledger processing and settlement agency fees."));
        services.put("ledger", economics("Archive-Ledger", money(r.get("ledgerInitialCash")), ledgerRevenue, ledgerCost,
                "Settlement agency revenue minus transaction, batch, reconciliation, callback, mismatch, and fixed operating costs."));

        BigDecimal ecosystemCash = ZERO;
        BigDecimal ecosystemProfit = ZERO;
        for (Object value : services.values()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> item = (Map<String, Object>) value;
            ecosystemCash = ecosystemCash.add(decimal(item.get("cashAfter")));
            ecosystemProfit = ecosystemProfit.add(decimal(item.get("profit")));
        }
        String ecosystemRisk = risk(ecosystemCash, ecosystemProfit.signum() < 0 ? ecosystemProfit.abs() : ZERO);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("simulationRunId", run);
        response.put("settlementCycleId", cycle);
        response.put("tickId", tick);
        response.put("day", day);
        response.put("correlationId", correlation);
        response.put("maxHop", maxHop);
        response.put("status", "CRITICAL".equals(ecosystemRisk) ? "BANKRUPTCY_RISK" : "WARNING".equals(ecosystemRisk) ? "ATTENTION" : "RUNNING");
        response.put("ecosystemCashBalance", ecosystemCash);
        response.put("ecosystemDailyProfit", ecosystemProfit);
        response.put("bankruptcyRisk", ecosystemRisk);
        response.put("services", services);
        response.put("events", gameEvents(run, cycle, tick, day, correlation, maxHop, r, ledgerRevenue, ledgerCost));
        response.put("proposals", proposals(services, ecosystemRisk, r));
        response.put("createdAt", Instant.now().toString());
        return response;
    }

    @SuppressWarnings("unchecked")
    private void persistFinance(Map<String, Object> response) {
        String run = stringValue(response.get("simulationRunId"), "SIM-RUN-UNKNOWN");
        String cycle = stringValue(response.get("settlementCycleId"), "CYCLE-UNKNOWN");
        String tick = stringValue(response.get("tickId"), "TICK-UNKNOWN");
        int day = intValue(response.get("day"), 1);
        String correlation = stringValue(response.get("correlationId"), run + ":" + tick);
        Object servicesValue = response.get("services");
        if (!(servicesValue instanceof Map<?, ?> services)) {
            return;
        }
        for (Map.Entry<?, ?> entry : services.entrySet()) {
            if (entry.getValue() instanceof Map<?, ?> service) {
                finance.upsertSnapshot(run, cycle, tick, day, correlation, systemId(String.valueOf(entry.getKey())), (Map<String, Object>) service);
            }
        }
        persistTrades(run, cycle, tick, day, correlation, response);
    }

    private void persistTrades(String run, String cycle, String tick, int day, String correlation, Map<String, Object> response) {
        String prefix = run + ":" + tick + ":";
        finance.insertTrade(prefix + "market-commerce-revenue", run, cycle, tick, day, correlation,
                "synthetic-customer", "archive-market", "MARKET_SYNTHETIC_ORDER_REVENUE",
                money(nested(response, "services", "market", "revenue")), "Archive-Market receives synthetic order, payment, and revenue events.",
                Map.of("flow", "Market demand and revenue source", "syntheticData", true));
        finance.insertTrade(prefix + "market-production-request", run, cycle, tick, day, correlation,
                "archive-market", "archive-nexus", "MARKET_PRODUCTION_REQUEST_EXPORT",
                money(nested(response, "services", "market", "cost")), "Archive-Market requests Nexus production and shipment handling for synthetic orders.",
                Map.of("flow", "Market to Nexus production request", "syntheticData", true));
        finance.insertTrade(prefix + "market-ledger-settlement-event", run, cycle, tick, day, correlation,
                "archive-market", "archive-ledger", "MARKET_SALES_REFUND_CLAIM_SETTLEMENT_EXPORT",
                money(nested(response, "services", "market", "revenue")), "Archive-Market sends synthetic sales, refund, return, and claim settlement events to Ledger.",
                Map.of("flow", "Market to Ledger commerce settlement", "syntheticData", true));
        finance.insertTrade(prefix + "nexus-manufacturing-export", run, cycle, tick, day, correlation,
                "archive-nexus", "synthetic-market", "MANUFACTURING_OUTPUT_EXPORT",
                money(nested(response, "services", "nexus", "revenue")), "Nexus exports synthetic manufacturing output revenue.",
                Map.of("flow", "Nexus manufactures", "syntheticData", true));
        finance.insertTrade(prefix + "logistics-service-export", run, cycle, tick, day, correlation,
                "archive-logitics", "archive-nexus", "LOGISTICS_SERVICE_EXPORT",
                money(nested(response, "services", "logistics", "revenue")), "Logistics exports route, delivery, and daily settlement service to Nexus.",
                Map.of("flow", "Logistics fulfills and charges Nexus", "syntheticData", true));
        finance.insertTrade(prefix + "ledger-settlement-export", run, cycle, tick, day, correlation,
                "archive-ledger", "archive-logitics", "LEDGER_DAILY_SETTLEMENT_EXPORT",
                money(nested(response, "services", "ledger", "revenue")), "Ledger exports transaction processing, daily settlement, reconciliation, and approval review services.",
                Map.of("flow", "Ledger settles daily for Logistics", "syntheticData", true));
        finance.insertTrade(prefix + "logistics-cost-back", run, cycle, tick, day, correlation,
                "archive-logitics", "archive-nexus", "MANUFACTURING_COST_SETTLEMENT_EXPORT",
                money(nested(response, "services", "nexus", "cost")), "Logistics charges Nexus for manufacturing-linked logistics and settlement costs.",
                Map.of("flow", "Logistics returns manufacturing cost settlement to Nexus", "syntheticData", true));
    }

    private String systemId(String key) {
        return switch (key) {
            case "market" -> "archive-market";
            case "nexus" -> "archive-nexus";
            case "logistics", "logitics" -> "archive-logitics";
            case "ledger" -> "archive-ledger";
            case "archiveos", "archive-os" -> "archiveos";
            default -> key;
        };
    }

    @SuppressWarnings("unchecked")
    private Object nested(Map<String, Object> root, String first, String second, String third) {
        Object firstValue = root.get(first);
        if (!(firstValue instanceof Map<?, ?> firstMap)) return ZERO;
        Object secondValue = ((Map<String, Object>) firstMap).get(second);
        if (!(secondValue instanceof Map<?, ?> secondMap)) return ZERO;
        return ((Map<String, Object>) secondMap).get(third);
    }

    private Map<String, Object> economics(String service, BigDecimal cash, BigDecimal revenue, BigDecimal cost, String explanation) {
        BigDecimal profit = revenue.subtract(cost);
        BigDecimal cashAfter = cash.add(profit);
        BigDecimal burnRate = profit.signum() < 0 ? profit.abs() : ZERO;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("service", service);
        out.put("cashBefore", cash);
        out.put("revenue", revenue);
        out.put("cost", cost);
        out.put("profit", profit);
        out.put("cashAfter", cashAfter);
        out.put("burnRate", burnRate);
        out.put("bankruptcyRisk", risk(cashAfter, burnRate));
        out.put("explanation", explanation);
        return out;
    }

    private List<Map<String, Object>> gameEvents(String run, String cycle, String tick, int day, String correlation, int maxHop,
                                                Map<String, Object> r, BigDecimal ledgerRevenue, BigDecimal ledgerCost) {
        List<Map<String, Object>> events = new ArrayList<>();
        addEvent(events, "MARKET_SYNTHETIC_ORDER_REVENUE", "Archive-Market", "ArchiveOS", run, cycle, tick, day, correlation, 1, maxHop,
                Map.of("salesRevenue", money(r.get("marketSalesRevenue")), "refundCost", money(r.get("marketRefundCost")),
                        "claimCost", money(r.get("marketClaimCost")), "highRiskOrders", intValue(r.get("marketHighRiskOrders"), 0)));
        addEvent(events, "GAME_NEXUS_PRODUCTION_PROFIT", "Archive-Nexus", "ArchiveOS", run, cycle, tick, day, correlation, 2, maxHop,
                Map.of("productionRevenue", money(r.get("nexusProductionRevenue")), "materialCost", money(r.get("nexusMaterialCost"))));
        addEvent(events, "GAME_LOGISTICS_DAILY_SETTLEMENT_FEE", "Archive-Logistics", "Archive-Nexus", run, cycle, tick, day, correlation, 3, maxHop,
                Map.of("shipmentCount", intValue(r.get("shipmentCount"), 0), "logisticsServiceFee", money(r.get("logisticsServiceFee")),
                        "dailySettlementFee", money(r.get("logisticsDailySettlementFee"))));
        addEvent(events, "GAME_LEDGER_SETTLEMENT_AGENCY_REVENUE", "Archive-Ledger", "ArchiveOS", run, cycle, tick, day, correlation, 4, maxHop,
                Map.of("ledgerRevenue", ledgerRevenue, "ledgerCost", ledgerCost, "transactionCount", intValue(r.get("transactionCount"), 0),
                        "mismatchCount", intValue(r.get("mismatchCount"), 0)));
        addEvent(events, "GAME_ARCHIVEOS_BANKRUPTCY_RISK_REVIEW", "ArchiveOS", "Archive Platform", run, cycle, tick, day, correlation, 5, maxHop,
                Map.of("safeMode", properties.getIntegration().isSafeMode(), "agentMode", "PROPOSAL_ONLY"));
        return events.stream().filter(event -> intValue(event.get("hop"), 0) <= intValue(event.get("maxHop"), maxHop)).toList();
    }

    private void addEvent(List<Map<String, Object>> events, String type, String source, String target, String run, String cycle,
                          String tick, int day, String correlation, int hop, int maxHop, Map<String, Object> payload) {
        String idempotency = run + ":" + cycle + ":" + tick + ":" + type + ":" + hop;
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", "GAME-" + Math.abs(idempotency.hashCode()));
        event.put("idempotencyKey", idempotency);
        event.put("eventType", type);
        event.put("source", source);
        event.put("target", target);
        event.put("simulationRunId", run);
        event.put("settlementCycleId", cycle);
        event.put("tickId", tick);
        event.put("day", day);
        event.put("correlationId", correlation);
        event.put("hop", hop);
        event.put("maxHop", maxHop);
        event.put("payload", payload);
        events.add(event);
    }

    private List<Map<String, Object>> proposals(Map<String, Object> services, String ecosystemRisk, Map<String, Object> r) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object value : services.values()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> service = (Map<String, Object>) value;
            String risk = String.valueOf(service.get("bankruptcyRisk"));
            if (!"LOW".equals(risk)) {
                String serviceName = String.valueOf(service.get("service"));
                out.add(proposal("PROP-" + serviceName.replace("Archive-", "").toUpperCase(Locale.ROOT),
                        serviceName + "Agent", serviceName, "GAME_PROPOSAL",
                        serviceName + " cash risk is " + risk + ". Reduce costs, raise synthetic service fees, or pause risky settlement cycles.",
                        money(service.get("burnRate")), 0.78,
                        List.of("cashAfter=" + service.get("cashAfter"), "profit=" + service.get("profit"), "burnRate=" + service.get("burnRate"))));
            }
        }
        if (!"LOW".equals(ecosystemRisk)) {
            out.add(proposal("PROP-ECOSYSTEM-SAFE-MODE", "ArchiveOSGameMasterAgent", "Archive Platform",
                    "SAFE_MODE_RECOMMENDATION",
                    "Require PM/Admin approval before fee policy, early settlement, or external write changes.",
                    money(r.get("ledgerInfraFixedCost")), 0.82,
                    List.of("ecosystemRisk=" + ecosystemRisk, "simulation namespace is GAME/SIMULATION", "agents propose only")));
        }
        return out;
    }

    private Map<String, Object> proposal(String id, String agent, String target, String type, String summary,
                                         BigDecimal impact, double confidence, List<String> evidence) {
        Map<String, Object> proposal = new LinkedHashMap<>();
        proposal.put("proposalId", id);
        proposal.put("agentName", agent);
        proposal.put("targetService", target);
        proposal.put("actionType", type);
        proposal.put("summary", summary);
        proposal.put("expectedCashImpact", impact);
        proposal.put("confidence", confidence);
        proposal.put("safeModeRequired", true);
        proposal.put("approvalRequired", true);
        proposal.put("evidence", evidence);
        return proposal;
    }

    private Map<String, Object> defaultPreset() {
        Map<String, Object> preset = new LinkedHashMap<>();
        preset.put("simulationRunId", "SIM-RUN-DEMO-001");
        preset.put("settlementCycleId", "CYCLE-DAY-001");
        preset.put("tickId", "TICK-001");
        preset.put("day", 1);
        preset.put("correlationId", "CORR-DEMO-001");
        preset.put("maxHop", 5);
        preset.put("marketInitialCash", bd("40000000"));
        preset.put("marketSalesRevenue", bd("26000000"));
        preset.put("marketRefundCost", bd("1200000"));
        preset.put("marketClaimCost", bd("700000"));
        preset.put("marketProductionRequestCost", bd("7200000"));
        preset.put("marketLedgerSettlementFee", bd("420000"));
        preset.put("marketHighRiskOrders", 6);
        preset.put("nexusInitialCash", bd("50000000"));
        preset.put("logisticsInitialCash", bd("30000000"));
        preset.put("ledgerInitialCash", bd("25000000"));
        preset.put("nexusProductionRevenue", bd("18000000"));
        preset.put("nexusMaterialCost", bd("6200000"));
        preset.put("nexusMaintenanceCost", bd("1700000"));
        preset.put("nexusQualityLossCost", bd("900000"));
        preset.put("logisticsServiceFee", bd("2100000"));
        preset.put("logisticsDailySettlementFee", bd("350000"));
        preset.put("shipmentCount", 120);
        preset.put("transactionCount", 180);
        preset.put("settlementBatchCount", 1);
        preset.put("reconciliationCount", 1);
        preset.put("approvalReviewCount", 9);
        preset.put("exceptionCount", 4);
        preset.put("callbackFailureCount", 2);
        preset.put("mismatchCount", 1);
        preset.put("ledgerTransactionProcessingFee", bd("1200"));
        preset.put("ledgerDailySettlementAgencyFee", bd("450000"));
        preset.put("ledgerReconciliationVerificationFee", bd("250000"));
        preset.put("ledgerApprovalReviewFee", bd("80000"));
        preset.put("ledgerExceptionHandlingFee", bd("150000"));
        preset.put("ledgerEarlySettlementFee", bd("220000"));
        preset.put("ledgerDelayedSettlementPenaltyRevenue", bd("100000"));
        preset.put("ledgerProcessingOperatingCost", bd("350"));
        preset.put("ledgerSettlementBatchRunCost", bd("160000"));
        preset.put("ledgerReconciliationRunCost", bd("120000"));
        preset.put("ledgerCallbackFailureCost", bd("60000"));
        preset.put("ledgerMismatchInvestigationCost", bd("180000"));
        preset.put("ledgerInfraFixedCost", bd("950000"));
        return preset;
    }

    private Map<String, Object> merge(Map<String, Object> defaults, Map<String, Object> input) {
        Map<String, Object> out = new LinkedHashMap<>(defaults);
        input.forEach((key, value) -> {
            if (value != null) out.put(key, value);
        });
        return out;
    }

    private void putIfPresent(Map<String, Object> target, String key, Object value) {
        if (value != null) target.put(key, value);
    }

    private Object firstNonNull(Object... values) {
        for (Object value : values) if (value != null) return value;
        return null;
    }

    private String risk(BigDecimal cashAfter, BigDecimal burn) {
        if (cashAfter.signum() <= 0) return "CRITICAL";
        if (burn.signum() == 0) return "LOW";
        BigDecimal runway = cashAfter.divide(burn.max(BigDecimal.ONE), 2, RoundingMode.HALF_UP);
        if (runway.compareTo(BigDecimal.valueOf(2)) <= 0) return "CRITICAL";
        if (runway.compareTo(BigDecimal.valueOf(7)) <= 0) return "WARNING";
        return "LOW";
    }

    private BigDecimal money(Object value) {
        if (value == null) return ZERO;
        try { return new BigDecimal(String.valueOf(value)).max(ZERO); }
        catch (NumberFormatException ignored) { return ZERO; }
    }
    private BigDecimal decimal(Object value) {
        if (value == null) return ZERO;
        try { return new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return ZERO; }
    }
    private BigDecimal count(Object value) { return BigDecimal.valueOf(Math.max(0, intValue(value, 0))); }
    private int intValue(Object value, int fallback) {
        if (value instanceof Number number) return number.intValue();
        try { return value == null ? fallback : Integer.parseInt(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }
    private String stringValue(Object value, String fallback) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isBlank() ? fallback : text;
    }
    private int clamp(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }
    private BigDecimal bd(String value) { return new BigDecimal(value); }
}
