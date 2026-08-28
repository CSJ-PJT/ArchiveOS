package com.archiveos.ai.operations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.archiveos.ai.atlas.AtlasService;
import com.archiveos.ai.batch.ArchiveBatchConfiguration;
import com.archiveos.ai.batch.BatchJobService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.scheduling.annotation.Scheduled;

class OperationsSchedulerTest {
    private final BatchJobService batches = Mockito.mock(BatchJobService.class);
    private final AtlasService atlas = Mockito.mock(AtlasService.class);
    private final OperationsScheduler scheduler = new OperationsScheduler(batches, atlas);

    @Test void recordsNightlyAndDailyWorkThroughSpringBatch() {
        scheduler.nightlyReview();
        scheduler.dailyReport();
        scheduler.dailyKnowledgeSync();

        verify(batches).run(OperationsBatchConfiguration.NIGHTLY_REVIEW_JOB, "scheduler-nightly");
        verify(batches).run(OperationsBatchConfiguration.DAILY_REPORT_JOB, "scheduler-daily");
        verify(batches).run(ArchiveBatchConfiguration.OBSIDIAN_SYNC_JOB, "scheduler-daily-knowledge");
    }

    @Test void recordsCurrentMaintenanceJobsInExecutionHistory() {
        scheduler.runtimeMaintenance();

        verify(batches).run(ArchiveBatchConfiguration.RAG_HEALTH_CHECK_JOB, "scheduler-maintenance");
        verify(batches).run(ArchiveBatchConfiguration.PIPELINE_AUDIT_JOB, "scheduler-maintenance");
        verify(batches).run(ArchiveBatchConfiguration.KNOWLEDGE_MAINTENANCE_JOB, "scheduler-maintenance");
    }

    @Test void refreshesAtlasReadOnlyHealthContracts() {
        scheduler.atlasHealthchecks();

        verify(atlas).runHealthchecks();
    }

    @Test void schedulesMaintenanceAndAtlasOncePerDay() throws Exception {
        Scheduled maintenance = OperationsScheduler.class.getDeclaredMethod("runtimeMaintenance").getAnnotation(Scheduled.class);
        Scheduled atlasHealth = OperationsScheduler.class.getDeclaredMethod("atlasHealthchecks").getAnnotation(Scheduled.class);

        assertThat(maintenance.cron()).isEqualTo("${archiveos.scheduler.maintenance-cron:0 30 9 * * *}");
        assertThat(atlasHealth.cron()).isEqualTo("${archiveos.scheduler.atlas-cron:0 45 9 * * *}");
        assertThat(maintenance.fixedDelayString()).isEmpty();
        assertThat(atlasHealth.fixedDelayString()).isEmpty();
        assertThat(maintenance.zone()).isEqualTo("Asia/Seoul");
        assertThat(atlasHealth.zone()).isEqualTo("Asia/Seoul");
    }
}
