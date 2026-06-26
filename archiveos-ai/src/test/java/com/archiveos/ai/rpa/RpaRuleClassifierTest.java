package com.archiveos.ai.rpa;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RpaRuleClassifierTest {
    @Test
    void marksExecutionControlAsHighRiskAndApprovalRequired() {
        RpaTaskRecord task = task("Deploy and git push", "Run shell deployment, push to main, and restart MCP execution.");

        RpaClassification classification = RpaRuleClassifier.classify(task, "test", null);

        assertThat(classification.category()).isEqualTo("execution_control");
        assertThat(classification.riskLevel()).isEqualTo("high");
        assertThat(classification.recommendation()).isEqualTo("PM_APPROVAL_REQUIRED");
        assertThat(classification.approvalRequired()).isTrue();
    }

    @Test
    void marksDatabaseBatchWorkAsMediumRisk() {
        RpaTaskRecord task = task("Nightly batch migration", "Add PostgreSQL schema and pgvector batch processing.");

        RpaClassification classification = RpaRuleClassifier.classify(task, "test", null);

        assertThat(classification.category()).isEqualTo("data_operation");
        assertThat(classification.riskLevel()).isEqualTo("medium");
        assertThat(classification.approvalRequired()).isTrue();
    }

    private RpaTaskRecord task(String title, String description) {
        Instant now = Instant.now();
        return new RpaTaskRecord(
                UUID.randomUUID(),
                title,
                description,
                "ArchiveOS",
                "test",
                "queued",
                null,
                null,
                null,
                true,
                null,
                null,
                null,
                Map.of(),
                now,
                now);
    }
}
