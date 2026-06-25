package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MarkdownChunkerTest {
    private final MarkdownChunker chunker = new MarkdownChunker();

    @Test
    void chunksMarkdownByHeadingsAndPreservesHeading() {
        var chunks = chunker.chunk("# Title\nIntro\n\n## Phase 1\nDetails", 500, 0);

        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(0).heading()).isEqualTo("Title");
        assertThat(chunks.get(1).heading()).isEqualTo("Phase 1");
    }

    @Test
    void chunksLongSectionWithOverlap() {
        String content = "# Long\n" + "a".repeat(700);

        var chunks = chunker.chunk(content, 240, 40);

        assertThat(chunks.size()).isGreaterThan(1);
        assertThat(chunks).allMatch(chunk -> "Long".equals(chunk.heading()));
    }
}
