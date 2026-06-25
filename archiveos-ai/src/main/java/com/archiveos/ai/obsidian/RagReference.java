package com.archiveos.ai.obsidian;

public record RagReference(String title, String path, String heading, String chunkText, double score) {}
