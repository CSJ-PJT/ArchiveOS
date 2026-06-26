package com.archiveos.ai.batch;

import com.archiveos.ai.rpa.RpaBatchConfiguration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobInstance;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobExecutionAlreadyRunningException;
import org.springframework.batch.core.repository.JobInstanceAlreadyCompleteException;
import org.springframework.batch.core.repository.JobRestartException;
import org.springframework.stereotype.Service;

@Service
public class BatchJobService {
    private static final Set<String> MANUAL_JOB_DENYLIST = Set.of(RpaBatchConfiguration.JOB_NAME);

    private final Map<String, Job> jobs;
    private final JobLauncher jobLauncher;
    private final JobExplorer jobExplorer;

    public BatchJobService(Map<String, Job> jobs, JobLauncher jobLauncher, JobExplorer jobExplorer) {
        this.jobs = jobs;
        this.jobLauncher = jobLauncher;
        this.jobExplorer = jobExplorer;
    }

    public List<Map<String, Object>> jobs() {
        return jobs.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    String jobName = entry.getKey();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", jobName);
                    row.put("launchable", !MANUAL_JOB_DENYLIST.contains(jobName));
                    row.put("manualRunAllowed", !MANUAL_JOB_DENYLIST.contains(jobName));
                    row.put("description", description(jobName));
                    row.put("recentExecutions", recentExecutions(jobName, 3));
                    return row;
                })
                .toList();
    }

    public Map<String, Object> run(String jobName) {
        if (MANUAL_JOB_DENYLIST.contains(jobName)) {
            throw new IllegalArgumentException(jobName + " requires dedicated task parameters and cannot be launched from the generic batch endpoint.");
        }
        Job job = jobs.get(jobName);
        if (job == null) {
            throw new IllegalArgumentException("Unknown batch job: " + jobName);
        }
        JobParameters parameters = new JobParametersBuilder()
                .addLong("requestedAt", System.currentTimeMillis())
                .addString("triggeredBy", "archiveos-api")
                .toJobParameters();
        try {
            JobExecution execution = jobLauncher.run(job, parameters);
            return executionSummary(execution);
        } catch (JobExecutionAlreadyRunningException
                 | JobRestartException
                 | JobInstanceAlreadyCompleteException
                 | org.springframework.batch.core.JobParametersInvalidException error) {
            throw new IllegalStateException("Batch job launch failed: " + error.getMessage(), error);
        }
    }

    public List<Map<String, Object>> executions(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> all = new ArrayList<>();
        for (String jobName : jobs.keySet()) {
            all.addAll(recentExecutions(jobName, safeLimit));
        }
        return all.stream()
                .sorted(Comparator.comparing(row -> String.valueOf(row.get("createTime")), Comparator.reverseOrder()))
                .limit(safeLimit)
                .toList();
    }

    public Map<String, Object> execution(long executionId) {
        JobExecution execution = jobExplorer.getJobExecution(executionId);
        if (execution == null) return null;
        Map<String, Object> summary = executionSummary(execution);
        summary.put("steps", execution.getStepExecutions().stream()
                .sorted(Comparator.comparing(StepExecution::getStepName))
                .map(this::stepSummary)
                .toList());
        return summary;
    }

    private List<Map<String, Object>> recentExecutions(String jobName, int limit) {
        List<Map<String, Object>> rows = new ArrayList<>();
        int pageSize = Math.max(1, Math.min(limit, 25));
        List<JobInstance> instances = jobExplorer.getJobInstances(jobName, 0, pageSize);
        for (JobInstance instance : instances) {
            for (JobExecution execution : jobExplorer.getJobExecutions(instance)) {
                rows.add(executionSummary(execution));
            }
        }
        return rows.stream()
                .sorted(Comparator.comparing(row -> String.valueOf(row.get("createTime")), Comparator.reverseOrder()))
                .limit(limit)
                .toList();
    }

    private Map<String, Object> executionSummary(JobExecution execution) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", execution.getId());
        row.put("jobName", execution.getJobInstance() == null ? null : execution.getJobInstance().getJobName());
        row.put("status", execution.getStatus().name());
        row.put("exitCode", execution.getExitStatus().getExitCode());
        row.put("exitDescription", safeExitDescription(execution));
        row.put("createTime", format(execution.getCreateTime()));
        row.put("startTime", format(execution.getStartTime()));
        row.put("endTime", format(execution.getEndTime()));
        row.put("running", execution.getStatus() == BatchStatus.STARTED || execution.getStatus() == BatchStatus.STARTING);
        row.put("parameters", execution.getJobParameters().getParameters());
        row.put("executionContext", execution.getExecutionContext());
        return row;
    }

    private Map<String, Object> stepSummary(StepExecution step) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("stepName", step.getStepName());
        row.put("status", step.getStatus().name());
        row.put("exitCode", step.getExitStatus().getExitCode());
        row.put("readCount", step.getReadCount());
        row.put("writeCount", step.getWriteCount());
        row.put("commitCount", step.getCommitCount());
        row.put("rollbackCount", step.getRollbackCount());
        row.put("startTime", format(step.getStartTime()));
        row.put("endTime", format(step.getEndTime()));
        row.put("executionContext", step.getExecutionContext());
        return row;
    }

    private String safeExitDescription(JobExecution execution) {
        String description = execution.getExitStatus().getExitDescription();
        if (description == null) return "";
        return description
                .replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("sk-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("password=([^\\s&]+)", "password=[redacted]");
    }

    private String format(LocalDateTime time) {
        return time == null ? null : time.toString();
    }

    private String description(String jobName) {
        return switch (jobName) {
            case ArchiveBatchConfiguration.OBSIDIAN_SYNC_JOB -> "Obsidian Markdown 문서를 chunking, embedding, pgvector 저장까지 동기화한다.";
            case ArchiveBatchConfiguration.RAG_HEALTH_CHECK_JOB -> "유료 모델 호출 없이 Spring AI, pgvector, RAG 준비 상태를 관측한다.";
            case RpaBatchConfiguration.JOB_NAME -> "PM 작업 설명을 rule-based RPA 분류와 승인 게이트로 전환한다.";
            default -> "ArchiveOS Spring Batch job.";
        };
    }
}
