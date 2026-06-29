package com.archiveos.ai.workflow;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.UUID;

public record WorkflowDecisionRecord(
        UUID id,
        @JsonProperty("task_id") UUID taskId,
        String action,
        String reason,
        @JsonProperty("created_at") Instant createdAt) {}
