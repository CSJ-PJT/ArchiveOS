package com.archiveos.ai.runtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class AiRuntimeStateTest {
    @Test
    void recordsRagMetricsWithoutStoringSecrets() {
        AiRuntimeState state = new AiRuntimeState();

        state.recordAsk(Instant.now(), false, 0, 0, new RuntimeException("bad key sk-proj-secret password=hidden"));

        assertThat(state.ask().success()).isFalse();
        assertThat(state.ask().lastError()).contains("[redacted-openai-key]");
        assertThat(state.ask().lastError()).contains("password=[redacted]");
        assertThat(state.ask().lastError()).doesNotContain("sk-proj-secret");
        assertThat(state.ask().lastError()).doesNotContain("password=hidden");
    }

    @Test
    void recordsModelCallSuccessAndFailureSeparately() {
        AiRuntimeState state = new AiRuntimeState();

        state.recordEmbeddingSuccess(12);
        state.recordChatFailure(new IllegalStateException("not configured"), 5);

        assertThat(state.embeddingModel().lastSuccessAt()).isNotNull();
        assertThat(state.embeddingModel().lastLatencyMs()).isEqualTo(12);
        assertThat(state.chatModel().lastFailureAt()).isNotNull();
        assertThat(state.chatModel().lastError()).isEqualTo("not configured");
    }
}
