package com.archiveos.ai.contract;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record WorkflowContract(UUID id, String correlationId, String projectId, Workflow workflow,
        Execution execution, Approval approval, List<Evidence> evidence, Result result, Instant createdAt, Instant updatedAt) {
    public record Workflow(String type, String name, String version, String status) {}
    public record Execution(String id, String status, Instant startedAt, Instant completedAt) {}
    public record Approval(String status, String decidedBy, String reason, Instant decidedAt) {}
    public record Evidence(String type, String uri, String checksum, JsonNode metadata) {}
    public record Result(String status, String summary, JsonNode output) {}
}
