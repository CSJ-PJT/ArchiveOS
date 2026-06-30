package com.archiveos.ai.architect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ArchitectServiceTest {
    private final ArchitectRepository repository = mock(ArchitectRepository.class);
    private final ArchitectService service = new ArchitectService(repository, new ArchitectRuleEvaluator());
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void validatesExistingNodeRequestContract() throws Exception {
        assertThatThrownBy(() -> service.review(mapper.readTree("{}")))
                .isInstanceOf(ArchitectValidationException.class)
                .hasMessage("targetType is required.");
    }

    @Test void recordsRuleEvaluationThroughRepository() throws Exception {
        when(repository.related(anyString(), anyString())).thenReturn(List.of());
        when(repository.insert(anyString(), anyString(), anyString(), anyString(), any(), any(), any()))
                .thenAnswer(invocation -> Map.of("status", invocation.getArgument(2)));
        var body = mapper.readTree("""
                {"targetType":"task","targetRef":"task:1","title":"Codex control","description":"Enable arbitrary shell execution"}
                """);
        assertThat(service.review(body)).containsEntry("status", "blocked");
        verify(repository).insert(eq("task"), eq("task:1"), eq("blocked"), anyString(), any(), any(), eq(List.of()));
    }
}
