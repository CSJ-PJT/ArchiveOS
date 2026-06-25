package com.archiveos.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class HealthControllerTest {
    @Test
    void healthReturnsArchiveOsAiModule() {
        HealthController controller = new HealthController("", "", "");

        ResponseEntity<Map<String, Object>> response = controller.health();

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody()).containsEntry("status", "UP");
        assertThat(response.getBody()).containsEntry("module", "archiveos-ai");
        assertThat(response.getBody()).containsEntry("aiProvider", "openai");
    }
}
