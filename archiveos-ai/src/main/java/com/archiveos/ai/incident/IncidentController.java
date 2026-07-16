package com.archiveos.ai.incident;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentDetectionService service;
    public IncidentController(IncidentDetectionService service){this.service=service;}
    @PostMapping("/detect") public Map<String,Object> detect(){return Map.of("data",service.detect());}
    @GetMapping public Map<String,Object> list(){return Map.of("data",service.list());}
    @PostMapping("/{id}/analyze") public ResponseEntity<Map<String,Object>> analyze(@PathVariable String id, Authentication auth){Map<String,Object> result=service.analyze(id,auth==null?"unknown":auth.getName());return result==null?ResponseEntity.notFound().build():ResponseEntity.ok(Map.of("data",result));}
    @PostMapping("/{id}/{state:acknowledge|resolve}") public Map<String,Object> state(@PathVariable String id,@PathVariable String state){return Map.of("data",service.state(id,"acknowledge".equals(state)?"ACKNOWLEDGED":"RESOLVED"));}
}
