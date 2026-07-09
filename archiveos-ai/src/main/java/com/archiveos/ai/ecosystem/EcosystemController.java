package com.archiveos.ai.ecosystem;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EcosystemController {
    private final EcosystemService service;

    public EcosystemController(EcosystemService service) {
        this.service = service;
    }

    @GetMapping("/api/ecosystem/services")
    public Map<String, Object> services() { return envelope(service.services()); }

    @GetMapping("/api/ecosystem/summary")
    public Map<String, Object> summary() { return envelope(service.summary()); }

    @GetMapping("/api/ecosystem/topology")
    public Map<String, Object> topology() { return envelope(service.topology()); }

    @GetMapping("/api/ecosystem/timeline")
    public Map<String, Object> timeline(@RequestParam(defaultValue = "50") int limit) { return envelope(service.timeline(limit)); }

    @PostMapping("/api/ecosystem/refresh")
    public Map<String, Object> refresh() { return envelope(service.refresh()); }

    @PostMapping("/api/ecosystem/demo/dry-run")
    public Map<String, Object> dryRun() { return envelope(service.dryRun()); }

    @PostMapping("/api/ecosystem/demo/run")
    public Map<String, Object> runDemo() { return envelope(service.runDemo()); }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
