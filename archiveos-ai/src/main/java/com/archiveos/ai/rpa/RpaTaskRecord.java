package com.archiveos.ai.rpa;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record RpaTaskRecord(
        UUID id,
        String title,
        String description,
        String targetProject,
        String requestedBy,
        String status,
        String category,
        String riskLevel,
        String recommendation,
        boolean approvalRequired,
        String summary,
        String classificationSource,
        String error,
        Map<String, Object> metadata,
        Instant createdAt,
        Instant updatedAt) {}
