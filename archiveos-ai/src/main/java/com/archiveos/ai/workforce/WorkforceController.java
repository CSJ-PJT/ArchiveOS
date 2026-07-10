package com.archiveos.ai.workforce;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workforce")
public class WorkforceController {
    private final WorkforceService service;

    public WorkforceController(WorkforceService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return service.overview();
    }

    @GetMapping("/bottlenecks")
    public Map<String, Object> bottlenecks() {
        return service.bottlenecks();
    }

    @GetMapping("/recommendations")
    public Map<String, Object> recommendations() {
        return service.recommendations();
    }

    @GetMapping("/productivity-trend")
    public Map<String, Object> productivityTrend() {
        return service.productivityTrend();
    }
}
