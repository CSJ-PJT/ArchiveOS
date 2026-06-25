package com.archiveos.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos")
public record ArchiveOsAiProperties(
        String openaiApiKey,
        String obsidianVaultPath,
        int obsidianChunkSize,
        int obsidianChunkOverlap,
        int ragMaxReferences) {
    public ArchiveOsAiProperties {
        if (openaiApiKey == null) openaiApiKey = "";
        if (obsidianVaultPath == null) obsidianVaultPath = "";
        if (obsidianChunkSize <= 0) obsidianChunkSize = 1200;
        if (obsidianChunkOverlap < 0) obsidianChunkOverlap = 160;
        if (ragMaxReferences <= 0) ragMaxReferences = 5;
    }

    public boolean openAiConfigured() {
        return !openaiApiKey.isBlank();
    }

    public boolean obsidianConfigured() {
        return !obsidianVaultPath.isBlank();
    }
}
