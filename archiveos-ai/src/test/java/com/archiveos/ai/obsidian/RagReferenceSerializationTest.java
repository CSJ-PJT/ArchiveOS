package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class RagReferenceSerializationTest {
    @Test
    void neverSerializesInternalPathOrRetrievedChunkText() throws Exception {
        RagReference reference = new RagReference("공개 안내", "operations/private-runbook.md", "소개",
                "SLACK_WEBHOOK_URL and curl commands", 0.91d, "2026-08-29T00:00:00Z", KnowledgeScope.PUBLIC);

        String json = new ObjectMapper().writeValueAsString(reference);

        assertThat(json)
                .contains("공개 안내", "knowledgeScope")
                .doesNotContain("private-runbook", "SLACK_WEBHOOK_URL", "curl commands", "chunkText", "path");
    }
}
