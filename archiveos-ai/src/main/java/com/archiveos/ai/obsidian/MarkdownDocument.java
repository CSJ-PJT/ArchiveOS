package com.archiveos.ai.obsidian;

import java.time.Instant;

public record MarkdownDocument(String relativePath, String title, String content, String contentHash, Instant lastModifiedAt) {}
