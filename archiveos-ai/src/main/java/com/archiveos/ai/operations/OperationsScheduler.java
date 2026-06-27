package com.archiveos.ai.operations;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "archiveos.scheduler.enabled", havingValue = "true")
public class OperationsScheduler {
    private final NightlyReviewService nightly;
    private final DailyReportService daily;

    public OperationsScheduler(NightlyReviewService nightly, DailyReportService daily) { this.nightly = nightly; this.daily = daily; }

    @Scheduled(cron = "${archiveos.scheduler.nightly-cron:0 50 23 * * *}", zone = "Asia/Seoul")
    public void nightlyReview() { nightly.run(null); }

    @Scheduled(cron = "${archiveos.scheduler.daily-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void dailyReport() { daily.run(null); }
}
