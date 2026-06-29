package com.archiveos.ai.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class PlatformControllerTest {
    @Test void livenessPreservesLegacyNodeContract() {
        ResponseEntity<Map<String, Object>> response = new PlatformController(mock(PlatformRuntimeService.class)).liveness();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "ok").containsEntry("service", "archiveos-backend");
    }
}
