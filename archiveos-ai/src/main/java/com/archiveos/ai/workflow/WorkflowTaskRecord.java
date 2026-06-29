package com.archiveos.ai.workflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record WorkflowTaskRecord(
        UUID id,
        String title,
        String description,
        String priority,
        String status,
        @JsonProperty("target_project") String targetProject,
        @JsonProperty("scope_files") List<String> scopeFiles,
        @JsonProperty("max_iterations") int maxIterations,
        @JsonProperty("current_iteration") int currentIteration,
        @JsonProperty("cost_budget") BigDecimal costBudget,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("updated_at") Instant updatedAt,
        @JsonProperty("completed_at") Instant completedAt,
        @JsonProperty("latest_architect_review_id") UUID latestArchitectReviewId,
        @JsonProperty("latest_builder_result_id") UUID latestBuilderResultId,
        @JsonProperty("latest_reviewer_result_id") UUID latestReviewerResultId,
        @JsonProperty("latest_pm_decision_id") UUID latestPmDecisionId,
        Map<String, Object> metadata) {}
