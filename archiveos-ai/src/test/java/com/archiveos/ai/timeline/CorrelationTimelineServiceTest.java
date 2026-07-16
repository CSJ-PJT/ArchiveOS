package com.archiveos.ai.timeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.archiveos.ai.liveflow.LiveFlowService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class CorrelationTimelineServiceTest {
    @Test
    void marksExternalParentAsNotIngestedWithoutInventingIt() {
        LiveFlowService flow = Mockito.mock(LiveFlowService.class);
        when(flow.correlation("corr-1")).thenReturn(Map.of("data", List.of(event(
                "EVT-1", "RTE-ASM-parent", "archive-market", "2026-07-13T00:00:00Z"))));

        Map<String, Object> result = new CorrelationTimelineService(flow).timeline("corr-1");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> events = (List<Map<String, Object>>) result.get("events");
        @SuppressWarnings("unchecked")
        Map<String, Object> lineage = (Map<String, Object>) result.get("lineage");
        assertThat(events.get(0)).containsEntry("causationStatus", "EXTERNAL_PARENT_NOT_INGESTED");
        assertThat(lineage).containsEntry("chainStatus", "INCOMPLETE_LINEAGE")
                .containsEntry("unresolvedCausationCount", 1);
    }

    @Test
    void marksObservedLocalParentAndPartialCoverageSeparately() {
        LiveFlowService flow = Mockito.mock(LiveFlowService.class);
        when(flow.correlation("corr-2")).thenReturn(Map.of("data", List.of(
                event("EVT-parent", "", "archive-market", "2026-07-13T00:00:00Z"),
                event("EVT-child", "EVT-parent", "archive-market", "2026-07-13T00:00:01Z"))));

        Map<String, Object> result = new CorrelationTimelineService(flow).timeline("corr-2");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> events = (List<Map<String, Object>>) result.get("events");
        @SuppressWarnings("unchecked")
        Map<String, Object> lineage = (Map<String, Object>) result.get("lineage");
        assertThat(events).extracting(event -> event.get("causationStatus"))
                .containsExactly("ROOT_EVENT", "LOCAL_PARENT_FOUND");
        assertThat(lineage).containsEntry("chainStatus", "PARTIAL_CHAIN")
                .containsEntry("unresolvedCausationCount", 0);
    }

    @Test
    void treatsMissingCausationMetadataAsRootEvent() {
        LiveFlowService flow = Mockito.mock(LiveFlowService.class);
        Map<String, Object> root = new LinkedHashMap<>(event("EVT-root", "ignored", "archive-ledger", "2026-07-13T00:00:00Z"));
        root.put("metadata", Map.of("orderId", "ORD-1"));
        when(flow.correlation("corr-root")).thenReturn(Map.of("data", List.of(root)));

        Map<String, Object> result = new CorrelationTimelineService(flow).timeline("corr-root");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> events = (List<Map<String, Object>>) result.get("events");
        assertThat(events.get(0)).containsEntry("causationStatus", "ROOT_EVENT");
    }

    @Test
    void projectsSimulationRunIdAndCountsOnlyPersistedValues() {
        LiveFlowService flow = Mockito.mock(LiveFlowService.class);
        Map<String, Object> withRun = new LinkedHashMap<>(event("EVT-run", "", "archive-market", "2026-07-13T00:00:00Z"));
        withRun.put("metadata", Map.of("simulationRunId", "SIM-1"));
        Map<String, Object> legacy = new LinkedHashMap<>(event("EVT-legacy", "EVT-run", "archive-nexus", "2026-07-13T00:00:01Z"));
        legacy.put("metadata", Map.of("causationId", "EVT-run"));
        when(flow.correlation("corr-run")).thenReturn(Map.of("data", List.of(withRun, legacy)));

        Map<String, Object> result = new CorrelationTimelineService(flow).timeline("corr-run");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> events = (List<Map<String, Object>>) result.get("events");
        @SuppressWarnings("unchecked")
        Map<String, Object> lineage = (Map<String, Object>) result.get("lineage");
        assertThat(events).extracting(event -> event.get("simulationRunId")).containsExactly("SIM-1", null);
        assertThat(lineage).containsEntry("simulationRunIdDistinctCount", 1)
                .containsEntry("simulationRunIds", List.of("SIM-1"));
    }

    private static Map<String, Object> event(String eventId, String causationId, String source, String occurredAt) {
        return Map.ofEntries(
                Map.entry("id", eventId),
                Map.entry("event_id", eventId),
                Map.entry("correlation_id", "corr"),
                Map.entry("source_system_id", source),
                Map.entry("from_node", source),
                Map.entry("to_node", "archive-os"),
                Map.entry("event_type", "ORDER_PLACED"),
                Map.entry("entity_id", "ORD-1"),
                Map.entry("occurred_at", occurredAt),
                Map.entry("status", "created"),
                Map.entry("severity", "info"),
                Map.entry("metadata", Map.of("orderId", "ORD-1", "causationId", causationId)));
    }
}
