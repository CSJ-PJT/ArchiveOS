package com.archiveos.ai.obsidian;

public record ObsidianSyncResult(
        boolean enabled,
        int scanned,
        int created,
        int updated,
        int skipped,
        int deletedChunks,
        int embeddedChunks,
        String reason) {}
