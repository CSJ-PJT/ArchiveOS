package com.archiveos.ai.batch;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.obsidian.ObsidianRagService;
import com.archiveos.ai.obsidian.ObsidianSyncResult;
import com.archiveos.ai.runtime.AiRuntimeService;
import java.util.Map;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class ArchiveBatchConfiguration {
    public static final String OBSIDIAN_SYNC_JOB = "obsidianSyncJob";
    public static final String RAG_HEALTH_CHECK_JOB = "ragHealthCheckJob";
    public static final String PIPELINE_AUDIT_JOB = "pipelineAuditJob";
    public static final String KNOWLEDGE_MAINTENANCE_JOB = "knowledgeMaintenanceJob";

    @Bean
    public Job obsidianSyncJob(JobRepository jobRepository, Step obsidianSyncStep) {
        return new JobBuilder(OBSIDIAN_SYNC_JOB, jobRepository)
                .start(obsidianSyncStep)
                .build();
    }

    @Bean
    public Step obsidianSyncStep(
            JobRepository jobRepository,
            PlatformTransactionManager transactionManager,
            ObsidianRagService ragService) {
        return new StepBuilder("syncObsidianVault", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    try {
                        ObsidianSyncResult result = ragService.syncVault();
                        contribution.getStepExecution().getExecutionContext().putString("summary", String.format(
                                "enabled=%s scanned=%d created=%d updated=%d skipped=%d embeddedChunks=%d",
                                result.enabled(),
                                result.scanned(),
                                result.created(),
                                result.updated(),
                                result.skipped(),
                                result.embeddedChunks()));
                        contribution.getStepExecution().getExecutionContext().putInt("scanned", result.scanned());
                        contribution.getStepExecution().getExecutionContext().putInt("embeddedChunks", result.embeddedChunks());
                        return RepeatStatus.FINISHED;
                    } catch (Exception error) {
                        throw new IllegalStateException("Obsidian sync batch failed: " + error.getMessage(), error);
                    }
                }, transactionManager)
                .build();
    }

    @Bean
    public Job ragHealthCheckJob(JobRepository jobRepository, Step ragHealthCheckStep) {
        return new JobBuilder(RAG_HEALTH_CHECK_JOB, jobRepository)
                .start(ragHealthCheckStep)
                .build();
    }

    @Bean
    public Step ragHealthCheckStep(
            JobRepository jobRepository,
            PlatformTransactionManager transactionManager,
            AiRuntimeService runtimeService) {
        return new StepBuilder("checkRagRuntime", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    Map<String, Object> runtime = runtimeService.runtime();
                    contribution.getStepExecution().getExecutionContext().putString("summary", "runtimeStatus=" + runtime.get("status"));
                    contribution.getStepExecution().getExecutionContext().putString("status", String.valueOf(runtime.get("status")));
                    Object rag = runtime.get("rag");
                    if (rag instanceof Map<?, ?> ragMap) {
                        contribution.getStepExecution().getExecutionContext().putString("ragReady", String.valueOf(ragMap.get("ready")));
                    }
                    Object vectorStore = runtime.get("vectorStore");
                    if (vectorStore instanceof Map<?, ?> vectorMap) {
                        contribution.getStepExecution().getExecutionContext().putString("databaseConnected", String.valueOf(vectorMap.get("databaseConnected")));
                        contribution.getStepExecution().getExecutionContext().putString("indexReady", String.valueOf(vectorMap.get("indexReady")));
                    }
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    public Job pipelineAuditJob(JobRepository jobRepository, Step pipelineAuditStep) {
        return new JobBuilder(PIPELINE_AUDIT_JOB, jobRepository).start(pipelineAuditStep).build();
    }

    @Bean
    public Step pipelineAuditStep(JobRepository jobRepository, PlatformTransactionManager transactionManager,
                                  AuditLogService auditLogService) {
        return new StepBuilder("auditRuntimePipeline", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    Map<String, Object> summary = auditLogService.summary();
                    contribution.getStepExecution().getExecutionContext().putString("summary", String.valueOf(summary));
                    contribution.getStepExecution().getExecutionContext().putInt("auditTotal", ((Number) summary.get("total")).intValue());
                    contribution.getStepExecution().getExecutionContext().putInt("failedRequests", ((Number) summary.get("failed")).intValue());
                    return RepeatStatus.FINISHED;
                }, transactionManager).build();
    }

    @Bean
    public Job knowledgeMaintenanceJob(JobRepository jobRepository, Step knowledgeMaintenanceStep) {
        return new JobBuilder(KNOWLEDGE_MAINTENANCE_JOB, jobRepository).start(knowledgeMaintenanceStep).build();
    }

    @Bean
    public Step knowledgeMaintenanceStep(JobRepository jobRepository, PlatformTransactionManager transactionManager,
                                         JdbcTemplate jdbc) {
        return new StepBuilder("inspectKnowledgeStorage", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    Integer documents = jdbc.queryForObject("select count(*) from public.obsidian_documents", Integer.class);
                    Integer chunks = jdbc.queryForObject("select count(*) from public.obsidian_chunks", Integer.class);
                    Integer embeddings = jdbc.queryForObject("select count(*) from public.obsidian_chunks where embedding is not null", Integer.class);
                    Integer nodes = jdbc.queryForObject("select count(*) from public.knowledge_nodes", Integer.class);
                    var context = contribution.getStepExecution().getExecutionContext();
                    context.putInt("documents", documents == null ? 0 : documents);
                    context.putInt("chunks", chunks == null ? 0 : chunks);
                    context.putInt("embeddings", embeddings == null ? 0 : embeddings);
                    context.putInt("nodes", nodes == null ? 0 : nodes);
                    context.putString("summary", "documents=" + documents + " chunks=" + chunks + " embeddings=" + embeddings + " nodes=" + nodes);
                    return RepeatStatus.FINISHED;
                }, transactionManager).build();
    }
}
