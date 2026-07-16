package com.archiveos.ai.liveflow;

import com.archiveos.ai.audit.AuditLogService;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Narrow service-to-service boundary for synthetic runtime events only. */
@Service
public class InternalRuntimeIngestService {
    private static final Set<String> SOURCES = Set.of("archive-market", "archive-nexus", "archive-logistics", "archive-ledger");
    private final LiveFlowRepository repository;
    private final AuditLogService audit;
    public InternalRuntimeIngestService(LiveFlowRepository repository, AuditLogService audit) { this.repository=repository; this.audit=audit; }

    public Map<String,Object> ingest(Map<String,Object> raw, String authenticatedSource) {
        Map<String,Object> payload = envelope(raw);
        String source = required(payload, "sourceSystem").toLowerCase();
        if (!SOURCES.contains(source) || !source.equals(authenticatedSource)) throw new SecurityException("sourceSystem is not allowed for this service credential.");
        String eventId=required(payload,"eventId"), correlationId=required(payload,"correlationId"), causationId=optionalText(payload,"causationId"), orderId=optionalText(payload,"orderId"), simulationRunId=optionalText(payload,"simulationRunId"), entityId=required(payload,"entityId"), eventType=required(payload,"eventType"), target=required(payload,"targetSystem");
        if (eventId.length()>200 || correlationId.length()>200 || (orderId != null && orderId.length()>200) || (causationId != null && causationId.length()>200) || (simulationRunId != null && simulationRunId.length()>200) || entityId.length()>200 || eventType.length()>160) throw new IllegalArgumentException("Runtime event fields exceed allowed size.");
        boolean duplicate=repository.existsEventId(eventId);
        Map<String,Object> metadata=new LinkedHashMap<>();
        if (orderId != null) metadata.put("orderId",orderId);
        if (causationId != null) metadata.put("causationId",causationId);
        if (simulationRunId != null) metadata.put("simulationRunId",simulationRunId);
        metadata.put("syntheticData",true); metadata.put("internalServiceIngest",true);
        LiveFlowEvent event=new LiveFlowEvent(eventId,correlationId,source,source,domain(source),eventType,text(payload.get("entityType"),"runtime"),entityId,source,target,text(payload.get("status"),"created"),text(payload.get("severity"),"info"),text(payload.get("displayLabel"),eventType),text(payload.get("amountBucket"),null),instant(payload.get("occurredAt")),metadata);
        Map<String,Object> saved=repository.upsert(event);
        audit.recordEvent("internal_runtime_ingest", source, correlationId, eventId, Map.of(
                "duplicate",duplicate,"eventType",eventType,"orderIdPresent",orderId != null,
                "causationIdPresent",causationId != null,"simulationRunIdPresent",simulationRunId != null,
                "rootEvent",causationId == null));
        return Map.of("event",saved,"duplicate",duplicate,"accepted",true);
    }
    @SuppressWarnings("unchecked") private Map<String,Object> envelope(Map<String,Object> raw){Object data=raw.get("data");if(data instanceof Map<?,?> map)return (Map<String,Object>)map;Object event=raw.get("event");if(event instanceof Map<?,?> map)return (Map<String,Object>)map;return raw;}
    private String required(Map<String,Object> value,String key){String text=text(value.get(key),null);if(text==null||text.isBlank())throw new IllegalArgumentException(key+" is required.");return text;}
    private String optionalText(Map<String,Object> value,String key){return text(value.get(key),null);}
    private String text(Object value,String fallback){return value==null||String.valueOf(value).isBlank()?fallback:String.valueOf(value).trim();}
    private String domain(String source){return source.replace("archive-","");}
    private Instant instant(Object value){try{return value==null?Instant.now():Instant.parse(String.valueOf(value));}catch(Exception error){throw new IllegalArgumentException("occurredAt must be an ISO-8601 instant.");}}
}
