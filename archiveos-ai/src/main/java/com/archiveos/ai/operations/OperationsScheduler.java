package com.archiveos.ai.operations;

import com.archiveos.ai.atlas.AtlasService;
import com.archiveos.ai.audit.AdminAccessBatchConfiguration;
import com.archiveos.ai.batch.ArchiveBatchConfiguration;
import com.archiveos.ai.batch.BatchJobService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "archiveos.scheduler.enabled", havingValue = "true")
public class OperationsScheduler {
    private static final Logger log = LoggerFactory.getLogger(OperationsScheduler.class);
    private final BatchJobService batches;
    private final AtlasService atlas;

    public OperationsScheduler(BatchJobService batches, AtlasService atlas) { this.batches = batches; this.atlas = atlas; }

    @Scheduled(cron = "${archiveos.scheduler.nightly-cron:0 50 23 * * *}", zone = "Asia/Seoul")
    public void nightlyReview() { run(OperationsBatchConfiguration.NIGHTLY_REVIEW_JOB, "scheduler-nightly"); }

    @Scheduled(cron = "${archiveos.scheduler.admin-access-cron:0 59 23 * * *}", zone = "Asia/Seoul")
    public void archiveAdminAccess() { run(AdminAccessBatchConfiguration.JOB_NAME, "scheduler-admin-access"); }

    @Scheduled(cron = "${archiveos.scheduler.daily-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void dailyReport() { run(OperationsBatchConfiguration.DAILY_REPORT_JOB, "scheduler-daily"); }

    @Scheduled(cron = "${archiveos.scheduler.knowledge-sync-cron:0 15 9 * * *}", zone = "Asia/Seoul")
    public void dailyKnowledgeSync() { run(ArchiveBatchConfiguration.OBSIDIAN_SYNC_JOB, "scheduler-daily-knowledge"); }

    @Scheduled(cron = "${archiveos.scheduler.maintenance-cron:0 30 9 * * *}", zone = "Asia/Seoul")
    public void runtimeMaintenance() {
        run(ArchiveBatchConfiguration.RAG_HEALTH_CHECK_JOB, "scheduler-maintenance");
        run(ArchiveBatchConfiguration.PIPELINE_AUDIT_JOB, "scheduler-maintenance");
        run(ArchiveBatchConfiguration.KNOWLEDGE_MAINTENANCE_JOB, "scheduler-maintenance");
    }

    @Scheduled(cron = "${archiveos.scheduler.atlas-cron:0 45 9 * * *}", zone = "Asia/Seoul")
    public void atlasHealthchecks() {
        try {
            atlas.runHealthchecks();
        } catch (RuntimeException error) {
            log.warn("Scheduled Atlas healthcheck failed: {}", error.getMessage());
        }
    }

    private void run(String jobName, String trigger) {
        try {
            batches.run(jobName, trigger);
        } catch (RuntimeException error) {
            log.warn("Scheduled batch {} failed: {}", jobName, error.getMessage());
        }
    }
}
