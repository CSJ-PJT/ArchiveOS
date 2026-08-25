package com.archiveos.ai.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AccessLogRetentionScheduler {
    private final AccessLogService access;
    private final int retentionDays;

    public AccessLogRetentionScheduler(AccessLogService access,
                                       @Value("${archiveos.security.access-log-retention-days:30}") int retentionDays) {
        this.access = access;
        this.retentionDays = Math.max(1, Math.min(retentionDays, 365));
    }

    @Scheduled(cron = "${archiveos.security.access-log-cleanup-cron:0 20 3 * * *}")
    public void purgeExpired() {
        access.purgeOlderThan(retentionDays);
    }
}
