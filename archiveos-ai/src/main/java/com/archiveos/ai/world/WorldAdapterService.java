package com.archiveos.ai.world;

import com.archiveos.ai.liveflow.LiveFlowService;
import com.archiveos.ai.timeline.CorrelationTimelineService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Read-only Digital Twin Adapter: ArchiveOS exposes facts and viewer hints, not Three.js rendering. */
@Service
public class WorldAdapterService {
    private final WorldProperties properties;
    private final MockWorldAssetAdapter mock;
    private final LiveWorldAssetAdapter live;
    private final LiveFlowService flow;
    private final CorrelationTimelineService timeline;
    private final WorldEventMapper mapper;
    public WorldAdapterService(WorldProperties properties, MockWorldAssetAdapter mock, LiveWorldAssetAdapter live,
                               LiveFlowService flow, CorrelationTimelineService timeline, WorldEventMapper mapper) {
        this.properties = properties; this.mock = mock; this.live = live; this.flow = flow; this.timeline = timeline; this.mapper = mapper;
    }

    public Map<String, Object> assets() { return adapter().assets(); }

    public Map<String, Object> layout() {
        return Map.of("mode", adapter().mode(), "version", "archiveos.world-layout/v1",
                "districts", List.of(
                        district("market-district", "Market District", "archive-market"),
                        district("nexus-district", "Nexus District", "archive-nexus"),
                        district("logistics-district", "Logistics District", "archive-logistics"),
                        district("ledger-district", "Ledger District", "archive-ledger"),
                        district("control-tower", "ArchiveOS Control Tower", "archiveos")),
                "routes", List.of(route("market-district", "nexus-district", "ORDER_CREATED"),
                        route("nexus-district", "logistics-district", "PRODUCTION"),
                        route("logistics-district", "ledger-district", "SHIPMENT"),
                        route("ledger-district", "control-tower", "ARCHIVEOS_INGEST")),
                "viewerContract", Map.of("effects", List.of("highlight", "pulse", "route_animation"), "renderer", "external"));
    }

    public Map<String, Object> events(int requestedLimit, String correlationId) {
        int limit = Math.min(Math.max(requestedLimit, 1), properties.getEventLimit());
        if (!properties.live()) return Map.of("mode", adapter().mode(), "source", "development-mock", "events", List.of());
        List<Map<String, Object>> facts = correlationId == null || correlationId.isBlank()
                ? extract(flow.recent(limit)) : timelineEvents(correlationId);
        List<Map<String, Object>> events = new ArrayList<>();
        for (Map<String, Object> fact : facts) mapper.map(fact).ifPresent(events::add);
        return Map.of("mode", adapter().mode(), "source", correlationId == null || correlationId.isBlank() ? "live-flow" : "correlation-timeline",
                "correlationId", correlationId == null ? "" : correlationId, "events", events);
    }

    public Map<String, Object> state() {
        Map<String, Object> assets = assets();
        Map<String, Object> runtime = properties.live() ? map(flow.streamSnapshot().get("runtime")) : Map.of("pipelineStatus", "MOCK");
        return Map.of("mode", adapter().mode(), "readOnly", true, "renderer", "external",
                "manifestStatus", assets.getOrDefault("manifestStatus", "UNKNOWN"), "assetCount", list(assets.get("assets")).size(),
                "runtime", runtime, "updatedAt", Instant.now().toString());
    }

    private WorldAssetAdapter adapter() { return properties.live() ? live : mock; }
    private Map<String, Object> district(String id, String label, String service) { return Map.of("id", id, "label", label, "service", service); }
    private Map<String, Object> route(String from, String to, String trigger) { return Map.of("from", from, "to", to, "trigger", trigger); }
    @SuppressWarnings("unchecked") private List<Map<String, Object>> extract(Object value) {
        if (!(value instanceof Map<?, ?> map)) return List.of(); Object data = ((Map<String, Object>) map).get("data");
        if (!(data instanceof List<?> list)) return List.of(); List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?, ?> itemMap) result.add(new LinkedHashMap<>((Map<String, Object>) itemMap)); return result;
    }
    @SuppressWarnings("unchecked") private List<Map<String, Object>> timelineEvents(String correlationId) {
        Object events = timeline.timeline(correlationId).get("events");
        if (!(events instanceof List<?> list)) return List.of(); List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?, ?> itemMap) result.add(new LinkedHashMap<>((Map<String, Object>) itemMap)); return result;
    }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private List<?> list(Object value) { return value instanceof List<?> list ? list : List.of(); }
}
