package com.archiveos.ai.timeline;

import com.archiveos.ai.liveflow.LiveFlowService;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** Correlation story is deterministic and works without any model call. */
@Service
public class CorrelationTimelineService {
    private static final Set<String> REQUIRED_EXTERNAL_SOURCES = Set.of(
            "archive-market", "archive-nexus", "archive-logistics", "archive-ledger");
    private static final Pattern PLAUSIBLE_EVENT_ID = Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{2,199}$");
    private final LiveFlowService flow;
    public CorrelationTimelineService(LiveFlowService flow){this.flow=flow;}
    public Map<String,Object> timeline(String correlationId){
        List<Map<String,Object>> events=extract(flow.correlation(correlationId));
        events.sort(Comparator.comparing((Map<String,Object> event) -> String.valueOf(event.get("occurred_at"))).thenComparing(event -> String.valueOf(event.get("id"))));
        List<Map<String,Object>> steps=new ArrayList<>(); List<Map<String,Object>> anomalies=new ArrayList<>(); Set<String> ids=new HashSet<>(); Set<String> observedSources=new HashSet<>(); Set<String> simulationRunIds=new HashSet<>(); Instant previous=null; int sequence=0;
        Set<String> eventIds = new HashSet<>();
        for (Map<String,Object> event : events) eventIds.add(text(event.get("event_id")));
        int unresolvedLineage = 0;
        for(Map<String,Object> event:events){
            String eventId=text(event.get("event_id")); if(!ids.add(eventId)) anomalies.add(Map.of("type","DUPLICATE_EVENT_ID","eventId",eventId));
            Instant occurredAt=parse(event.get("occurred_at")); Long latency=previous==null||occurredAt==null?null:Duration.between(previous,occurredAt).toMillis();
            if(latency!=null&&latency>300000) anomalies.add(Map.of("type","STEP_DELAY","eventId",eventId,"latencyMs",latency));
            if("failed".equalsIgnoreCase(text(event.get("status")))||"warning".equalsIgnoreCase(text(event.get("severity")))) anomalies.add(Map.of("type","FAILED_OR_WARNING","eventId",eventId));
            Map<String,Object> metadata=metadata(event.get("metadata"));
            String simulationRunId = text(metadata.get("simulationRunId"));
            if (!simulationRunId.isBlank()) simulationRunIds.add(simulationRunId);
            String source = text(event.get("source_system_id"));
            if (source.isBlank()) source = text(event.get("from_node"));
            observedSources.add(canonical(source));
            String causationId = text(metadata.get("causationId"));
            String causationStatus = causationStatus(eventId, causationId, eventIds, source);
            if ("EXTERNAL_PARENT_NOT_INGESTED".equals(causationStatus) || "LEGACY_UNKNOWN".equals(causationStatus)) unresolvedLineage++;
            if ("INVALID_CAUSATION".equals(causationStatus)) anomalies.add(Map.of("type","INVALID_CAUSATION","eventId",eventId,"causationId",causationId));
            Map<String,Object> step=new LinkedHashMap<>(); step.put("sequence",++sequence); step.put("occurredAt",event.get("occurred_at")); step.put("source",event.get("from_node")); step.put("target",event.get("to_node")); step.put("eventType",event.get("event_type")); step.put("normalizedStage",stage(text(event.get("event_type")))); step.put("entityId",event.get("entity_id")); step.put("orderId",metadata.get("orderId")); step.put("simulationRunId",simulationRunId.isBlank() ? null : simulationRunId); step.put("correlationId",event.get("correlation_id")); step.put("causationId",causationId); step.put("causationStatus",causationStatus); step.put("status",event.get("status")); step.put("eventId",eventId); step.put("latencyFromPrevious",latency); steps.add(step); previous=occurredAt==null?previous:occurredAt;
        }
        if(steps.isEmpty()) anomalies.add(Map.of("type","MISSING_TIMELINE","message","No persisted runtime events for this correlation."));
        Set<String> missingSources = new HashSet<>(REQUIRED_EXTERNAL_SOURCES);
        missingSources.removeAll(observedSources);
        Map<String,Object> lineage = new LinkedHashMap<>();
        lineage.put("observedServices", observedSources.stream().sorted().toList());
        lineage.put("missingServices", missingSources.stream().sorted().toList());
        lineage.put("unresolvedCausationCount", unresolvedLineage);
        lineage.put("simulationRunIds", simulationRunIds.stream().sorted().toList());
        lineage.put("simulationRunIdDistinctCount", simulationRunIds.size());
        lineage.put("chainStatus", chainStatus(steps, anomalies, unresolvedLineage, missingSources));
        return Map.of("correlationId",correlationId,"events",steps,"anomalies",anomalies,"lineage",lineage,"aiCalled",false);
    }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> extract(Object source){
        Object value=source; for(int depth=0;depth<3&&value instanceof Map<?,?> map;depth++) value=((Map<String,Object>)map).get("data");
        if(!(value instanceof List<?> list)) return new ArrayList<>(); List<Map<String,Object>> result=new ArrayList<>(); for(Object item:list) if(item instanceof Map<?,?> map) result.add(new LinkedHashMap<>((Map<String,Object>)map)); return result;
    }
    private String stage(String type){String value=type.toUpperCase();if(value.contains("ORDER"))return "Order received";if(value.contains("PAYMENT"))return "Payment";if(value.contains("PRODUCTION"))return "Production";if(value.contains("SHIPMENT")||value.contains("ROUTE"))return "Shipment";if(value.contains("APPROVAL"))return "Approval";if(value.contains("SETTLEMENT"))return "Settlement";if(value.contains("RECONCILIATION"))return "Reconciliation";if(value.contains("LEDGER")||value.contains("TRANSACTION"))return "Ledger entry";return "Runtime event";}
    private String causationStatus(String eventId, String causationId, Set<String> eventIds, String source) {
        if (causationId.isBlank()) return "ROOT_EVENT";
        if (causationId.equals(eventId) || !PLAUSIBLE_EVENT_ID.matcher(causationId).matches()) return "INVALID_CAUSATION";
        if (eventIds.contains(causationId)) return "LOCAL_PARENT_FOUND";
        return REQUIRED_EXTERNAL_SOURCES.contains(canonical(source)) ? "EXTERNAL_PARENT_NOT_INGESTED" : "LEGACY_UNKNOWN";
    }
    private String chainStatus(List<Map<String,Object>> steps, List<Map<String,Object>> anomalies, int unresolvedLineage, Set<String> missingSources) {
        if (steps.isEmpty()) return "PARTIAL_CHAIN";
        if (anomalies.stream().anyMatch(anomaly -> "DUPLICATE_EVENT_ID".equals(anomaly.get("type")) || "INVALID_CAUSATION".equals(anomaly.get("type")))) return "ANOMALOUS";
        if (unresolvedLineage > 0) return "INCOMPLETE_LINEAGE";
        return missingSources.isEmpty() ? "COMPLETE_CHAIN" : "PARTIAL_CHAIN";
    }
    private String canonical(String value) { return value == null ? "" : value.trim().toLowerCase(); }
    private Instant parse(Object value){try{return value==null?null:Instant.parse(String.valueOf(value));}catch(Exception ignored){return null;}}
    private String text(Object value){return value==null?"":String.valueOf(value);}
    @SuppressWarnings("unchecked") private Map<String,Object> metadata(Object value){return value instanceof Map<?,?> map ? (Map<String,Object>) map : Map.of();}
}
