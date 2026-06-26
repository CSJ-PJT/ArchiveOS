package com.archiveos.ai.rpa;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class RpaJobService {
    private final RpaJdbcRepository repository;
    private final JobLauncher jobLauncher;
    private final Job classifyJob;

    public RpaJobService(
            RpaJdbcRepository repository,
            JobLauncher jobLauncher,
            @Qualifier("archiveosRpaClassifyJob") Job classifyJob) {
        this.repository = repository;
        this.jobLauncher = jobLauncher;
        this.classifyJob = classifyJob;
    }

    public Map<String, Object> createAndClassify(RpaTaskRequest request) {
        RpaTaskRecord task = repository.create(request);
        try {
            var execution = jobLauncher.run(classifyJob, new JobParametersBuilder()
                    .addString("rpaTaskId", task.id().toString())
                    .addLong("requestedAt", System.currentTimeMillis())
                    .toJobParameters());
            RpaTaskRecord updated = repository.get(task.id());
            return Map.of(
                    "jobExecutionId", execution.getId(),
                    "batchStatus", execution.getStatus().name(),
                    "task", updated == null ? task : updated,
                    "safety", "classification_only_pm_approval_required_before_execution");
        } catch (Exception error) {
            repository.markFailed(task.id(), error);
            return Map.of(
                    "batchStatus", "FAILED",
                    "task", repository.get(task.id()),
                    "error", sanitize(error),
                    "safety", "no_execution_performed");
        }
    }

    public RpaTaskRecord get(UUID id) {
        repository.ensureSchema();
        return repository.get(id);
    }

    public Map<String, Object> detail(UUID id) {
        RpaTaskRecord task = get(id);
        if (task == null) return null;
        return Map.of(
                "task", task,
                "decisions", repository.decisions(id),
                "safety", "decision_records_only_no_execution");
    }

    public Map<String, Object> decide(UUID id, RpaDecisionRequest request) {
        RpaDecisionRecord decision = repository.recordDecision(id, request);
        RpaTaskRecord task = repository.get(id);
        return Map.of(
                "task", task,
                "decision", decision,
                "safety", "pm_decision_recorded_no_execution");
    }

    public List<RpaTaskRecord> recent(int limit) {
        return repository.recent(limit);
    }

    private String sanitize(Throwable error) {
        if (error == null) return null;
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return message
                .replaceAll("sk-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("password=([^\\s&]+)", "password=[redacted]");
    }
}
