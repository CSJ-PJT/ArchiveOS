package com.archiveos.ai.obsidian;

import com.archiveos.ai.ecosystem.EcosystemService;
import com.archiveos.ai.notification.NotificationResult;
import com.archiveos.ai.notification.NotificationService;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class RagVerificationService {
    private static final Duration PLAN_TTL = Duration.ofMinutes(10);
    private final EcosystemService ecosystem;
    private final NotificationService notifications;
    private final Map<String, StoredPlan> plans = new ConcurrentHashMap<>();

    public RagVerificationService(EcosystemService ecosystem, NotificationService notifications) {
        this.ecosystem = ecosystem;
        this.notifications = notifications;
    }

    public VerificationPlan createPlan(String question) {
        cleanup();
        String normalized = question == null ? "" : question.toLowerCase(Locale.ROOT);
        boolean slackRelated = normalized.contains("slack") || normalized.contains("슬랙");
        boolean deliveryTest = slackRelated && (normalized.contains("send") || normalized.contains("test")
                || normalized.contains("전송") || normalized.contains("보내") || normalized.contains("테스트"));
        List<VerificationCheck> checks = new ArrayList<>();
        checks.add(new VerificationCheck("ARCHIVEOS_API_HEALTH", "ArchiveOS API 응답 상태 확인", "READ_ONLY"));
        checks.add(new VerificationCheck("ECOSYSTEM_SERVICE_HEALTH", "연동 서비스 최신 상태 스냅샷 확인", "READ_ONLY"));
        if (slackRelated) checks.add(new VerificationCheck("SLACK_CONFIGURATION", "Slack 전달 채널 구성 여부 확인", "READ_ONLY"));
        if (deliveryTest) checks.add(new VerificationCheck("SLACK_DELIVERY_TEST", "Slack에 1회 검증 메시지 전송", "EXTERNAL_EFFECT"));

        String planId = "verify-" + UUID.randomUUID();
        Instant createdAt = Instant.now();
        VerificationPlan plan = new VerificationPlan(planId,
                "승인된 고정 점검만 1회 실행합니다. 임의 명령, URL, 데이터 변경은 허용하지 않습니다.",
                checks, true, deliveryTest, createdAt.toString(), createdAt.plus(PLAN_TTL).toString());
        plans.put(planId, new StoredPlan(plan, false));
        return plan;
    }

    public VerificationReceipt execute(String planId, boolean approved, boolean admin) {
        if (!approved) throw new IllegalArgumentException("Explicit approval is required.");
        StoredPlan stored = plans.compute(planId, (key, current) -> {
            if (current == null) throw new IllegalArgumentException("Verification plan not found or already used.");
            if (current.consumed()) throw new IllegalStateException("Verification plan has already been used.");
            if (Instant.parse(current.plan().expiresAt()).isBefore(Instant.now())) {
                throw new IllegalStateException("Verification plan has expired.");
            }
            if (current.plan().externalEffect() && !admin) {
                throw new SecurityException("Administrator approval is required for external-effect checks.");
            }
            return new StoredPlan(current.plan(), true);
        });

        String receiptId = "receipt-" + UUID.randomUUID();
        Instant checkedAt = Instant.now();
        List<Map<String, Object>> apiResults = new ArrayList<>();
        Map<String, Object> slackDelivery = new LinkedHashMap<>();
        slackDelivery.put("status", "NOT_TESTED");
        slackDelivery.put("configured", notifications.configured("slack"));

        for (VerificationCheck check : stored.plan().checks()) {
            switch (check.id()) {
                case "ARCHIVEOS_API_HEALTH" -> apiResults.add(Map.of(
                        "check", check.id(), "service", "ArchiveOS", "status", "UP", "checkedAt", checkedAt.toString()));
                case "ECOSYSTEM_SERVICE_HEALTH" -> apiResults.addAll(serviceStatuses(ecosystem.summary(), checkedAt));
                case "SLACK_CONFIGURATION" -> apiResults.add(Map.of(
                        "check", check.id(), "service", "Slack", "status",
                        notifications.configured("slack") ? "CONFIGURED" : "NOT_CONFIGURED",
                        "checkedAt", checkedAt.toString()));
                case "SLACK_DELIVERY_TEST" -> {
                    List<NotificationResult> results = notifications.send(
                            "[ArchiveOS AX 검증]\n승인된 1회 Slack 전달 점검\n영수증: " + receiptId);
                    NotificationResult slack = results.stream().filter(result -> "slack".equals(result.channel()))
                            .findFirst().orElse(new NotificationResult("slack", false, false, "adapter unavailable"));
                    slackDelivery.clear();
                    slackDelivery.put("status", slack.sent() ? "DELIVERED" : "FAILED");
                    slackDelivery.put("configured", slack.configured());
                }
                default -> throw new IllegalStateException("Unsupported verification check.");
            }
        }

        boolean passed = apiResults.stream().noneMatch(result -> List.of("DOWN", "UNAVAILABLE", "FAILED")
                .contains(String.valueOf(result.get("status"))))
                && !"FAILED".equals(slackDelivery.get("status"));
        return new VerificationReceipt(receiptId, planId, true, checkedAt.toString(), "LIVE",
                passed ? "PASS" : "ATTENTION_REQUIRED", apiResults, slackDelivery,
                "고정된 읽기 전용 점검과 명시적으로 승인된 1회 외부 효과만 실행했습니다.");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> serviceStatuses(Map<String, Object> summary, Instant checkedAt) {
        Object raw = summary.get("services");
        if (!(raw instanceof Map<?, ?> services)) return List.of(Map.of(
                "check", "ECOSYSTEM_SERVICE_HEALTH", "service", "Archive ecosystem",
                "status", "UNKNOWN", "checkedAt", checkedAt.toString()));
        List<Map<String, Object>> results = new ArrayList<>();
        services.forEach((key, value) -> {
            Map<String, Object> service = value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
            results.add(Map.of(
                    "check", "ECOSYSTEM_SERVICE_HEALTH",
                    "service", safeServiceName(String.valueOf(key)),
                    "status", String.valueOf(service.getOrDefault("status", "UNKNOWN")),
                    "checkedAt", checkedAt.toString()));
        });
        return results;
    }

    private String safeServiceName(String key) {
        return switch (key.toLowerCase(Locale.ROOT)) {
            case "market" -> "Archive-Market";
            case "nexus" -> "Archive-Nexus";
            case "logitics", "logistics" -> "Archive-Logistics";
            case "ledger" -> "Archive-Ledger";
            default -> "Archive service";
        };
    }

    private void cleanup() {
        Instant now = Instant.now();
        plans.entrySet().removeIf(entry -> entry.getValue().consumed()
                || Instant.parse(entry.getValue().plan().expiresAt()).isBefore(now));
    }

    public record VerificationCheck(String id, String description, String mode) {}
    public record VerificationPlan(String planId, String description, List<VerificationCheck> checks,
                                   boolean approvalRequired, boolean externalEffect,
                                   String createdAt, String expiresAt) {}
    public record VerificationReceipt(String receiptId, String planId, boolean actualCheckPerformed,
                                      String checkedAt, String evidenceType, String result,
                                      List<Map<String, Object>> apiResults, Map<String, Object> slackDelivery,
                                      String executionScope) {}
    private record StoredPlan(VerificationPlan plan, boolean consumed) {}
}
