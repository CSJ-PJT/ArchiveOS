package com.archiveos.ai.liveflow;

import java.time.Instant;
import java.util.Map;

public record LiveFlowEvent(
        String eventId,
        String correlationId,
        String sourceSystemId,
        String sourceServiceId,
        String domain,
        String eventType,
        String entityType,
        String entityId,
        String fromNode,
        String toNode,
        String status,
        String severity,
        String displayLabel,
        String amountBucket,
        Instant occurredAt,
        Map<String, Object> metadata) {
}
