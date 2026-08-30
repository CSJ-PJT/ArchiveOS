package com.archiveos.ai.openaiusage;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/openai/usage")
public class OpenAiUsageController {
    private final OpenAiUsageService service;

    public OpenAiUsageController(OpenAiUsageService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> summary() {
        return Map.of("data", service.summary());
    }
}
