package com.archiveos.ai.obsidian;

import java.util.List;

public record RagAnswer(
        String answer,
        List<RagReference> references,
        String evidenceType,
        boolean actualCheckPerformed,
        String checkedAt,
        String sourceFreshness,
        String confidence,
        String answerScope,
        String cannotVerifyReason) {

    public RagAnswer(String answer, List<RagReference> references) {
        this(answer, references, "DOCUMENT", false, null, "UNKNOWN", "LOW", "INTERNAL_KNOWLEDGE", null);
    }
}
