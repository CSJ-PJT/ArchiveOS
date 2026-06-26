package com.archiveos.ai.rpa;

import java.util.UUID;
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
public class RpaBatchConfiguration {
    public static final String JOB_NAME = "archiveosRpaClassifyJob";

    @Bean
    public Job archiveosRpaClassifyJob(JobRepository jobRepository, Step archiveosRpaClassifyStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
                .start(archiveosRpaClassifyStep)
                .build();
    }

    @Bean
    public Step archiveosRpaClassifyStep(
            JobRepository jobRepository,
            PlatformTransactionManager transactionManager,
            RpaJdbcRepository repository,
            RpaClassificationService classifier) {
        return new StepBuilder("classifyRpaTask", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    String taskId = String.valueOf(chunkContext.getStepContext().getJobParameters().get("rpaTaskId"));
                    UUID id = UUID.fromString(taskId);
                    repository.markRunning(id);
                    RpaTaskRecord task = repository.get(id);
                    if (task == null) {
                        throw new IllegalStateException("RPA task not found: " + id);
                    }
                    RpaClassification classification = classifier.classify(task);
                    repository.saveClassification(id, classification);
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }
}
