package com.archiveos.ai.operations;

import com.archiveos.ai.decision.DecisionRepository;
import com.archiveos.ai.incident.IncidentRepository;
import com.archiveos.ai.managed.ManagedSystemsService;
import com.archiveos.ai.memory.MemoryRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Read-only attention queue. The score is deterministic; AI may only explain it in a later explicit request. */
@Service
public class PmAttentionService {
    private final ManagedSystemsService managed; private final DecisionRepository decisions; private final IncidentRepository incidents; private final MemoryRepository memories;
    public PmAttentionService(ManagedSystemsService managed, DecisionRepository decisions, IncidentRepository incidents, MemoryRepository memories){this.managed=managed;this.decisions=decisions;this.incidents=incidents;this.memories=memories;}
    public List<Map<String,Object>> items(){
        List<Map<String,Object>> output=new ArrayList<>();
        for(Map<String,Object> value:managed.pmInbox()) output.add(item("SYSTEM",text(value.get("id")),text(value.get("sourceSystemId")),text(value.get("title")),text(value.get("summary")),text(value.get("severity")),value.get("createdAt"),0,0));
        for(Map<String,Object> value:decisions.list(100)) if("REVIEW_REQUIRED".equals(value.get("status"))) output.add(item("DECISION",text(value.get("recommendation_id")),text(value.get("service")),"AI recommendation review",text(value.get("summary")),"high",value.get("created_at"),1,0));
        for(Map<String,Object> value:incidents.list()) if(!List.of("RESOLVED","CLOSED").contains(value.get("status"))) output.add(item("INCIDENT",text(value.get("incident_id")),"archiveos",text(value.get("title")),text(value.get("status")),text(value.get("severity")),value.get("detected_at"),affected(value),0));
        for(Map<String,Object> value:memories.list()) if("DRAFT".equals(value.get("status"))) output.add(item("MEMORY",text(value.get("memory_id")),text(value.get("service")),"Memory draft approval",text(value.get("title")),"medium",value.get("created_at"),0,0));
        return output.stream().sorted(Comparator.comparingInt(v -> -((Number)v.get("deterministicScore")).intValue())).toList();
    }
    private Map<String,Object> item(String type,String sourceId,String service,String title,String summary,String severity,Object created,int affectedServices,int financialRisk){
        int severityScore=switch(severity.toLowerCase()){case "critical"->90;case "high"->70;case "medium","warning"->45;default->20;};
        int ageScore=age(created); int impact=Math.min(20,affectedServices*5); int score=Math.min(100,severityScore+ageScore+impact+financialRisk);
        Map<String,Object> value=new LinkedHashMap<>(); value.put("inboxId",type+":"+sourceId); value.put("type",type); value.put("sourceId",sourceId); value.put("service",service); value.put("title",title); value.put("summary",summary); value.put("severity",severity); value.put("urgency",severityScore>=70?"HIGH":"NORMAL"); value.put("impact",impact); value.put("age",ageScore); value.put("owner",null); value.put("status","NEW"); value.put("deterministicScore",score); value.put("aiSuggestedPriority",null); value.put("aiPriorityExplanation",null); value.put("createdAt",created); value.put("updatedAt",created); return value;
    }
    private int age(Object created){try{long minutes=Duration.between(Instant.parse(String.valueOf(created)),Instant.now()).toMinutes();return minutes>=240?15:minutes>=60?10:minutes>=15?5:0;}catch(Exception ignored){return 0;}}
    private int affected(Map<String,Object> incident){Object services=incident.get("affected_services");return services instanceof List<?> list?list.size():0;}
    private String text(Object value){return value==null?"":String.valueOf(value);}
}
