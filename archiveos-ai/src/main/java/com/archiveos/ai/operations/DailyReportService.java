package com.archiveos.ai.operations;

import com.archiveos.ai.notification.NotificationResult;
import com.archiveos.ai.notification.NotificationService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DailyReportService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final OperationsRepository repository;
    private final NightlyReviewService nightly;
    private final KoreanBusinessDayService businessDays;
    private final NotificationService notifications;
    private final String publicUrl;

    public DailyReportService(
            OperationsRepository repository,
            NightlyReviewService nightly,
            KoreanBusinessDayService businessDays,
            NotificationService notifications,
            @Value("${archiveos.public-url:}") String publicUrl) {
        this.repository = repository;
        this.nightly = nightly;
        this.businessDays = businessDays;
        this.notifications = notifications;
        this.publicUrl = publicUrl;
    }

    public Map<String, Object> run(LocalDate today) {
        LocalDate localToday = today == null ? LocalDate.now(SEOUL) : today;
        LocalDate targetDate = localToday.minusDays(1);
        KoreanBusinessDayService.BusinessDayResult businessDay = businessDays.check(localToday);
        Map<String, Object> nightlySummary = loadNightly(targetDate);
        String reportText = message(targetDate, nightlySummary, businessDay.businessDay() ? null : businessDay.reason());
        List<NotificationResult> results = businessDay.businessDay() ? notifications.send(reportText) : List.of();
        boolean anyConfigured = results.stream().anyMatch(NotificationResult::configured);
        boolean anySent = results.stream().anyMatch(NotificationResult::sent);
        NotificationResult slack = results.stream().filter(item -> "slack".equals(item.channel())).findFirst().orElse(NotificationResult.notConfigured("slack"));
        String batchStatus = !businessDay.businessDay() || !anyConfigured ? "skipped" : anySent ? "sent" : "failed";
        String skippedReason = !businessDay.businessDay() ? businessDay.reason() : !anyConfigured ? "No notification webhook configured" : anySent ? null : results.stream().map(NotificationResult::reason).filter(value -> value != null).findFirst().orElse("notification delivery failed");

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("target_date", targetDate.toString()); report.put("status", nightlySummary.get("operationStatus")); report.put("status_reason", nightlySummary.get("statusReason"));
        report.put("runtime_summary", nightlySummary.get("queue")); report.put("latest_builder", nightlySummary.get("latestBuilder")); report.put("latest_reviewer", nightlySummary.get("latestReviewer"));
        report.put("operator_summary", nightlySummary.get("operators")); report.put("warnings", nightlySummary.get("warnings"));
        report.put("decisions_count", count(nightlySummary, "decisions")); report.put("commands_count", count(nightlySummary, "commands"));
        report.put("slack_sent", slack.sent()); report.put("slack_skipped_reason", slack.sent() ? null : skippedReason); report.put("notification_results", results); report.put("report_text", reportText);
        Map<String, Object> dailyRow = repository.saveDailyReport(report);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("today", localToday.toString()); metadata.put("business_day", businessDay.businessDay()); metadata.put("reason", skippedReason);
        metadata.put("nightly", nightlySummary); metadata.put("notification_results", results); metadata.put("daily_report_id", dailyRow.get("id"));
        metadata.put("archiveos_public_url_configured", publicUrl != null && !publicUrl.isBlank());
        String summary = switch (batchStatus) {
            case "sent" -> "일일 운영 보고 전송 완료: " + targetDate;
            case "failed" -> "일일 운영 보고 전송 실패: " + skippedReason;
            default -> "일일 운영 보고 생략: " + skippedReason;
        };
        return repository.saveBatch("daily_report", batchStatus, targetDate, summary, metadata);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> loadNightly(LocalDate targetDate) {
        Map<String, Object> latest = repository.latestBatch("nightly_review", targetDate);
        if (latest != null && latest.get("metadata") instanceof Map<?, ?> metadata) return (Map<String, Object>) metadata;
        return nightly.buildSummary(targetDate);
    }

    private String message(LocalDate targetDate, Map<String, Object> summary, String skippedReason) {
        Map<String, Object> queue = map(summary.get("queue")); Map<String, Object> operators = map(summary.get("operators"));
        @SuppressWarnings("unchecked") List<String> warnings = summary.get("warnings") instanceof List<?> list ? (List<String>) list : List.of();
        String status = switch (String.valueOf(summary.get("operationStatus"))) { case "problem" -> "🔴 문제"; case "warning" -> "🟡 주의"; default -> "🟢 정상"; };
        StringBuilder text = new StringBuilder("📊 ArchiveOS 일일 운영 보고\n대상일: ").append(targetDate)
                .append("\n\n상태: ").append(status).append("\n사유: ").append(summary.get("statusReason"));
        if (skippedReason != null) text.append(" / 알림 생략: ").append(skippedReason);
        text.append("\n\nRuntime\n• Inbox: ").append(number(queue, "inbox")).append("\n• Processing: ").append(number(queue, "processing"))
                .append("\n• Outbox: ").append(number(queue, "outbox")).append("\n• Reviews: ").append(number(queue, "reviews"));
        text.append("\n\n작업자\n• Implementer: ").append(operators.getOrDefault("implementer", "미감지"))
                .append("\n• Reviewer: ").append(operators.getOrDefault("reviewer", "미감지"))
                .append("\n• Loop: ").append(operators.getOrDefault("loop", "미감지"))
                .append("\n• Reviewer Bridge: ").append(operators.getOrDefault("reviewerBridge", "미감지"));
        text.append("\n\n경고\n").append(warnings.isEmpty() ? "• 감지된 경고 없음" : warnings.stream().map(item -> "• " + item).reduce((a,b) -> a + "\n" + b).orElse(""));
        text.append("\n\nDecisions / Commands\n• Decisions: ").append(count(summary, "decisions")).append("\n• Commands: ").append(count(summary, "commands"));
        if (publicUrl != null && !publicUrl.isBlank()) text.append("\n\nDashboard:\n").append(publicUrl);
        return text.toString();
    }

    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private int number(Map<String, Object> value, String key) { return value.get(key) instanceof Number number ? number.intValue() : 0; }
    private int count(Map<String, Object> summary, String key) { return number(map(summary.get(key)), "count"); }
}
