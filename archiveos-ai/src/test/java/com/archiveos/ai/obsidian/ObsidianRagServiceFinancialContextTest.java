package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ObsidianRagServiceFinancialContextTest {

    private final ObsidianRagService service = new ObsidianRagService(
            null, null, null, null, null, null, null, null);

    @Test
    void includesBoundedFinancialEvidenceAndRedactsSecrets() {
        Map<String, Object> context = Map.of(
                "financeAsOf", "2026-08-28T06:00:00Z",
                "financeTotals", Map.of("revenue", 1000, "cost", 800, "profit", 200),
                "serviceFinance", List.of(Map.of(
                        "serviceId", "market",
                        "revenue", 500,
                        "cost", 450,
                        "profit", 50,
                        "operatingMargin", 10,
                        "password", "must-not-leak")),
                "unknownClientField", "ignored");

        String formatted = service.formatRuntimeContext(context);

        assertThat(formatted)
                .contains("financeAsOf: 2026-08-28T06:00:00Z")
                .contains("serviceFinance:")
                .contains("operatingMargin=10")
                .contains("password=[redacted]")
                .doesNotContain("must-not-leak")
                .doesNotContain("unknownClientField");
    }

    @Test
    void promptSeparatesTechnicalHealthFromFinancialEvidence() {
        String prompt = service.buildPrompt("왜 손실입니까?", List.of(), Map.of(
                "serviceFinance", List.of(Map.of("serviceId", "ledger", "profit", -100))));

        assertThat(prompt)
                .contains("Service health proves technical availability only")
                .contains("confirmed facts with period and source freshness")
                .contains("serviceFinance:");
    }
}
