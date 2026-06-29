package com.archiveos.ai.workflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

public record CreateWorkflowTaskRequest(
        String title,
        String description,
        String priority,
        @JsonProperty("target_project") String targetProject,
        @JsonProperty("scope_files") List<String> scopeFiles,
        @JsonProperty("max_iterations") Double maxIterations,
        @JsonProperty("cost_budget") BigDecimal costBudget) {}
