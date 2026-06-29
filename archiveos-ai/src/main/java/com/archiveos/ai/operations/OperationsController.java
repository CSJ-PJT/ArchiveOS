package com.archiveos.ai.operations;

import com.archiveos.ai.notification.NotificationService;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OperationsController {
    private final NightlyReviewService nightly;
    private final DailyReportService daily;
    private final OperationsRepository repository;
    private final NotificationService notifications;
    private final String publicUrl;

    public OperationsController(NightlyReviewService nightly, DailyReportService daily, OperationsRepository repository,
                                NotificationService notifications, @Value("${archiveos.public-url:}") String publicUrl) {
        this.nightly = nightly; this.daily = daily; this.repository = repository; this.notifications = notifications; this.publicUrl = publicUrl;
    }

    @PostMapping("/api/batches/nightly-review/run")
    public ResponseEntity<Map<String, Object>> runNightly(@RequestParam(required = false) LocalDate targetDate) { return ok(nightly.run(targetDate)); }

    @PostMapping("/api/batches/daily-report/run")
    public ResponseEntity<Map<String, Object>> runDaily(@RequestParam(required = false) LocalDate today) { return ok(daily.run(today)); }

    @GetMapping("/api/batches/recent")
    public ResponseEntity<Map<String, Object>> recentBatches(@RequestParam(defaultValue = "20") int limit) { return ok(repository.recentBatches(limit)); }

    @GetMapping("/api/batches/latest")
    public ResponseEntity<Map<String, Object>> latestBatches() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("nightly_review", repository.latestBatch("nightly_review", null));
        data.put("daily_report", repository.latestBatch("daily_report", null));
        data.put("discord_webhook_configured", false);
        data.put("slack_webhook_configured", notifications.configured("slack"));
        data.put("notification_channel", "slack");
        data.put("archiveos_public_url_configured", publicUrl != null && !publicUrl.isBlank());
        data.put("holiday_years", List.of(2026));
        return ok(data);
    }

    @GetMapping("/api/reports/daily/latest")
    public ResponseEntity<Map<String, Object>> latestDaily() { return ok(repository.latestDailyReport()); }

    @GetMapping("/api/reports/daily/recent")
    public ResponseEntity<Map<String, Object>> recentDaily(@RequestParam(defaultValue = "20") int limit) { return ok(repository.recentDailyReports(limit)); }

    @GetMapping("/api/runtime/snapshots/recent")
    public ResponseEntity<Map<String, Object>> recentSnapshots(@RequestParam(defaultValue = "20") int limit) { return ok(repository.recentSnapshots(limit)); }

    private ResponseEntity<Map<String, Object>> ok(Object data) {
        Map<String, Object> envelope = new LinkedHashMap<>(); envelope.put("data", data); return ResponseEntity.ok(envelope);
    }
}
