package com.archiveos.ai.timeline;

import com.archiveos.ai.decision.DecisionEngineService;
import java.time.Instant;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/correlation-timeline")
public class CorrelationTimelineController {
    private final CorrelationTimelineService timeline; private final DecisionEngineService decisions;
    public CorrelationTimelineController(CorrelationTimelineService timeline, DecisionEngineService decisions){this.timeline=timeline;this.decisions=decisions;}
    @GetMapping("/{id}") public Map<String,Object> get(@PathVariable String id){return Map.of("data",timeline.timeline(id));}
    @PostMapping("/{id}/explain") public Map<String,Object> explain(@PathVariable String id, Authentication auth){
        Map<String,Object> source=timeline.timeline(id);
        Map<String,Object> result=decisions.analyze(new DecisionEngineService.DecisionRequest(null,"SERVICE","ArchiveOS",null,id,
            "Explain this deterministic correlation timeline, including delays, anomalies, supporting evidence, and human review steps.",source,auth==null?"unknown":auth.getName(),Instant.now().toString()),auth==null?"unknown":auth.getName());
        return Map.of("data",result);
    }
}
