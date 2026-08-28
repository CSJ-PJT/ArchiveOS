package com.archiveos.ai.config;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import org.junit.jupiter.api.Test;

class ArchiveOsAiPropertiesTest {
    @Test void missingOrBlankKeyKeepsAiRuntimeDisabled() {
        assertThat(new ArchiveOsAiProperties(null, "", 1200, 160, 5, List.of("public/")).openAiConfigured()).isFalse();
        assertThat(new ArchiveOsAiProperties("", "", 1200, 160, 5, List.of("public/")).openAiConfigured()).isFalse();
        assertThat(new ArchiveOsAiProperties("   ", "", 1200, 160, 5, List.of("public/")).openAiConfigured()).isFalse();
    }
    @Test void placeholderKeyKeepsAiRuntimeDisabled() {
        assertThat(new ArchiveOsAiProperties("archiveos-disabled-key", "", 1200, 160, 5, List.of("public/")).openAiConfigured()).isFalse();
    }
    @Test void realKeyEnablesAiRuntime() {
        assertThat(new ArchiveOsAiProperties("configured-test-key", "", 1200, 160, 5, List.of("public/")).openAiConfigured()).isTrue();
    }
}
