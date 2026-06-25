package com.archiveos.ai;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final String openAiApiKey;
    private final String obsidianVaultPath;
    private final String databaseHost;

    public HealthController(
            @Value("${archiveos.openai-api-key:}") String openAiApiKey,
            @Value("${archiveos.obsidian-vault-path:}") String obsidianVaultPath,
            @Value("${archiveos.db-host:}") String databaseHost) {
        this.openAiApiKey = openAiApiKey;
        this.obsidianVaultPath = obsidianVaultPath;
        this.databaseHost = databaseHost;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "module", "archiveos-ai",
                "aiProvider", "openai",
                "openAiConfigured", !openAiApiKey.isBlank(),
                "obsidianVaultConfigured", !obsidianVaultPath.isBlank(),
                "database", databaseHost.isBlank() ? "not_configured" : "configured"));
    }
}
