package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class KnowledgeScopeClassifierTest {
    private final KnowledgeScopeClassifier classifier = new KnowledgeScopeClassifier(
            new ArchiveOsAiProperties("", "", 1200, 160, 5, List.of("public/")));

    @Test
    void defaultsEveryNonApprovedPathToInternal() {
        assertThat(classifier.classify(document("operations/slack-runbook.md", "일반 안내")))
                .isEqualTo(KnowledgeScope.INTERNAL);
    }

    @Test
    void acceptsOnlySafeDocumentsBelowApprovedPublicPrefix() {
        assertThat(classifier.classify(document("public/service-overview.md", "공개 서비스 소개")))
                .isEqualTo(KnowledgeScope.PUBLIC);
    }

    @Test
    void rejectsOperationalCommandsEvenBelowPublicPrefix() {
        assertThat(classifier.classify(document("public/help.md", "curl http://localhost:4100/api/runtime/status")))
                .isEqualTo(KnowledgeScope.INTERNAL);
    }

    private MarkdownDocument document(String path, String content) {
        return new MarkdownDocument(path, "title", content, "hash", Instant.parse("2026-08-29T00:00:00Z"));
    }
}
