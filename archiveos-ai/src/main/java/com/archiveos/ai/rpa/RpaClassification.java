package com.archiveos.ai.rpa;

import java.util.Map;

public record RpaClassification(
        String category,
        String riskLevel,
        String recommendation,
        boolean approvalRequired,
        String summary,
        String source,
        String error,
        Map<String, Object> metadata) {}
