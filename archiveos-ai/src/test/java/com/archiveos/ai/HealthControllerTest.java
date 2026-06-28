package com.archiveos.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import com.archiveos.ai.runtime.AiRuntimeService;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HealthControllerTest {
    @Test
    void healthReturnsArchiveOsAiModule() {
        AiRuntimeService runtimeService = mock(AiRuntimeService.class);
        when(runtimeService.runtime()).thenReturn(Map.of(
                "status", "degraded", "checkedAt", "2026-06-28T00:00:00Z",
                "springAi", Map.of("status", "up"), "chatModel", Map.of("available", true),
                "embeddingModel", Map.of("available", true), "vectorStore", Map.of("available", false),
                "obsidian", Map.of("reachable", false), "rag", Map.of("ready", false)));
        HealthController controller = new HealthController(runtimeService);

        ResponseEntity<Map<String, Object>> response = controller.health();

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody()).containsEntry("status", "DEGRADED");
        assertThat(response.getBody()).containsEntry("module", "archiveos-ai");
        assertThat(response.getBody()).containsEntry("aiProvider", "openai");
        assertThat(response.getBody()).containsKey("components");
    }
}
