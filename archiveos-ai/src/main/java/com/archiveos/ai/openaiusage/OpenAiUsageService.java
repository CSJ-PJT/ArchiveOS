package com.archiveos.ai.openaiusage;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.http.HttpHeaders;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
public class OpenAiUsageService {
    private final OpenAiUsageProperties properties;
    private final RestClient client;
    private final Clock clock;
    private volatile CacheEntry cache;

    @Autowired
    public OpenAiUsageService(OpenAiUsageProperties properties, RestClient.Builder builder) {
        this(properties, builder, Clock.systemUTC());
    }

    OpenAiUsageService(OpenAiUsageProperties properties, RestClient.Builder builder, Clock clock) {
        this.properties = properties;
        this.client = builder.baseUrl(properties.baseUrl()).build();
        this.clock = clock;
    }

    public UsageSummary summary() {
        if (!properties.configured()) return notConfigured();
        CacheEntry current = cache;
        Instant now = clock.instant();
        if (current != null && now.isBefore(current.expiresAt())) return current.value();
        synchronized (this) {
            current = cache;
            now = clock.instant();
            if (current != null && now.isBefore(current.expiresAt())) return current.value();
            UsageSummary refreshed = load(now);
            if ("AVAILABLE".equals(refreshed.status())) {
                cache = new CacheEntry(refreshed, now.plus(properties.cacheTtl()));
            }
            return refreshed;
        }
    }

    private UsageSummary load(Instant now) {
        LocalDate startDate = LocalDate.ofInstant(now, ZoneOffset.UTC).withDayOfMonth(1);
        LocalDate endDate = startDate.plusMonths(1);
        long start = startDate.atStartOfDay().toEpochSecond(ZoneOffset.UTC);
        long end = Math.min(now.getEpochSecond() + 1, endDate.atStartOfDay().toEpochSecond(ZoneOffset.UTC));
        try {
            JsonNode costs = get("/v1/organization/costs", start, end);
            JsonNode usage = get("/v1/organization/usage/completions", start, end);
            BigDecimal cost = sumCost(costs).setScale(6, RoundingMode.HALF_UP).stripTrailingZeros();
            String currency = currency(costs);
            UsageTotals totals = sumUsage(usage);
            Money budget = properties.budgetConfigured() ? money(properties.monthlyBudgetUsd(), "usd") : null;
            Money remaining = properties.budgetConfigured()
                    ? money(properties.monthlyBudgetUsd().subtract(cost).max(BigDecimal.ZERO), "usd") : null;
            BigDecimal usedPercent = properties.budgetConfigured()
                    ? cost.multiply(BigDecimal.valueOf(100)).divide(properties.monthlyBudgetUsd(), 2, RoundingMode.HALF_UP)
                    : null;
            return new UsageSummary("AVAILABLE", true, properties.budgetConfigured(), startDate, endDate,
                    money(cost, currency), budget, remaining, usedPercent, totals, now,
                    properties.budgetConfigured() ? "OpenAI 조직 사용량을 조회했습니다." : "월 예산을 설정하면 남은 예산도 계산합니다.");
        } catch (RestClientResponseException error) {
            String message = switch (error.getStatusCode().value()) {
                case 401, 403 -> "OpenAI 조직 Admin API 키 권한이 필요합니다.";
                case 429 -> "OpenAI 사용량 API 요청 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.";
                default -> "OpenAI 사용량 API를 일시적으로 조회할 수 없습니다.";
            };
            return unavailable(startDate, endDate, now, message);
        } catch (RuntimeException error) {
            return unavailable(startDate, endDate, now, "OpenAI 사용량 API를 일시적으로 조회할 수 없습니다.");
        }
    }

    private JsonNode get(String path, long start, long end) {
        return client.get()
                .uri(builder -> {
                    builder.path(path).queryParam("start_time", start).queryParam("end_time", end).queryParam("limit", 31);
                    if (!properties.projectId().isBlank()) builder.queryParam("project_ids", properties.projectId());
                    return builder.build();
                })
                .headers(headers -> {
                    headers.setBearerAuth(properties.adminApiKey());
                    headers.set(HttpHeaders.ACCEPT, "application/json");
                    if (!properties.organizationId().isBlank()) headers.set("OpenAI-Organization", properties.organizationId());
                })
                .retrieve()
                .body(JsonNode.class);
    }

    private UsageSummary notConfigured() {
        Instant now = clock.instant();
        LocalDate start = LocalDate.ofInstant(now, ZoneOffset.UTC).withDayOfMonth(1);
        return new UsageSummary("NOT_CONFIGURED", false, properties.budgetConfigured(), start, start.plusMonths(1),
                null, properties.budgetConfigured() ? money(properties.monthlyBudgetUsd(), "usd") : null, null, null,
                UsageTotals.empty(), now, "OpenAI 조직 Admin API 키를 서버에 등록하면 사용량을 표시합니다.");
    }

    private UsageSummary unavailable(LocalDate start, LocalDate end, Instant now, String message) {
        return new UsageSummary("UNAVAILABLE", true, properties.budgetConfigured(), start, end, null,
                properties.budgetConfigured() ? money(properties.monthlyBudgetUsd(), "usd") : null, null, null,
                UsageTotals.empty(), now, message);
    }

    private static BigDecimal sumCost(JsonNode root) {
        BigDecimal total = BigDecimal.ZERO;
        for (JsonNode bucket : root.path("data")) {
            for (JsonNode result : bucket.path("results")) {
                total = total.add(result.path("amount").path("value").decimalValue());
            }
        }
        return total;
    }

    private static String currency(JsonNode root) {
        for (JsonNode bucket : root.path("data")) {
            for (JsonNode result : bucket.path("results")) {
                String value = result.path("amount").path("currency").asText("");
                if (!value.isBlank()) return value;
            }
        }
        return "usd";
    }

    private static UsageTotals sumUsage(JsonNode root) {
        long requests = 0;
        long input = 0;
        long output = 0;
        long cached = 0;
        for (JsonNode bucket : root.path("data")) {
            for (JsonNode result : bucket.path("results")) {
                requests += result.path("num_model_requests").asLong(0);
                input += result.path("input_tokens").asLong(0);
                output += result.path("output_tokens").asLong(0);
                cached += result.path("input_cached_tokens").asLong(0);
            }
        }
        return new UsageTotals(requests, input, output, cached);
    }

    private static Money money(BigDecimal value, String currency) {
        return new Money(value.max(BigDecimal.ZERO).stripTrailingZeros(), currency == null || currency.isBlank() ? "usd" : currency);
    }

    public record UsageSummary(String status, boolean configured, boolean budgetConfigured,
                               LocalDate periodStart, LocalDate periodEnd, Money currentCost,
                               Money monthlyBudget, Money remainingBudget, BigDecimal usedPercent,
                               UsageTotals usage, Instant updatedAt, String message) {}

    public record Money(BigDecimal value, String currency) {}

    public record UsageTotals(long requests, long inputTokens, long outputTokens, long cachedInputTokens) {
        static UsageTotals empty() { return new UsageTotals(0, 0, 0, 0); }
    }

    private record CacheEntry(UsageSummary value, Instant expiresAt) {}
}
