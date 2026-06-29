package com.archiveos.ai.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.ResponseEntity;

class WorkflowControllerTest {
    @Test void listReturnsLegacyWarningWhenQueueStorageIsUnavailable() {
        WorkflowService service = mock(WorkflowService.class);
        when(service.list()).thenThrow(new DataAccessResourceFailureException("offline"));

        Map<String, Object> response = new WorkflowController(service).list();

        assertThat(response.get("data")).isEqualTo(java.util.List.of());
        assertThat(response.get("warning")).isEqualTo(
                "PM task queue is not available yet. Apply queue schema or check Supabase connectivity.");
    }

    @Test void summaryReturnsLegacyEmptyShapeWhenQueueStorageIsUnavailable() {
        WorkflowService service = mock(WorkflowService.class);
        when(service.summary()).thenThrow(new DataAccessResourceFailureException("offline"));

        @SuppressWarnings("unchecked") Map<String, Object> data = (Map<String, Object>) new WorkflowController(service).summary().get("data");

        assertThat(data).containsEntry("queued", 0).containsEntry("in_progress", 0)
                .containsEntry("pm_decision_required", 0).containsEntry("current_task", null)
                .containsEntry("recommended_pm_action",
                        "PM queue summary is not available yet. Apply queue schema or check Supabase connectivity.");
    }

    @Test void createReturnsExactValidationErrorEnvelope() {
        WorkflowService service = mock(WorkflowService.class);
        when(service.create(null)).thenThrow(new WorkflowValidationException("Request body must be a JSON object."));

        ResponseEntity<Map<String, Object>> response = new WorkflowController(service).create(null);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).containsEntry("error", "Request body must be a JSON object.");
    }
}
