package com.archiveos.ai.rpa;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record RpaDecisionRecord(
        UUID id,
        UUID taskId,
        String action,
        String reason,
        String decidedBy,
        String previousStatus,
        String nextStatus,
        Map<String, Object> metadata,
        Instant createdAt) {}
