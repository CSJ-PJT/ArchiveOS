package com.archiveos.ai.managed;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ManagedSystemsController {
    private final ManagedSystemsService service;

    public ManagedSystemsController(ManagedSystemsService service) {
        this.service = service;
    }

    @GetMapping("/managed-systems/overview")
    public Map<String, Object> overview() { return envelope(service.overview()); }

    @GetMapping("/managed-systems")
    public Map<String, Object> systems() { return envelope(service.systems()); }

    @GetMapping("/managed-systems/{systemId}")
    public Map<String, Object> system(@PathVariable String systemId) { return envelope(service.system(systemId)); }

    @GetMapping("/managed-systems/{systemId}/events")
    public Map<String, Object> events(@PathVariable String systemId) { return envelope(service.systemEvents(systemId)); }

    @GetMapping("/managed-systems/{systemId}/workflows")
    public Map<String, Object> workflows(@PathVariable String systemId) { return envelope(service.systemWorkflows(systemId)); }

    @GetMapping("/managed-systems/{systemId}/work-logs")
    public Map<String, Object> workLogs(@PathVariable String systemId) { return envelope(service.systemWorkLogs(systemId)); }

    @GetMapping("/pm-inbox")
    public Map<String, Object> inbox() { return envelope(service.pmInbox()); }

    @PostMapping("/pm-inbox/{id}/acknowledge")
    public Map<String, Object> acknowledge(@PathVariable String id) { return envelope(service.acknowledge(id)); }

    @PostMapping("/pm-inbox/{id}/resolve")
    public Map<String, Object> resolve(@PathVariable String id) { return envelope(service.resolve(id)); }

    @ExceptionHandler(ManagedSystemsValidationException.class)
    public ResponseEntity<Map<String, Object>> validation(ManagedSystemsValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
