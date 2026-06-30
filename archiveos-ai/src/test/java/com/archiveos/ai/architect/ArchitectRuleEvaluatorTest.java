package com.archiveos.ai.architect;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ArchitectRuleEvaluatorTest {
    private final ArchitectRuleEvaluator evaluator = new ArchitectRuleEvaluator();

    @Test void preservesBlockedExecutionRuleContract() {
        var result = evaluator.evaluate("Codex control", "Enable arbitrary shell execution", Map.of());
        assertThat(result.findings()).anyMatch(item -> "execution_risk".equals(item.get("rule")) && "blocked".equals(item.get("severity")));
    }

    @Test void passesSafeMetadataOnlyReview() {
        var result = evaluator.evaluate("Metadata cleanup", "Normalize labels and descriptions", Map.of());
        assertThat(result.findings()).isEmpty();
    }
}
