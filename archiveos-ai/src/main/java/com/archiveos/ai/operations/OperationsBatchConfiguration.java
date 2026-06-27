package com.archiveos.ai.operations;

import java.time.LocalDate;
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
public class OperationsBatchConfiguration {
    public static final String NIGHTLY_REVIEW_JOB = "nightlyReviewJob";
    public static final String DAILY_REPORT_JOB = "dailyReportJob";

    @Bean Job nightlyReviewJob(JobRepository repository, Step nightlyReviewStep) {
        return new JobBuilder(NIGHTLY_REVIEW_JOB, repository).start(nightlyReviewStep).build();
    }

    @Bean Step nightlyReviewStep(JobRepository repository, PlatformTransactionManager tx, NightlyReviewService service) {
        return new StepBuilder("generateNightlyReview", repository).tasklet((contribution, context) -> {
            String target = context.getStepContext().getJobParameters().get("targetDate") instanceof String value ? value : null;
            var result = service.run(target == null || target.isBlank() ? null : LocalDate.parse(target));
            contribution.getStepExecution().getExecutionContext().putString("batchRunId", String.valueOf(result.get("id")));
            contribution.getStepExecution().getExecutionContext().putString("summary", String.valueOf(result.get("summary")));
            return RepeatStatus.FINISHED;
        }, tx).build();
    }

    @Bean Job dailyReportJob(JobRepository repository, Step dailyReportStep) {
        return new JobBuilder(DAILY_REPORT_JOB, repository).start(dailyReportStep).build();
    }

    @Bean Step dailyReportStep(JobRepository repository, PlatformTransactionManager tx, DailyReportService service) {
        return new StepBuilder("generateDailyReport", repository).tasklet((contribution, context) -> {
            String today = context.getStepContext().getJobParameters().get("today") instanceof String value ? value : null;
            var result = service.run(today == null || today.isBlank() ? null : LocalDate.parse(today));
            contribution.getStepExecution().getExecutionContext().putString("batchRunId", String.valueOf(result.get("id")));
            contribution.getStepExecution().getExecutionContext().putString("summary", String.valueOf(result.get("summary")));
            return RepeatStatus.FINISHED;
        }, tx).build();
    }
}
