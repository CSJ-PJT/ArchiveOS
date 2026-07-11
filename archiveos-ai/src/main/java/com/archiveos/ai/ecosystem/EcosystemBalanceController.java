package com.archiveos.ai.ecosystem;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EcosystemBalanceController {
    private final EcosystemBalanceService service;
    public EcosystemBalanceController(EcosystemBalanceService service) { this.service = service; }
    @GetMapping("/api/ecosystem/balance/summary") public Map<String, Object> summary() { return envelope(service.summary()); }
    @GetMapping("/api/ecosystem/balance/recommendations") public Map<String, Object> recommendations() { return envelope(service.recommendations()); }
    @PostMapping("/api/ecosystem/balance/simulate") public Map<String, Object> simulate(@RequestBody(required = false) Map<String, Object> request) { return envelope(service.simulate(request)); }
    private Map<String, Object> envelope(Object data) { Map<String, Object> result = new LinkedHashMap<>(); result.put("data", data); return result; }
}
