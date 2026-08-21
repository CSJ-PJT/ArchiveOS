package com.archiveos.ai.approval;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "archiveos.approval.auto-approve-all-enabled", havingValue = "true")
public class ExternalApprovalScheduler {
    private static final Logger log = LoggerFactory.getLogger(ExternalApprovalScheduler.class);
    private final ExternalApprovalService approvals;
    private final int batchSize;

    public ExternalApprovalScheduler(ExternalApprovalService approvals,
                                     @Value("${archiveos.approval.auto-approval-batch-size:200}") int batchSize) {
        this.approvals = approvals;
        this.batchSize = Math.max(1, Math.min(batchSize, 500));
    }

    @Scheduled(
            initialDelayString = "${archiveos.approval.auto-approval-initial-delay-ms:60000}",
            fixedDelayString = "${archiveos.approval.auto-approval-delay-ms:60000}")
    public void approvePending() {
        try {
            var result = approvals.approveAll(batchSize, null, "archiveos-approval-agent");
            if (((Number) result.getOrDefault("approved", 0)).intValue() > 0) {
                log.info("ArchiveOS approval agent approved {} requests; {} remain", result.get("approved"), result.get("remaining"));
            }
        } catch (RuntimeException error) {
            log.warn("ArchiveOS approval agent failed: {}", error.getMessage());
        }
    }
}
