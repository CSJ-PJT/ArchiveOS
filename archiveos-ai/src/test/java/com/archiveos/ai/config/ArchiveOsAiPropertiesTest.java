package com.archiveos.ai.config;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class ArchiveOsAiPropertiesTest {
    @Test void placeholderKeyKeepsAiRuntimeDisabled() {
        assertThat(new ArchiveOsAiProperties("archiveos-disabled-key", "", 1200, 160, 5).openAiConfigured()).isFalse();
    }
    @Test void realKeyEnablesAiRuntime() {
        assertThat(new ArchiveOsAiProperties("configured-test-key", "", 1200, 160, 5).openAiConfigured()).isTrue();
    }
}
