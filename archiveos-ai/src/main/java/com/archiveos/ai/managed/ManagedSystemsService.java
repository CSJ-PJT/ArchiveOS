package com.archiveos.ai.managed;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManagedSystemsService {
    private static final List<String> SEVERITY_ORDER = List.of("critical", "high", "medium", "low", "info");
    private final ManagedSystemsRepository repository;
    private final ExternalApprovalRepository approvals;
    @Value("${archiveos.ledger.base-url:}")
    private String ledgerBaseUrl;
    @Value("${archiveos.ledger.callback-token:}")
    private String ledgerCallbackToken;
    @Value("${archiveos.ledger.enabled:false}")
    private boolean ledgerEnabled;

    public ManagedSystemsService(ManagedSystemsRepository repository, ExternalApprovalRepository approvals) {
        this.repository = repository;
        this.approvals = approvals;
    }

    public Map<String, Object> overview() {
        List<Map<String, Object>> systems = systems();
        List<Map<String, Object>> inbox = pmInbox();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("managedSystemsCount", systems.size());
        summary.put("normalCount", countSystems(systems, "normal"));
        summary.put("degradedCount", countSystems(systems, "degraded"));
        summary.put("downCandidateCount", countSystems(systems, "down_candidate"));
        summary.put("notConnectedCount", countSystems(systems, "not_connected"));
        summary.put("pendingApprovals", systems.stream().mapToInt(system -> integer(system.get("pendingApprovalCount"))).sum());
        summary.put("openPmInboxItems", inbox.stream().filter(item -> "open".equals(item.get("status"))).count());
        summary.put("criticalInboxCount", severityCount(inbox, "critical"));
        summary.put("highInboxCount", severityCount(inbox, "high"));
        summary.put("mediumInboxCount", severityCount(inbox, "medium"));
        summary.put("lowInboxCount", severityCount(inbox, "low"));
        summary.put("infoInboxCount", severityCount(inbox, "info"));
        summary.put("latestCriticalItem", inbox.stream().filter(item -> List.of("critical", "high").contains(item.get("severity"))).findFirst().orElse(null));
        summary.put("recommendedPmAction", recommendedAction(inbox));
        summary.put("generatedAt", Instant.now().toString());
        return Map.of("summary", summary, "systems", systems, "pmInbox", inbox);
    }

    public List<Map<String, Object>> systems() {
        List<Map<String, Object>> tasks = repository.pmTasks();
        Map<String, Object> queue = repository.queueSummary();
        return List.of(archiveOsSystem(queue), archiveMarketSystem(), archiveNexusSystem(tasks), archiveLogiticsSystem(), atlasSystem(), archiveLedgerSystem(), deepStakePlaceholder());
    }

    public Map<String, Object> system(String systemId) {
        return systems().stream().filter(system -> systemId.equals(system.get("systemId"))).findFirst()
                .orElseThrow(() -> new ManagedSystemsValidationException("Managed system not found."));
    }

    public List<Map<String, Object>> systemEvents(String systemId) {
        return repository.recentAuditLogs(100).stream()
                .filter(event -> systemId.equals(systemIdForEvent(event)))
                .limit(30)
                .toList();
    }

    public List<Map<String, Object>> systemWorkflows(String systemId) {
        return repository.pmTasks().stream()
                .filter(task -> systemId.equals(systemIdForTask(task)))
                .limit(50)
                .toList();
    }

    public List<Map<String, Object>> systemWorkLogs(String systemId) {
        if ("atlas-platform".equals(systemId)) return repository.atlasWorkLogs(50);
        return List.of();
    }

    public List<Map<String, Object>> pmInbox() {
        List<Map<String, Object>> items = new ArrayList<>();
        items.addAll(nexusApprovalItems());
        addIfNotNull(items, atlasStatusItem());
        addIfNotNull(items, atlasRecoveryItem());
        addIfNotNull(items, dailyReportItem());
        items.addAll(ledgerApprovalItems());
        items.addAll(ledgerCallbackFailedItems());
        items.addAll(workLogFailureItems());
        addIfNotNull(items, securityBlockedItem("public_cud_blocked", "medium", "Public CUD blocked repeatedly",
                "Public session attempted protected write operations more than once.", "Review public access and confirm this is expected."));
        addIfNotNull(items, securityBlockedItem("admin_unlock_failed", "high", "Admin unlock failed repeatedly",
                "Admin login or unlock failures were recorded repeatedly.", "Review login attempts and rotate password if suspicious."));
        addIfNotNull(items, archiveOsHealthItem());
        return items.stream()
                .map(this::mergeState)
                .sorted(Comparator.<Map<String, Object>>comparingInt(item -> severityWeight(String.valueOf(item.get("severity"))))
                        .thenComparing(item -> String.valueOf(item.get("createdAt")), Comparator.reverseOrder()))
                .toList();
    }

    @Transactional
    public Map<String, Object> acknowledge(String id) {
        Map<String, Object> state = repository.updateInboxState(id, "acknowledged", Map.of("action", "pm_inbox_item_acknowledged"));
        repository.recordTimeline("approval", "success", "PM inbox item acknowledged", id, "archiveos", id,
                Map.of("systemId", "archiveos", "action", "pm_inbox_item_acknowledged"));
        return state;
    }

    @Transactional
    public Map<String, Object> resolve(String id) {
        Map<String, Object> state = repository.updateInboxState(id, "resolved", Map.of("action", "pm_inbox_item_resolved"));
        repository.recordTimeline("approval", "success", "PM inbox item resolved", id, "archiveos", id,
                Map.of("systemId", "archiveos", "action", "pm_inbox_item_resolved"));
        return state;
    }

    private Map<String, Object> archiveOsSystem(Map<String, Object> queue) {
        long pending = number(queue.get("pendingApprovalCount"));
        long failed = number(queue.get("failedCount"));
        String status = failed > 0 ? "degraded" : "normal";
        String reason = failed > 0 ? "ArchiveOS has failed workflow records that need review." : "ArchiveOS runtime and PM workflow aggregation are available.";
        Map<String, Object> latestAudit = repository.latestAuditEvent();
        return system("archiveos", "ArchiveOS", "PLATFORM", "local", "local", status, reason, Instant.now().toString(),
                4, status.equals("normal") ? 4 : 3, status.equals("degraded") ? 1 : 0, 0, (int) pending, failed > 0 ? 1 : 0,
                null, string(latestAudit, "id"), null, "http://localhost:5173", "CSJ-PJT/ArchiveOS", "archiveos");
    }

    private Map<String, Object> archiveNexusSystem(List<Map<String, Object>> tasks) {
        List<Map<String, Object>> nexusTasks = tasks.stream().filter(task -> "archive-nexus".equals(systemIdForTask(task))).toList();
        long pending = nexusTasks.stream().filter(task -> "pm_decision_required".equals(task.get("status"))).count();
        long failed = nexusTasks.stream().filter(task -> "failed".equals(task.get("status"))).count();
        String status = failed > 0 ? "degraded" : pending > 0 ? "degraded" : "normal";
        String reason = pending > 0 ? "Nexus workflow is waiting for PM approval." : failed > 0 ? "Nexus workflow failure needs review." : "Nexus workflow contract integration has no pending PM action.";
        Map<String, Object> latest = nexusTasks.isEmpty() ? null : nexusTasks.get(0);
        return system("archive-nexus", "Archive-Nexus", "INDUSTRY_APP", "local", "local", status, reason,
                string(latest, "updated_at", Instant.now().toString()), 1, status.equals("normal") ? 1 : 0,
                status.equals("degraded") ? 1 : 0, 0, (int) pending, failed > 0 ? 1 : 0,
                string(latest, "id"), null, null, null, "CSJ-PJT/Archive-Nexus", "nexus");
    }

    private Map<String, Object> archiveMarketSystem() {
        Map<String, Object> health = repository.latestEcosystemHealth("MARKET");
        Map<String, Object> summary = map(stringMap(health, "summary"));
        String status = managedStatus(health, "not_connected");
        String reason = managedReason(health, "Archive-Market has not been checked by the Ecosystem Control Tower yet.");
        Map<String, Object> system = system("archive-market", "Archive-Market", "SYNTHETIC_COMMERCE_BACKEND", "development", "local", status,
                reason, string(health, "checked_at", null), 1, "normal".equals(status) ? 1 : 0,
                "degraded".equals(status) ? 1 : 0, "down_candidate".equals(status) ? 1 : 0,
                highRiskOrders(summary), "normal".equals(status) ? 0 : 1, null, null, null,
                string(health, "base_url", "http://localhost:8094"), "CSJ-PJT/Archive-Market", "archiveos");
        system.put("role", "Demand / Order / Revenue Source");
        system.put("baseUrlConfigured", string(health, "base_url", null) != null);
        system.put("healthSource", health == null ? "not_checked" : "ecosystem_health_snapshot");
        system.put("secrets", "hidden");
        Map<String, Object> marketSummary = new LinkedHashMap<>();
        marketSummary.put("orders", valueOr(summary.get("orders"), Map.of()));
        marketSummary.put("totalRevenue", valueOr(summary.get("totalRevenue"), "0"));
        marketSummary.put("totalCost", valueOr(summary.get("totalCost"), "0"));
        marketSummary.put("profit", valueOr(summary.get("profit"), "0"));
        marketSummary.put("cashBalance", valueOr(summary.get("cashBalance"), "0"));
        marketSummary.put("bankruptcyRisk", valueOr(summary.get("bankruptcyRisk"), "UNKNOWN"));
        marketSummary.put("returnRate", valueOr(summary.get("returnRate"), "0"));
        marketSummary.put("claimRate", valueOr(summary.get("claimRate"), "0"));
        marketSummary.put("highRiskOrders", valueOr(summary.get("highRiskOrders"), 0));
        marketSummary.put("outbox", valueOr(summary.get("outbox"), Map.of()));
        system.put("marketSummary", marketSummary);
        return system;
    }

    private Map<String, Object> atlasSystem() {
        Map<String, Object> system = repository.atlasSystem();
        List<Map<String, Object>> services = repository.atlasServices();
        Map<String, Object> latestCheck = repository.latestAtlasHealthcheck();
        Map<String, Object> latestLog = repository.atlasWorkLogs(1).stream().findFirst().orElse(null);
        String status = string(system, "current_status", "not_connected");
        return system("atlas-platform", "Atlas Platform", "SERVICE_PORTAL", string(system, "environment", "production"),
                string(system, "provider", "OCI"), status, string(system, "reason", "Atlas registry is not available."),
                string(latestCheck, "checked_at", string(system, "updated_at", Instant.now().toString())),
                services.size(), countServices(services, "normal"), countServices(services, "degraded"),
                countServices(services, "down") + countServices(services, "down_candidate"), 0,
                "normal".equals(status) ? 0 : 1, null, null, string(latestLog, "id"),
                string(system, "public_base_url", "http://161.33.17.84"), "CSJ-PJT/Atlas-Management", "atlas");
    }

    private Map<String, Object> deepStakePlaceholder() {
        return system("deepstake-placeholder", "DeepStake", "PLACEHOLDER", "development", "unknown", "not_connected",
                "DeepStake is registered as a future managed system placeholder.", null,
                0, 0, 0, 0, 0, 0, null, null, null, null, null, "manual");
    }

    private Map<String, Object> archiveLogiticsSystem() {
        Map<String, Object> health = repository.latestEcosystemHealth("LOGITICS");
        String status = managedStatus(health, "not_connected");
        String reason = managedReason(health, "Archive-Logistics has not been checked by the Ecosystem Control Tower yet.");
        Map<String, Object> system = system("archive-logitics", "Archive-Logistics", "LOGISTICS_OPERATIONS_BACKEND", "development", "local", status,
                reason, string(health, "checked_at", null), 1, "normal".equals(status) ? 1 : 0,
                "degraded".equals(status) ? 1 : 0, "down_candidate".equals(status) ? 1 : 0,
                0, "normal".equals(status) ? 0 : 1, null, null, null,
                string(health, "base_url", "http://localhost:8092"), "CSJ-PJT/Archive-Logistics", "archiveos");
        system.put("role", "Synthetic Logistics Operations Backend");
        system.put("baseUrlConfigured", string(health, "base_url", null) != null);
        system.put("healthSource", health == null ? "not_checked" : "ecosystem_health_snapshot");
        system.put("secrets", "hidden");
        return system;
    }

    private Map<String, Object> archiveLedgerSystem() {
        Map<String, Object> summary = approvals.summary();
        Map<String, Object> latest = approvals.latest();
        Map<String, Object> health = repository.latestEcosystemHealth("LEDGER");
        int pending = integer(summary.get("pending"));
        int callbackFailed = integer(summary.get("callback_failed"));
        boolean configured = ledgerEnabled && ledgerBaseUrl != null && !ledgerBaseUrl.isBlank();
        boolean readConnected = health != null && "HEALTHY".equalsIgnoreCase(string(health, "status", ""));
        String status = callbackFailed > 0
                ? "degraded"
                : pending > 0
                    ? "degraded"
                    : readConnected
                        ? "normal"
                        : managedStatus(health, configured ? "degraded" : "not_connected");
        String reason = callbackFailed > 0
                ? "Archive-Ledger callback failures require review."
                : pending > 0
                    ? "Archive-Ledger approval requests are waiting for PM decision."
                    : readConnected
                        ? "Archive-Ledger read integration is healthy. No pending approval request is open."
                    : configured
                        ? managedReason(health, "Archive-Ledger endpoint is configured, but no healthy read snapshot has been recorded yet. Run ecosystem refresh.")
                        : managedReason(health, "Archive-Ledger integration endpoint is not configured yet.");
        Map<String, Object> system = system("archive-ledger", "Archive-Ledger", "FINANCIAL_OPERATIONS_BACKEND", "development", "local", status, reason,
                string(health, "checked_at", string(latest, "updated_at", null)), 1, "not_connected".equals(status) || "down_candidate".equals(status) ? 0 : 1,
                "degraded".equals(status) ? 1 : 0, "down_candidate".equals(status) ? 1 : 0, pending, callbackFailed,
                string(latest, "approval_request_id"), null, null, null, "CSJ-PJT/Archive-Ledger", "archiveos");
        system.put("role", "Synthetic Financial Operations Backend");
        system.put("baseUrlConfigured", ledgerBaseUrl != null && !ledgerBaseUrl.isBlank() || string(health, "base_url", null) != null);
        system.put("approvalCallbackConfigured", ledgerCallbackToken != null && !ledgerCallbackToken.isBlank());
        system.put("integrationEnabled", ledgerEnabled);
        system.put("readIntegrationStatus", string(health, "status", "UNKNOWN"));
        system.put("healthSource", health == null ? "not_checked" : "ecosystem_health_snapshot");
        system.put("secrets", "hidden");
        system.put("environmentRequirements", List.of(
                Map.of("name", "ARCHIVE_LEDGER_BASE_URL", "secret", false),
                Map.of("name", "ARCHIVE_LEDGER_CALLBACK_TOKEN", "secret", true),
                Map.of("name", "ARCHIVE_LEDGER_ENABLED", "secret", false)));
        return system;
    }

    private String managedStatus(Map<String, Object> health, String fallback) {
        if (health == null) return fallback;
        return switch (string(health, "status", "UNKNOWN").toUpperCase(Locale.ROOT)) {
            case "HEALTHY" -> "normal";
            case "DEGRADED", "UNKNOWN" -> "degraded";
            case "UNAVAILABLE", "DOWN" -> "down_candidate";
            case "DISABLED" -> "not_connected";
            default -> fallback;
        };
    }

    private String managedReason(Map<String, Object> health, String fallback) {
        if (health == null) return fallback;
        String error = string(health, "error_message", null);
        String name = string(health, "service_name", "External service");
        String status = string(health, "status", "UNKNOWN");
        if (error != null && !error.isBlank()) return name + " healthcheck returned " + status + ": " + error;
        return name + " healthcheck returned " + status + ".";
    }

    private Map<String, Object> system(String id, String name, String type, String environment, String provider, String status,
                                       String reason, String lastCheckedAt, int serviceCount, int normal, int degraded, int down,
                                       int pending, long incidents, String workflowId, String auditId, String workLogId,
                                       String publicUrl, String repositoryUrl, String source) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("systemId", id);
        value.put("name", name);
        value.put("type", type);
        value.put("environment", environment);
        value.put("provider", provider);
        value.put("status", status);
        value.put("statusReason", reason);
        value.put("lastCheckedAt", lastCheckedAt);
        value.put("serviceCount", serviceCount);
        value.put("normalServiceCount", normal);
        value.put("degradedServiceCount", degraded);
        value.put("downServiceCount", down);
        value.put("pendingApprovalCount", pending);
        value.put("openIncidentCount", incidents);
        value.put("latestWorkflowId", workflowId);
        value.put("latestAuditEventId", auditId);
        value.put("latestWorkLogId", workLogId);
        value.put("publicUrl", publicUrl);
        value.put("repository", repositoryUrl);
        value.put("source", source);
        return value;
    }

    private List<Map<String, Object>> nexusApprovalItems() {
        return repository.pmTasks().stream()
                .filter(task -> "archive-nexus".equals(systemIdForTask(task)))
                .filter(task -> "pm_decision_required".equals(task.get("status")))
                .map(task -> inboxItem("nexus-approval-" + task.get("id"), "high", "archive-nexus", "workflow",
                        "Nexus workflow waiting approval",
                        string(task, "title", "Archive-Nexus workflow") + " is waiting for PM approval.",
                        "Open Workflows and approve, reject, hold, or retry the Nexus workflow.",
                        string(task, "updated_at", string(task, "created_at", Instant.now().toString())),
                        string(task, "id"), null, null, null, null))
                .toList();
    }

    private Map<String, Object> atlasStatusItem() {
        Map<String, Object> atlas = atlasSystem();
        String status = string(atlas, "status", "not_connected");
        if ("normal".equals(status)) return null;
        String severity = "down_candidate".equals(status) || "unavailable".equals(status) ? "critical" : "high";
        return inboxItem("atlas-status-" + status, severity, "atlas-platform", "healthcheck",
                "Atlas Platform status is " + status,
                string(atlas, "statusReason", "Atlas needs review."),
                "Review Atlas service status and the latest healthcheck result.",
                string(atlas, "lastCheckedAt", Instant.now().toString()), null, null, null, null, string(atlas, "latestWorkLogId"));
    }

    private Map<String, Object> atlasRecoveryItem() {
        Map<String, Object> atlas = atlasSystem();
        Map<String, Object> latest = repository.latestAtlasHealthcheck();
        if (!"normal".equals(atlas.get("status")) || latest == null || !"ok".equals(latest.get("status"))) return null;
        return inboxItem("atlas-healthcheck-normal-" + latest.get("id"), "info", "atlas-platform", "healthcheck",
                "Atlas healthcheck completed normally",
                "Latest Atlas read-only healthcheck returned the expected response.",
                "No urgent action required. Keep monitoring for state changes.",
                string(latest, "checked_at", Instant.now().toString()), null, null, string(latest, "service_id"), null, null);
    }

    private Map<String, Object> dailyReportItem() {
        Map<String, Object> report = repository.latestDailyReport();
        if (report == null) return null;
        return inboxItem("daily-report-" + report.get("id"), "info", "archiveos", "daily_report",
                "Daily report generated",
                "ArchiveOS daily report for " + report.get("target_date") + " is available.",
                "Review the latest Daily Report if planning operational follow-up.",
                string(report, "created_at", Instant.now().toString()), null, null, null, null, null);
    }

    private List<Map<String, Object>> workLogFailureItems() {
        return repository.atlasWorkLogs(20).stream()
                .filter(log -> log.get("failure_reason") != null && !String.valueOf(log.get("failure_reason")).isBlank())
                .map(log -> inboxItem("codex-worklog-failure-" + log.get("id"), "medium", "atlas-platform", "work_log",
                        "Codex work log failure recorded", string(log, "work_title", "Codex work log") + " recorded a failure reason.",
                        "Review the work log failure reason and next actions.",
                        string(log, "created_at", Instant.now().toString()), null, null, string(log, "target_service_id"), null, string(log, "id")))
                .toList();
    }

    private List<Map<String, Object>> ledgerApprovalItems() {
        return approvals.pending(50).stream()
                .map(request -> {
                    String severity = ledgerSeverity(request);
                    return inboxItem("ledger-approval-" + request.get("approval_request_id"), severity, "archive-ledger", "approval",
                            "Ledger approval required: " + request.get("transaction_id") + " " + request.get("amount") + " " + request.get("currency"),
                            string(request, "reason", "Archive-Ledger synthetic transaction requires approval."),
                            "Review policy evidence and approve or reject the transaction.",
                            string(request, "created_at", Instant.now().toString()), null, string(request, "approval_request_id"),
                            null, null, null);
                })
                .toList();
    }

    private List<Map<String, Object>> ledgerCallbackFailedItems() {
        return approvals.callbackFailed(50).stream()
                .map(request -> inboxItem("ledger-callback-failed-" + request.get("approval_request_id"), "high", "archive-ledger", "integration",
                        "Ledger callback failed: " + request.get("approval_request_id"),
                        string(request, "callback_last_error", "Archive-Ledger callback failed."),
                        "Check Archive-Ledger availability and retry callback in a later gateway increment.",
                        string(request, "updated_at", Instant.now().toString()), null, string(request, "approval_request_id"),
                        null, null, null))
                .toList();
    }

    private Map<String, Object> securityBlockedItem(String key, String severity, String title, String summary, String action) {
        long count = repository.recentAuditLogs(100).stream()
                .filter(log -> matchesSecurityRule(key, log))
                .count();
        if (count < 2) return null;
        return inboxItem("security-" + key, severity, "archiveos", "security", title,
                summary + " Count: " + count + ".", action, Instant.now().toString(), null, null, null, null, null);
    }

    private Map<String, Object> archiveOsHealthItem() {
        Map<String, Object> queue = repository.queueSummary();
        if (number(queue.get("failedCount")) <= 0) return null;
        return inboxItem("archiveos-health-degraded", "high", "archiveos", "integration",
                "ArchiveOS internal health degraded", "ArchiveOS has failed workflow records.",
                "Review failed workflow records and runtime timeline.", Instant.now().toString(), null, null, null, null, null);
    }

    private Map<String, Object> inboxItem(String id, String severity, String sourceSystemId, String sourceType, String title,
                                          String summary, String recommendedAction, String createdAt, String workflowId,
                                          String approvalId, String serviceId, String auditId, String workLogId) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", id);
        value.put("severity", severity);
        value.put("sourceSystemId", sourceSystemId);
        value.put("sourceType", sourceType);
        value.put("title", title);
        value.put("summary", summary);
        value.put("recommendedAction", recommendedAction);
        value.put("status", "open");
        value.put("createdAt", createdAt);
        value.put("updatedAt", createdAt);
        value.put("relatedWorkflowId", workflowId);
        value.put("relatedApprovalId", approvalId);
        value.put("relatedServiceId", serviceId);
        value.put("relatedAuditEventId", auditId);
        value.put("relatedWorkLogId", workLogId);
        return value;
    }

    private Map<String, Object> mergeState(Map<String, Object> item) {
        Map<String, Object> state = repository.inboxState(String.valueOf(item.get("id")));
        if (state == null) return item;
        Map<String, Object> merged = new LinkedHashMap<>(item);
        merged.put("status", state.get("status"));
        merged.put("updatedAt", state.get("updated_at"));
        return merged;
    }

    private Map<String, Object> recommendedAction(List<Map<String, Object>> inbox) {
        Map<String, Object> item = inbox.stream().filter(row -> "open".equals(row.get("status"))).findFirst().orElse(null);
        if (item == null) return Map.of("title", "No urgent action required", "reason", "Managed systems are either normal or informational only.");
        return Map.of("title", item.get("recommendedAction"), "reason", item.get("summary"), "itemId", item.get("id"), "severity", item.get("severity"));
    }

    private String systemIdForTask(Map<String, Object> task) {
        Map<String, Object> metadata = map(task.get("metadata"));
        String project = string(task, "target_project", "").toLowerCase(Locale.ROOT);
        String source = String.valueOf(metadata.getOrDefault("source", "")).toLowerCase(Locale.ROOT);
        String projectId = String.valueOf(metadata.getOrDefault("project_id", "")).toLowerCase(Locale.ROOT);
        if (project.contains("nexus") || source.contains("nexus") || projectId.contains("nexus")) return "archive-nexus";
        if (project.contains("archiveos") || source.contains("archiveos")) return "archiveos";
        return "archive-nexus";
    }

    private String systemIdForEvent(Map<String, Object> event) {
        String path = string(event, "request_path", "");
        if (path.contains("/atlas")) return "atlas-platform";
        if (path.contains("/tasks") || path.contains("/contracts")) return "archive-nexus";
        return "archiveos";
    }

    private Object stringMap(Map<String, Object> value, String key) {
        if (value == null) return Map.of();
        Object candidate = value.get(key);
        return candidate == null ? Map.of() : candidate;
    }

    private int highRiskOrders(Map<String, Object> summary) {
        Object value = summary.get("highRiskOrders");
        return value instanceof Number number ? number.intValue() : 0;
    }

    private Object valueOr(Object value, Object fallback) {
        return value == null ? fallback : value;
    }

    private boolean matchesSecurityRule(String key, Map<String, Object> log) {
        String path = string(log, "request_path", "");
        String role = string(log, "role", "");
        int status = integer(log.get("response_status"));
        if ("public_cud_blocked".equals(key)) return "PUBLIC".equals(role) && status >= 400;
        if ("admin_unlock_failed".equals(key)) return path.contains("/auth/login") && status >= 400;
        return false;
    }

    private String ledgerSeverity(Map<String, Object> request) {
        Map<String, Object> metadata = map(request.get("metadata"));
        String severity = String.valueOf(metadata.getOrDefault("severity", "")).toUpperCase(Locale.ROOT);
        if ("CRITICAL".equals(severity)) return "critical";
        if ("HIGH".equals(severity) || decimal(request.get("amount")).compareTo(java.math.BigDecimal.valueOf(3_000_000)) >= 0) return "high";
        return "medium";
    }

    private void addIfNotNull(List<Map<String, Object>> rows, Map<String, Object> value) { if (value != null) rows.add(value); }
    private long countSystems(List<Map<String, Object>> systems, String status) { return systems.stream().filter(system -> status.equals(system.get("status"))).count(); }
    private long severityCount(List<Map<String, Object>> inbox, String severity) { return inbox.stream().filter(item -> severity.equals(item.get("severity"))).count(); }
    private int countServices(List<Map<String, Object>> services, String status) { return (int) services.stream().filter(service -> status.equals(service.get("current_status"))).count(); }
    private int severityWeight(String value) { int index = SEVERITY_ORDER.indexOf(value); return index < 0 ? SEVERITY_ORDER.size() : index; }
    private int integer(Object value) { return value instanceof Number number ? number.intValue() : 0; }
    private java.math.BigDecimal decimal(Object value) { return value instanceof java.math.BigDecimal d ? d : value instanceof Number n ? java.math.BigDecimal.valueOf(n.doubleValue()) : java.math.BigDecimal.ZERO; }
    private long number(Object value) { return value instanceof Number number ? number.longValue() : 0; }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private String string(Map<String, Object> value, String key) { return string(value, key, null); }
    private String string(Map<String, Object> value, String key, String fallback) {
        if (value == null) return fallback;
        Object text = value.get(key);
        return text == null ? fallback : String.valueOf(text);
    }
}
