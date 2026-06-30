package com.archiveos.ai.architect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ArchitectControllerTest {
    private final ArchitectService service = mock(ArchitectService.class);
    private final ArchitectController controller = new ArchitectController(service);

    @Test void returnsCreatedEnvelope() throws Exception {
        var body = new ObjectMapper().readTree("{\"targetType\":\"task\"}");
        when(service.review(body)).thenReturn(Map.of("id", "review-1"));
        var response = controller.review(body);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).containsKey("data");
    }

    @Test void returnsRecentEnvelope() {
        when(service.recent(20)).thenReturn(List.of(Map.of("id", "review-1")));
        var response = controller.recent(20);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsKey("data");
    }
}
