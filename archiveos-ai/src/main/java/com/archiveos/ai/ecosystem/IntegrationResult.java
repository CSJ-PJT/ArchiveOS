package com.archiveos.ai.ecosystem;

import java.util.Map;

public record IntegrationResult(
        EcosystemServiceStatus status,
        Integer httpStatus,
        Map<String, Object> body,
        String errorMessage,
        long latencyMs) {
    public boolean ok() { return status == EcosystemServiceStatus.HEALTHY; }
}
