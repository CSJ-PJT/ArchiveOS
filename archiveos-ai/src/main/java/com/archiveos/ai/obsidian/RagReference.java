package com.archiveos.ai.obsidian;

import com.fasterxml.jackson.annotation.JsonIgnore;

public record RagReference(
        String title,
        @JsonIgnore String path,
        String heading,
        @JsonIgnore String chunkText,
        double score,
        String updatedAt,
        KnowledgeScope knowledgeScope) {

    public RagReference(String title, String path, String heading, String chunkText, double score) {
        this(title, path, heading, chunkText, score, null, KnowledgeScope.INTERNAL);
    }
}
