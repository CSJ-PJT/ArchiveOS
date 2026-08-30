package com.archiveos.ai.openaiusage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenAiUsageServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-31T03:00:00Z"), ZoneOffset.UTC);

    @Test
    void aggregatesMonthlyCostsUsageAndRemainingBudgetWithoutExposingTheKey() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OpenAiUsageProperties properties = new OpenAiUsageProperties("sk-admin-secret", new BigDecimal("100"),
                "org-test", "", Duration.ofMinutes(5), "https://api.openai.com");
        OpenAiUsageService service = new OpenAiUsageService(properties, builder, CLOCK);

        server.expect(requestTo(containsString("/v1/organization/costs?")))
                .andExpect(header("Authorization", "Bearer sk-admin-secret"))
                .andExpect(header("OpenAI-Organization", "org-test"))
                .andRespond(withSuccess("""
                        {"data":[{"results":[{"amount":{"value":12.5,"currency":"usd"}}]}]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(containsString("/v1/organization/usage/completions?")))
                .andRespond(withSuccess("""
                        {"data":[{"results":[{"num_model_requests":7,"input_tokens":1200,"output_tokens":300,"input_cached_tokens":800}]}]}
                        """, MediaType.APPLICATION_JSON));

        OpenAiUsageService.UsageSummary summary = service.summary();

        assertThat(summary.status()).isEqualTo("AVAILABLE");
        assertThat(summary.currentCost().value()).isEqualByComparingTo("12.5");
        assertThat(summary.remainingBudget().value()).isEqualByComparingTo("87.5");
        assertThat(summary.usedPercent()).isEqualByComparingTo("12.50");
        assertThat(summary.usage().requests()).isEqualTo(7);
        assertThat(summary.usage().inputTokens()).isEqualTo(1200);
        assertThat(summary.toString()).doesNotContain("sk-admin-secret");
        server.verify();
    }

    @Test
    void reportsNotConfiguredWithoutCallingOpenAi() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OpenAiUsageService service = new OpenAiUsageService(
                new OpenAiUsageProperties("", BigDecimal.ZERO, "", "", Duration.ofMinutes(5), ""), builder, CLOCK);

        OpenAiUsageService.UsageSummary summary = service.summary();

        assertThat(summary.status()).isEqualTo("NOT_CONFIGURED");
        assertThat(summary.configured()).isFalse();
        assertThat(summary.message()).contains("Admin API");
        server.verify();
    }
}
