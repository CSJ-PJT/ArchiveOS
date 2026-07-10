package com.archiveos.ai.operations;

import com.archiveos.ai.atlas.AtlasService;
import com.archiveos.ai.ecosystem.EcosystemService;
import com.archiveos.ai.liveflow.LiveFlowService;
import com.archiveos.ai.managed.ManagedSystemsService;
import com.archiveos.ai.notification.NotificationResult;
import com.archiveos.ai.notification.NotificationService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
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
    private AtlasService atlasService;
    private ManagedSystemsService managedSystems;
    private EcosystemService ecosystemService;
    private LiveFlowService liveFlowService;

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

    @Autowired(required = false)
    void setAtlasService(AtlasService atlasService) {
        this.atlasService = atlasService;
    }

    @Autowired(required = false)
    void setManagedSystems(ManagedSystemsService managedSystems) {
        this.managedSystems = managedSystems;
    }

    @Autowired(required = false)
    void setEcosystemService(EcosystemService ecosystemService) {
        this.ecosystemService = ecosystemService;
    }

    @Autowired(required = false)
    void setLiveFlowService(LiveFlowService liveFlowService) {
        this.liveFlowService = liveFlowService;
    }

    public Map<String, Object> run(LocalDate today) {
        LocalDate localToday = today == null ? LocalDate.now(SEOUL) : today;
        LocalDate targetDate = localToday.minusDays(1);
        KoreanBusinessDayService.BusinessDayResult businessDay = businessDays.check(localToday);
        Map<String, Object> nightlySummary = loadNightly(targetDate);
        Map<String, Object> managedSummary = managedSystemsSummary();
        Map<String, Object> atlasSummary = atlasSummary();
        Map<String, Object> ecosystemSummary = ecosystemSummary();
        Map<String, Object> liveFlowSummary = liveFlowSummary();
        String reportText = message(targetDate, nightlySummary, businessDay.businessDay() ? null : businessDay.reason(), managedSummary, atlasSummary, ecosystemSummary, liveFlowSummary);
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
        metadata.put("managed_systems", managedSummary);
        metadata.put("atlas", atlasSummary);
        metadata.put("ecosystem", ecosystemSummary);
        metadata.put("live_flow", liveFlowSummary);
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

    private String message(LocalDate targetDate, Map<String, Object> summary, String skippedReason, Map<String, Object> managedSummary, Map<String, Object> atlasSummary, Map<String, Object> ecosystemSummary, Map<String, Object> liveFlowSummary) {
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
        appendManagedSystemsSummary(text, managedSummary);
        appendEcosystemSummary(text, ecosystemSummary);
        appendLiveFlowSummary(text, liveFlowSummary);
        appendLedgerSummary(text, managedSummary);
        text.append("\n\nAtlas Platform")
                .append("\n• Status: ").append(atlasSummary.getOrDefault("status", "unknown"))
                .append("\n• Services: ").append(atlasSummary.getOrDefault("normalServices", 0)).append("/")
                .append(atlasSummary.getOrDefault("totalServices", 0)).append(" normal")
                .append("\n• Last Healthcheck: ").append(atlasSummary.getOrDefault("lastHealthcheck", "no data"))
                .append("\n• Reason: ").append(atlasSummary.getOrDefault("reason", "Atlas summary unavailable"));
        if (publicUrl != null && !publicUrl.isBlank()) text.append("\n\nDashboard:\n").append(publicUrl);
        return text.toString();
    }

    private void appendEcosystemSummary(StringBuilder text, Map<String, Object> ecosystemSummary) {
        Map<String, Object> services = map(ecosystemSummary.get("services"));
        text.append("\n\nArchive Platform Ecosystem")
                .append("\n• Status: ").append(ecosystemSummary.getOrDefault("status", "unknown"));
        for (String key : List.of("market", "nexus", "logitics", "ledger")) {
            Map<String, Object> service = map(services.get(key));
            if (!service.isEmpty()) text.append("\n• ").append(service.getOrDefault("name", key)).append(": ")
                    .append(service.getOrDefault("status", "unknown"));
        }
    }

    private void appendLiveFlowSummary(StringBuilder text, Map<String, Object> liveFlowSummary) {
        text.append("\n\nLive Flow Summary")
                .append("\nâ€¢ Active flows: ").append(liveFlowSummary.getOrDefault("active_flows", 0))
                .append("\nâ€¢ Recent events: ").append(liveFlowSummary.getOrDefault("recent_events", 0))
                .append("\nâ€¢ Pending approvals: ").append(liveFlowSummary.getOrDefault("pending_approvals", 0))
                .append("\nâ€¢ Delayed shipments: ").append(liveFlowSummary.getOrDefault("delayed_shipments", 0))
                .append("\nâ€¢ Failed callbacks: ").append(liveFlowSummary.getOrDefault("failed_callbacks", 0))
                .append("\nâ€¢ Degraded systems: ").append(liveFlowSummary.getOrDefault("degraded_systems", 0))
                .append("\nâ€¢ Latest event: ").append(liveFlowSummary.getOrDefault("latest_event_at", "no data"));
    }

    private void appendManagedSystemsSummary(StringBuilder text, Map<String, Object> managedSummary) {
        @SuppressWarnings("unchecked") List<Map<String, Object>> systems = managedSummary.get("systems") instanceof List<?> list
                ? (List<Map<String, Object>>) (List<?>) list
                : List.of();
        Map<String, Object> summary = map(managedSummary.get("summary"));
        Map<String, Object> recommended = map(summary.get("recommendedPmAction"));
        text.append("\n\nManaged Systems Summary");
        if (systems.isEmpty()) {
            text.append("\n• unavailable");
        } else {
            systems.forEach(system -> text.append("\n• ")
                    .append(system.getOrDefault("name", system.get("systemId")))
                    .append(": ")
                    .append(system.getOrDefault("status", "unknown")));
        }
        text.append("\n\nPM Inbox")
                .append("\n• Critical: ").append(summary.getOrDefault("criticalInboxCount", 0))
                .append("\n• High: ").append(summary.getOrDefault("highInboxCount", 0))
                .append("\n• Info: ").append(summary.getOrDefault("infoInboxCount", 0));
        text.append("\n\nRecommended PM Action:\n")
                .append(recommended.getOrDefault("title", "No urgent action required."));
    }

    private void appendLedgerSummary(StringBuilder text, Map<String, Object> managedSummary) {
        @SuppressWarnings("unchecked") List<Map<String, Object>> systems = managedSummary.get("systems") instanceof List<?> list
                ? (List<Map<String, Object>>) (List<?>) list
                : List.of();
        Map<String, Object> ledger = systems.stream()
                .filter(system -> "archive-ledger".equals(system.get("systemId")))
                .findFirst()
                .orElse(Map.of());
        if (ledger.isEmpty()) return;
        text.append("\n\nArchive-Ledger Summary")
                .append("\n• Status: ").append(ledger.getOrDefault("status", "unknown"))
                .append("\n• Pending Approvals: ").append(ledger.getOrDefault("pendingApprovalCount", 0))
                .append("\n• Callback Failed: ").append(ledger.getOrDefault("openIncidentCount", 0))
                .append("\n• Latest Approval: ").append(ledger.getOrDefault("latestWorkflowId", "n/a"))
                .append("\n• RAG Evidence: fallback-safe");
    }

    private Map<String, Object> atlasSummary() {
        if (atlasService == null) return Map.of("available", false, "status", "unknown", "reason", "Atlas observability service is not available.");
        try {
            Map<String, Object> overview = atlasService.overview();
            Map<String, Object> system = map(overview.get("system"));
            @SuppressWarnings("unchecked") List<Map<String, Object>> services = overview.get("services") instanceof List<?> list
                    ? (List<Map<String, Object>>) (List<?>) list
                    : List.of();
            @SuppressWarnings("unchecked") List<Map<String, Object>> checks = overview.get("recent_healthchecks") instanceof List<?> list
                    ? (List<Map<String, Object>>) (List<?>) list
                    : List.of();
            long normal = services.stream().filter(service -> "normal".equals(String.valueOf(service.get("current_status")))).count();
            long degraded = services.stream().filter(service -> "degraded".equals(String.valueOf(service.get("current_status")))).count();
            long down = services.stream().filter(service -> String.valueOf(service.get("current_status")).contains("down")).count();
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("available", true);
            value.put("status", system.getOrDefault("current_status", "unknown"));
            value.put("reason", system.getOrDefault("reason", "No Atlas status reason recorded."));
            value.put("totalServices", services.size());
            value.put("normalServices", normal);
            value.put("degradedServices", degraded);
            value.put("downServices", down);
            value.put("lastHealthcheck", checks.isEmpty() ? "no data" : checks.get(0).getOrDefault("checked_at", "no data"));
            return value;
        } catch (Exception error) {
            return Map.of("available", false, "status", "unknown", "reason", "Atlas summary failed: " + error.getClass().getSimpleName());
        }
    }

    private Map<String, Object> managedSystemsSummary() {
        if (managedSystems == null) return Map.of("available", false, "summary", Map.of(), "systems", List.of());
        try {
            Map<String, Object> overview = managedSystems.overview();
            @SuppressWarnings("unchecked") List<Map<String, Object>> inbox = overview.get("pmInbox") instanceof List<?> list
                    ? (List<Map<String, Object>>) (List<?>) list
                    : List.of();
            @SuppressWarnings("unchecked") Map<String, Object> summary = overview.get("summary") instanceof Map<?, ?> map
                    ? (Map<String, Object>) map
                    : new LinkedHashMap<>();
            Map<String, Object> enrichedSummary = new LinkedHashMap<>(summary);
            enrichedSummary.put("criticalInboxCount", severityCount(inbox, "critical"));
            enrichedSummary.put("highInboxCount", severityCount(inbox, "high"));
            enrichedSummary.put("infoInboxCount", severityCount(inbox, "info"));
            Map<String, Object> value = new LinkedHashMap<>(overview);
            value.put("available", true);
            value.put("summary", enrichedSummary);
            return value;
        } catch (Exception error) {
            return Map.of("available", false, "summary", Map.of("recommendedPmAction", Map.of("title", "Managed Systems summary unavailable.")), "systems", List.of());
        }
    }

    private Map<String, Object> ecosystemSummary() {
        if (ecosystemService == null) return Map.of("available", false, "status", "unknown", "services", Map.of());
        try {
            Map<String, Object> summary = ecosystemService.summary();
            Map<String, Object> value = new LinkedHashMap<>(summary);
            value.put("available", true);
            return value;
        } catch (Exception error) {
            return Map.of("available", false, "status", "unknown", "services", Map.of(), "reason", "Ecosystem summary failed: " + error.getClass().getSimpleName());
        }
    }

    private Map<String, Object> liveFlowSummary() {
        if (liveFlowService == null) return Map.of("available", false, "active_flows", 0, "recent_events", 0,
                "pending_approvals", 0, "delayed_shipments", 0, "failed_callbacks", 0, "degraded_systems", 0);
        try {
            Map<String, Object> summary = liveFlowService.summary();
            Map<String, Object> value = new LinkedHashMap<>(summary);
            value.put("available", true);
            return value;
        } catch (Exception error) {
            return Map.of("available", false, "active_flows", 0, "recent_events", 0,
                    "pending_approvals", 0, "delayed_shipments", 0, "failed_callbacks", 0,
                    "degraded_systems", 0, "reason", "Live Flow summary failed: " + error.getClass().getSimpleName());
        }
    }

    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private int number(Map<String, Object> value, String key) { return value.get(key) instanceof Number number ? number.intValue() : 0; }
    private int count(Map<String, Object> summary, String key) { return number(map(summary.get(key)), "count"); }
    private long severityCount(List<Map<String, Object>> inbox, String severity) { return inbox.stream().filter(item -> severity.equals(item.get("severity"))).count(); }
}
