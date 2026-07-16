package com.archiveos.ai.world;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Maps persisted runtime facts to viewer effects; it neither generates events nor controls a renderer. */
@Component
public class WorldEventMapper {
    public Optional<Map<String, Object>> map(Map<String, Object> source) {
        String eventId = value(source, "event_id", "eventId");
        String eventType = value(source, "event_type", "eventType");
        if (eventId.isBlank() || eventType.isBlank()) return Optional.empty();
        String from = canonical(value(source, "source_system_id", "source", "from_node"));
        String to = canonical(value(source, "target_system_id", "target", "to_node"));
        String district = district(eventType, from);
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", eventId);
        event.put("eventType", eventType);
        event.put("source", from);
        event.put("target", to);
        event.put("district", district);
        String routeFrom = district(from, from); String routeTo = district(eventType, to);
        event.put("highlightDistricts", new LinkedHashSet<>(List.of(routeFrom, routeTo)).stream().toList());
        event.put("route", Map.of("from", routeFrom, "to", routeTo));
        event.put("effects", List.of("highlight", "pulse", "route_animation"));
        copy(source, event, "occurred_at", "occurredAt");
        copy(source, event, "received_at", "receivedAt");
        copy(source, event, "correlation_id", "correlationId");
        copy(source, event, "entity_id", "entityId");
        copy(source, event, "status", "status");
        return Optional.of(event);
    }

    private void copy(Map<String, Object> source, Map<String, Object> target, String snake, String camel) {
        Object value = source.containsKey(camel) ? source.get(camel) : source.get(snake);
        if (value != null) target.put(camel, value);
    }
    private String value(Map<String, Object> map, String... keys) {
        for (String key : keys) if (map.get(key) != null && !String.valueOf(map.get(key)).isBlank()) return String.valueOf(map.get(key));
        return "";
    }
    private String canonical(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
    private String district(String eventType, String service) {
        String type = eventType == null ? "" : eventType.toUpperCase(Locale.ROOT);
        if (service.contains("archiveos") || type.contains("INGEST") || type.contains("CALLBACK") || type.contains("APPROVAL")) return "control-tower";
        if (service.contains("market") || type.contains("ORDER") || type.contains("PAYMENT") || type.contains("DEMAND")) return "market-district";
        if (service.contains("nexus") || type.contains("PRODUCTION") || type.contains("QUALITY") || type.contains("MATERIAL")) return "nexus-district";
        if (service.contains("logistics") || type.contains("SHIPMENT") || type.contains("ROUTE") || type.contains("DELIVERY")) return "logistics-district";
        if (service.contains("ledger") || type.contains("SETTLEMENT") || type.contains("RECONCILIATION") || type.contains("TRANSACTION") || type.contains("LEDGER")) return "ledger-district";
        return "control-tower";
    }
}
