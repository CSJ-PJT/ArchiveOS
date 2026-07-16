package com.archiveos.ai.decision;
import jakarta.validation.Valid; import jakarta.validation.constraints.NotBlank; import java.util.List; import java.util.Map; import org.springframework.http.ResponseEntity; import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/ai/decisions")
public class DecisionController { private final DecisionEngineService service; public DecisionController(DecisionEngineService service){this.service=service;}
 @PostMapping("/analyze") public Map<String,Object> analyze(@Valid @RequestBody DecisionEngineService.DecisionRequest request, Authentication auth){return Map.of("data",service.analyze(request,auth==null?"unknown":auth.getName()));}
 @GetMapping public Map<String,Object> list(@RequestParam(defaultValue="50") int limit){return Map.of("data",service.list(limit));}
 @GetMapping("/{id}") public ResponseEntity<Map<String,Object>> get(@PathVariable String id){Map<String,Object> v=service.get(id);return v==null?ResponseEntity.notFound().build():ResponseEntity.ok(Map.of("data",v));}
 @PostMapping("/{id}/approve") public ResponseEntity<Map<String,Object>> approve(@PathVariable String id,@RequestBody(required=false) DecisionBody body,Authentication auth){return decide(id,true,body,auth);}
 @PostMapping("/{id}/reject") public ResponseEntity<Map<String,Object>> reject(@PathVariable String id,@RequestBody(required=false) DecisionBody body,Authentication auth){return decide(id,false,body,auth);}
 private ResponseEntity<Map<String,Object>> decide(String id,boolean approve,DecisionBody body,Authentication auth){Map<String,Object> v=service.decide(id,approve,auth==null?"unknown":auth.getName(),body==null?null:body.reason());return v==null?ResponseEntity.notFound().build():ResponseEntity.ok(Map.of("data",v));}
 public record DecisionBody(String reason){}
}
