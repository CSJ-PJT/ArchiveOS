package com.archiveos.ai.knowledge;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class KnowledgeController {
    private final KnowledgeReadService service;
    public KnowledgeController(KnowledgeReadService service) { this.service = service; }

    @GetMapping("/api/knowledge/health")
    public ResponseEntity<Map<String, Object>> health() { return ok(service.health()); }

    @GetMapping("/api/knowledge/overview")
    public ResponseEntity<Map<String, Object>> overview() { return safely(service::overview, "Failed to fetch knowledge overview."); }

    @GetMapping("/api/knowledge/recent")
    public ResponseEntity<Map<String, Object>> recent(@RequestParam(defaultValue = "20") int limit) { return safely(() -> service.recent(limit), "Failed to fetch recent knowledge nodes."); }

    @GetMapping("/api/knowledge/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "20") int limit) { return safely(() -> service.search(q, limit), "Failed to search knowledge nodes."); }

    @GetMapping("/api/knowledge/related")
    public ResponseEntity<Map<String, Object>> related(@RequestParam(name = "external_ref", required = false) String externalRef, @RequestParam(name = "node_type", required = false) String nodeType) { return safely(() -> service.related(externalRef, nodeType), "Failed to fetch related knowledge."); }

    @GetMapping({"/api/knowledge/graph", "/api/knowledge/map"})
    public ResponseEntity<Map<String, Object>> graph(@RequestParam(defaultValue = "100") int limit) { return safely(() -> service.graph(limit), "Failed to fetch knowledge graph."); }

    @GetMapping({"/api/knowledge/graph/insights", "/api/knowledge/map/insights"})
    public ResponseEntity<Map<String, Object>> insights(@RequestParam(defaultValue = "100") int limit) { return safely(() -> service.insights(limit), "Failed to fetch knowledge graph insights."); }

    @GetMapping("/api/knowledge/node/{id}")
    public ResponseEntity<Map<String, Object>> node(@PathVariable String id) {
        try { Object data = service.detail(id); return data == null ? ResponseEntity.status(404).body(Map.of("error", "Knowledge node not found.")) : ok(data); }
        catch (Exception ignored) { return ResponseEntity.status(404).body(Map.of("error", "Knowledge node not found.")); }
    }

    private ResponseEntity<Map<String, Object>> safely(Supplier<Object> supplier, String error) {
        try { return ok(supplier.get()); } catch (Exception ignored) { return ResponseEntity.status(500).body(Map.of("error", error)); }
    }
    private ResponseEntity<Map<String, Object>> ok(Object data) { Map<String, Object> envelope = new LinkedHashMap<>(); envelope.put("data", data); return ResponseEntity.ok(envelope); }
}
