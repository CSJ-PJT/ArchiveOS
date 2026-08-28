package com.archiveos.ai.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobInstance;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.batch.core.launch.JobLauncher;

class BatchJobServiceTest {
    @Test
    void publicExecutionDetailOmitsInternalParametersAndContexts() {
        JobExplorer explorer = mock(JobExplorer.class);
        JobExecution execution = mock(JobExecution.class);
        when(explorer.getJobExecution(42L)).thenReturn(execution);
        when(execution.getId()).thenReturn(42L);
        when(execution.getJobInstance()).thenReturn(new JobInstance(7L, "dailyReportJob"));
        when(execution.getStatus()).thenReturn(BatchStatus.COMPLETED);
        when(execution.getExitStatus()).thenReturn(ExitStatus.COMPLETED);
        when(execution.getStepExecutions()).thenReturn(java.util.Set.of());

        BatchJobService service = new BatchJobService(Map.of(), mock(JobLauncher.class), explorer);
        Map<String, Object> result = service.execution(42L);

        assertThat(result).containsEntry("id", 42L).containsEntry("jobName", "dailyReportJob");
        assertThat(result).doesNotContainKeys("parameters", "executionContext", "exitDescription");
        assertThat(result.get("steps")).isEqualTo(java.util.List.of());
    }
}
