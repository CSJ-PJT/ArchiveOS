package com.archiveos.ai.operations;

import static org.mockito.Mockito.verify;

import com.archiveos.ai.atlas.AtlasService;
import com.archiveos.ai.batch.ArchiveBatchConfiguration;
import com.archiveos.ai.batch.BatchJobService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

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
}
