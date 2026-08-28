package com.archiveos.ai.audit;

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
public class AdminAccessBatchConfiguration {
    public static final String JOB_NAME = "adminAccessArchiveJob";

    @Bean Job adminAccessArchiveJob(JobRepository repository, Step adminAccessArchiveStep) {
        return new JobBuilder(JOB_NAME, repository).start(adminAccessArchiveStep).build();
    }

    @Bean Step adminAccessArchiveStep(JobRepository repository, PlatformTransactionManager tx,
                                      AdminAccessAuditService service) {
        return new StepBuilder("archiveAdminAccess", repository).tasklet((contribution, context) -> {
            int archived = service.archiveUsageEvents();
            contribution.getStepExecution().getExecutionContext().putInt("archivedAdminAccessEvents", archived);
            return RepeatStatus.FINISHED;
        }, tx).build();
    }
}
