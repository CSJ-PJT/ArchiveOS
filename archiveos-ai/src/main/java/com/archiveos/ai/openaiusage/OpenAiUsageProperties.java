package com.archiveos.ai.openaiusage;

import java.math.BigDecimal;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos.openai-usage")
public record OpenAiUsageProperties(
        String adminApiKey,
        BigDecimal monthlyBudgetUsd,
        String organizationId,
        String projectId,
        Duration cacheTtl,
        String baseUrl
) {
    public OpenAiUsageProperties {
        adminApiKey = normalize(adminApiKey);
        monthlyBudgetUsd = monthlyBudgetUsd == null ? BigDecimal.ZERO : monthlyBudgetUsd.max(BigDecimal.ZERO);
        organizationId = normalize(organizationId);
        projectId = normalize(projectId);
        cacheTtl = cacheTtl == null || cacheTtl.isNegative() || cacheTtl.isZero() ? Duration.ofMinutes(5) : cacheTtl;
        baseUrl = normalize(baseUrl);
        if (baseUrl.isBlank()) baseUrl = "https://api.openai.com";
    }

    public boolean configured() {
        return !adminApiKey.isBlank();
    }

    public boolean budgetConfigured() {
        return monthlyBudgetUsd.signum() > 0;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
