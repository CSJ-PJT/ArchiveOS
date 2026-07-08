package com.archiveos.ai.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class WorkflowServiceTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void createPreservesLegacyDefaultsAndRecordsEvent() throws Exception {
        WorkflowJdbcRepository repository = mock(WorkflowJdbcRepository.class);
        WorkflowService service = new WorkflowService(repository);
        WorkflowTaskRecord created = task("queued", 0, 2);
        when(repository.create(any(), eq(2))).thenReturn(created);

        WorkflowTaskRecord result = service.create(json.readTree("""
                {"title":"  Migrate queue  ","description":"  Keep the API stable  "}
                """));

        ArgumentCaptor<CreateWorkflowTaskRequest> request = ArgumentCaptor.forClass(CreateWorkflowTaskRequest.class);
        verify(repository).create(request.capture(), eq(2));
        assertThat(request.getValue().title()).isEqualTo("Migrate queue");
        assertThat(request.getValue().description()).isEqualTo("Keep the API stable");
        assertThat(request.getValue().priority()).isEqualTo("medium");
        assertThat(request.getValue().targetProject()).isEqualTo("DeepStake3D");
        assertThat(request.getValue().metadata()).containsEntry("source", "pm_queue");
        verify(repository).recordEvent(eq(created.id()), eq("task_created"), eq("Task queued"), any(), eq("queue"), any());
        assertThat(result).isSameAs(created);
    }

    @Test void createPreservesNexusContractMetadata() throws Exception {
        WorkflowJdbcRepository repository = mock(WorkflowJdbcRepository.class);
        WorkflowService service = new WorkflowService(repository);
        when(repository.create(any(), eq(3))).thenReturn(task("queued", 0, 3));

        service.create(json.readTree("""
                {"title":"Nexus action","description":"Manufacturing decision","target_project":"Archive-Nexus","max_iterations":3,
                 "metadata":{"source":"archive-nexus","source_task_id":"TASK-1","correlation_id":"CORR-1","requested_by":"operator"}}
                """));

        ArgumentCaptor<CreateWorkflowTaskRequest> request = ArgumentCaptor.forClass(CreateWorkflowTaskRequest.class);
        verify(repository).create(request.capture(), eq(3));
        assertThat(request.getValue().targetProject()).isEqualTo("Archive-Nexus");
        assertThat(request.getValue().metadata())
                .containsEntry("source", "archive-nexus")
                .containsEntry("source_task_id", "TASK-1")
                .containsEntry("correlation_id", "CORR-1");
    }

    @Test void callbackMarksTaskDoneAndRecordsEvent() throws Exception {
        WorkflowJdbcRepository repository = mock(WorkflowJdbcRepository.class);
        WorkflowService service = new WorkflowService(repository);
        UUID id = UUID.randomUUID();
        when(repository.find(id)).thenReturn(task(id, "approved", 1, 2));
        when(repository.applyCallback(eq(id), eq("done"), any())).thenReturn(task(id, "done", 1, 2));

        Map<String, Object> response = service.callback(id, json.readTree("""
                {"status":"success","summary":"Action completed","correlationId":"CORR-1","sourceTaskId":"TASK-1","confidence":0.91}
                """));

        assertThat(response).containsEntry("previousStatus", "approved");
        @SuppressWarnings("unchecked") ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.forClass(Map.class);
        verify(repository).applyCallback(eq(id), eq("done"), metadata.capture());
        assertThat(metadata.getValue()).containsEntry("callback_status", "success")
                .containsEntry("correlation_id", "CORR-1")
                .containsEntry("source_task_id", "TASK-1");
        verify(repository).recordEvent(eq(id), eq("nexus_action_callback"), any(), eq("Action completed"), eq("queue"), any());
    }

    @Test void patchPreservesExplicitNullAndClampsIterations() throws Exception {
        WorkflowJdbcRepository repository = mock(WorkflowJdbcRepository.class);
        WorkflowService service = new WorkflowService(repository);
        UUID id = UUID.randomUUID();
        when(repository.update(eq(id), any())).thenReturn(task("queued", 0, 10));

        service.update(id, json.readTree("{\"scope_files\":null,\"cost_budget\":null,\"max_iterations\":99}"));

        @SuppressWarnings("unchecked") ArgumentCaptor<Map<String, Object>> changes = ArgumentCaptor.forClass(Map.class);
        verify(repository).update(eq(id), changes.capture());
        assertThat(changes.getValue()).containsEntry("max_iterations", 10).containsKeys("scope_files", "cost_budget");
        assertThat(changes.getValue().get("scope_files")).isNull();
        assertThat(changes.getValue().get("cost_budget")).isNull();
    }

    @Test void terminalTaskCannotBeRetried() {
        WorkflowJdbcRepository repository = mock(WorkflowJdbcRepository.class);
        WorkflowService service = new WorkflowService(repository);
        UUID id = UUID.randomUUID();
        when(repository.find(id)).thenReturn(task(id, "approved", 1, 2));

        assertThatThrownBy(() -> service.retry(id, null))
                .isInstanceOf(WorkflowValidationException.class)
                .hasMessage("Terminal tasks cannot be retried automatically.");
    }

    @Test void rejectRequiresReasonBeforePersistence() throws Exception {
        WorkflowService service = new WorkflowService(mock(WorkflowJdbcRepository.class));
        assertThatThrownBy(() -> service.decide(UUID.randomUUID(), json.readTree("{\"action\":\"reject\"}")))
                .isInstanceOf(WorkflowValidationException.class)
                .hasMessage("reason is required when rejecting a task.");
    }

    private WorkflowTaskRecord task(String status, int iteration, int maxIterations) {
        return task(UUID.randomUUID(), status, iteration, maxIterations);
    }
    private WorkflowTaskRecord task(UUID id, String status, int iteration, int maxIterations) {
        Instant now = Instant.parse("2026-06-29T00:00:00Z");
        return new WorkflowTaskRecord(id, "Task", "Description", "medium", status, "DeepStake3D", List.of(),
                maxIterations, iteration, null, now, now, null, null, null, null, null, Map.of());
    }
}
