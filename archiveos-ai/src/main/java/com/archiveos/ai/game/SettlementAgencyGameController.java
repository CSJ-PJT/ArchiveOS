package com.archiveos.ai.game;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SettlementAgencyGameController {
    private final SettlementAgencyGameService service;

    public SettlementAgencyGameController(SettlementAgencyGameService service) {
        this.service = service;
    }

    @GetMapping("/api/game/settlement-agency/summary")
    public Map<String, Object> summary() {
        return envelope(service.summary());
    }

    @GetMapping("/api/game/settlement-agency/preset")
    public Map<String, Object> preset() {
        return envelope(service.preset());
    }

    @PostMapping("/api/game/settlement-agency/simulate")
    public Map<String, Object> simulate(
            @RequestBody(required = false) Map<String, Object> request,
            @RequestParam(defaultValue = "true") boolean dryRun) {
        return envelope(service.simulate(request == null ? Map.of() : request, dryRun));
    }

    @GetMapping("/api/game/settlement-agency/finance")
    public Map<String, Object> finance() {
        return envelope(service.financeSummary());
    }

    @GetMapping("/api/game/settlement-agency/finance/{systemId}")
    public Map<String, Object> systemFinance(@PathVariable String systemId) {
        return envelope(service.systemFinance(systemId));
    }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
