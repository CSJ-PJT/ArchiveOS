package com.archiveos.ai.activity;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ActivityServiceTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void workLogTrimsContentAndKeepsNullReferences() throws Exception {
        ActivityRepository repository = Mockito.mock(ActivityRepository.class);
        ActivityService service = new ActivityService(repository);
        when(repository.createWorkLog(null, null, "summary", "runtime ready")).thenReturn(Map.of("id", "1"));
        service.createWorkLog(json.readTree("{\"task_id\":null,\"agent_id\":null,\"log_type\":\"summary\",\"content\":\"  runtime ready  \"}"));
        verify(repository).createWorkLog(null, null, "summary", "runtime ready");
    }

    @Test void commandCannotEscalateRecordedIntentToRunning() throws Exception {
        ActivityRepository repository = Mockito.mock(ActivityRepository.class);
        ActivityService service = new ActivityService(repository);
        String fallback = "Command recorded as pending. Real execution is not enabled yet.";
        when(repository.createCommand("git status", null, "pending", fallback)).thenReturn(Map.of("id", "1"));
        service.createCommand(json.readTree("{\"command\":\"git status\",\"status\":\"running\"}"));
        verify(repository).createCommand("git status", null, "pending", fallback);
    }

    @Test void invalidLogTypeKeepsCompatibilityError() throws Exception {
        ActivityService service = new ActivityService(Mockito.mock(ActivityRepository.class));
        assertThatThrownBy(() -> service.createWorkLog(json.readTree("{\"log_type\":\"debug\",\"content\":\"x\"}")))
                .isInstanceOf(ActivityValidationException.class)
                .hasMessage("log_type must be one of summary, decision, error, review.");
    }
}
