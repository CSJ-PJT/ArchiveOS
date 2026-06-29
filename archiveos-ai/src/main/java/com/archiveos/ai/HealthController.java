package com.archiveos.ai;

import com.archiveos.ai.runtime.AiRuntimeService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final AiRuntimeService runtimeService;

    public HealthController(AiRuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> runtime = runtimeService.runtime();
        String runtimeStatus = String.valueOf(runtime.getOrDefault("status", "unavailable"));
        String status = switch (runtimeStatus) {
            case "healthy" -> "UP";
            case "degraded" -> "DEGRADED";
            default -> "DOWN";
        };
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        body.put("module", "archiveos-ai");
        body.put("aiProvider", "openai");
        body.put("checkedAt", runtime.get("checkedAt"));
        body.put("components", Map.of(
                "springAi", runtime.get("springAi"),
                "chatModel", runtime.get("chatModel"),
                "embeddingModel", runtime.get("embeddingModel"),
                "vectorStore", runtime.get("vectorStore"),
                "obsidian", runtime.get("obsidian"),
                "rag", runtime.get("rag")));
        return ResponseEntity.ok(body);
    }
}
