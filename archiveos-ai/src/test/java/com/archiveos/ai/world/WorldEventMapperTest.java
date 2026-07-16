package com.archiveos.ai.world;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WorldEventMapperTest {
    private final WorldEventMapper mapper = new WorldEventMapper();

    @Test void mapsActualOrderEventToMarketViewerEffects() {
        Map<String, Object> result = mapper.map(Map.of(
                "event_id", "evt-order-1", "event_type", "ORDER_CREATED", "source_system_id", "archive-market",
                "to_node", "nexus", "correlation_id", "corr-1", "entity_id", "ord-1", "occurred_at", "2026-07-14T00:00:00Z")).orElseThrow();
        assertThat(result).containsEntry("district", "market-district").containsEntry("eventId", "evt-order-1");
        @SuppressWarnings("unchecked") List<String> effects = (List<String>) result.get("effects");
        assertThat(effects).containsExactly("highlight", "pulse", "route_animation");
    }

    @Test void mapsArchiveOsIngestToControlTowerWithoutInventingEventData() {
        Map<String, Object> result = mapper.map(Map.of(
                "eventId", "evt-ingest-1", "eventType", "RUNTIME_INGESTED", "source", "archiveos",
                "target", "archiveos", "correlationId", "corr-2", "entityId", "evt-ingest-1")).orElseThrow();
        assertThat(result).containsEntry("district", "control-tower").containsEntry("correlationId", "corr-2");
        assertThat(result).doesNotContainKey("assetUrl");
    }

    @Test void rejectsIncompleteRuntimeFacts() {
        assertThat(mapper.map(Map.of("event_id", "evt-only"))).isEmpty();
    }
}
