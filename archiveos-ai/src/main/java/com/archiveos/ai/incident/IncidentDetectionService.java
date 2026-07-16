package com.archiveos.ai.incident;

import com.archiveos.ai.decision.DecisionEngineService;
import com.archiveos.ai.liveflow.LiveFlowService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Deterministic incident detection; model analysis is an explicit, separate action. */
@Service
public class IncidentDetectionService {
    private final LiveFlowService flow; private final IncidentRepository repository; private final DecisionEngineService decisions;
    public IncidentDetectionService(LiveFlowService flow, IncidentRepository repository, DecisionEngineService decisions) { this.flow=flow; this.repository=repository; this.decisions=decisions; }
    public List<Map<String,Object>> detect() {
        Map<String,Object> summary=flow.summary(); List<Map<String,Object>> signals=new ArrayList<>();
        long approvals=num(summary.get("approvalBacklog")), backlog=num(summary.get("processingBacklog")), failed=num(summary.get("failed_callbacks"));
        if(failed>0) signals.add(signal("CALLBACK_FAILURE","critical","Ledger callback failure requires human review.",failed));
        if(approvals>20) signals.add(signal("APPROVAL_BACKLOG","high","Approval backlog exceeded the configured warning threshold.",approvals));
        if(backlog>20) signals.add(signal("PROCESSING_BACKLOG","high","Processing backlog exceeded the configured warning threshold.",backlog));
        Map<?,?> runtime=summary.get("runtime") instanceof Map<?,?> value ? value : Map.of();
        if("DEGRADED".equals(String.valueOf(runtime.get("pipelineStatus")))) signals.add(signal("PIPELINE_DEGRADED","high",String.valueOf(runtime.get("reason")),0));
        return signals.stream().map(this::persist).toList();
    }
    public Map<String,Object> analyze(String id, String actor) {
        Map<String,Object> incident=repository.find(id); if(incident==null) return null;
        Map<String,Object> decision=decisions.analyze(new DecisionEngineService.DecisionRequest(null,"INCIDENT","ArchiveOS",null,null,
            "Analyze this incident using runtime evidence and retrieved knowledge: "+incident.get("title")+". State impact, uncertainty, investigation order, risks, and human-controlled next steps.", Map.of(), actor, Instant.now().toString()), actor);
        Map<String,Object> analysis=new LinkedHashMap<>();
        analysis.put("recommendationId", decision.get("recommendation_id")); analysis.put("status", decision.get("status")); analysis.put("summary", decision.get("summary")); analysis.put("observedFacts", decision.get("observed_facts"));
        return repository.updateAnalysis(id, analysis, decision.get("references_json"), decision.get("recommended_actions"));
    }
    public List<Map<String,Object>> list(){ return repository.list(); }
    public Map<String,Object> state(String id,String state){ return repository.state(id,state); }
    private Map<String,Object> persist(Map<String,Object> signal) {
        String fingerprint=signal.get("signalType")+"|archiveos|"+Instant.now().toString().substring(0,13);
        Map<String,Object> existing=repository.byFingerprint(fingerprint); if(existing!=null) return existing;
        return repository.save(Map.of("id","incident-"+UUID.randomUUID(),"fingerprint",fingerprint,"severity",signal.get("severity"),"title",signal.get("summary"),"services",List.of("archiveos"),"signals",List.of(signal)));
    }
    private Map<String,Object> signal(String type,String severity,String summary,long value){return Map.of("signalType",type,"severity",severity,"summary",summary,"value",value,"detectedAt",Instant.now().toString(),"source","/api/live-flow/summary","automaticExecution",false);}
    private long num(Object value){try{return value==null?0:Long.parseLong(String.valueOf(value));}catch(Exception ignored){return 0;}}
}
