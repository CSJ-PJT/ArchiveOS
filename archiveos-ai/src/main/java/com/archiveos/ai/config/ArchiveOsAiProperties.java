package com.archiveos.ai.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos")
public record ArchiveOsAiProperties(
        String openaiApiKey,
        String obsidianVaultPath,
        int obsidianChunkSize,
        int obsidianChunkOverlap,
        int ragMaxReferences,
        List<String> ragPublicPathPrefixes) {
    private static final String DISABLED_OPENAI_KEY = "archiveos-disabled-key";
    public ArchiveOsAiProperties {
        if (openaiApiKey == null) openaiApiKey = "";
        if (obsidianVaultPath == null) obsidianVaultPath = "";
        if (obsidianChunkSize <= 0) obsidianChunkSize = 1200;
        if (obsidianChunkOverlap < 0) obsidianChunkOverlap = 160;
        if (ragMaxReferences <= 0) ragMaxReferences = 5;
        if (ragPublicPathPrefixes == null || ragPublicPathPrefixes.isEmpty()) {
            ragPublicPathPrefixes = List.of("public/");
        } else {
            ragPublicPathPrefixes = ragPublicPathPrefixes.stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(value -> value.replace('\\', '/').toLowerCase())
                    .map(value -> value.endsWith("/") ? value : value + "/")
                    .distinct()
                    .toList();
        }
    }

    public boolean openAiConfigured() {
        return !openaiApiKey.isBlank() && !DISABLED_OPENAI_KEY.equals(openaiApiKey);
    }

    public boolean obsidianConfigured() {
        return !obsidianVaultPath.isBlank();
    }
}
