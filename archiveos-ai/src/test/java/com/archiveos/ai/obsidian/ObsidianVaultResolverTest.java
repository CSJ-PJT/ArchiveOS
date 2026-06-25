package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ObsidianVaultResolverTest {
    @TempDir
    Path tempDir;

    @Test
    void prefersConfiguredVaultWithMarkdownFiles() throws Exception {
        Files.writeString(tempDir.resolve("ArchiveOS.md"), "# ArchiveOS\nSpring AI RAG");
        Files.writeString(tempDir.resolve("DeepStake3D.md"), "# DeepStake3D");
        Files.writeString(tempDir.resolve("AX.md"), "# AX");
        var properties = new ArchiveOsAiProperties("", tempDir.toString(), 1200, 160, 5);

        var resolver = new ObsidianVaultResolver(properties);

        assertThat(resolver.resolveVaultPath()).isEqualTo(tempDir.toAbsolutePath().normalize());
        assertThat(resolver.findCandidates()).isNotEmpty();
    }
}
