package com.archiveos.ai.batch;

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
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class ArchiveBatchConfiguration {
    public static final String OBSIDIAN_SYNC_JOB = "obsidianSyncJob";
    public static final String RAG_HEALTH_CHECK_JOB = "ragHealthCheckJob";

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
}
