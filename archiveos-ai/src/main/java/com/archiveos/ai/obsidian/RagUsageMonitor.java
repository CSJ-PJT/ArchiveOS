package com.archiveos.ai.obsidian;

import com.archiveos.ai.notification.NotificationService;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import java.util.regex.Pattern;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class RagUsageMonitor {
    private static final Pattern SENSITIVE_PROBE = Pattern.compile(
            "(?i)(slack.{0,20}(reconnect|webhook|token|environment|env)|"
                    + "(?:environment variable|환경변수|환경 변수|env var)|"
                    + "curl\\s|docker\\s+(?:exec|inspect|compose)|ssh\\s+-[LRD]|"
                    + "(?:api[_-]?key|password|secret|token|private key)|"
                    + "(?:internal|내부).{0,20}(?:path|url|endpoint|command|경로|명령)|"
                    + "localhost(?::\\d+)?|host\\.docker\\.internal|\\.env(?:\\s|$)|/api/security)");

    private final NotificationService notifications;
    private final Map<String, LongAdder> counters = new ConcurrentHashMap<>();

    public RagUsageMonitor(NotificationService notifications) {
        this.notifications = notifications;
    }

    public boolean suspicious(String question) {
        return question != null && SENSITIVE_PROBE.matcher(question).find();
    }

    public void record(String operation, String role, boolean success, boolean suspicious, String correlationId) {
        increment(operation + ".total");
        increment(operation + (success ? ".success" : ".failed"));
        increment("role." + normalize(role));
        if (suspicious) {
            increment("sensitive_probe");
            immediate("민감한 내부 운영정보 탐색 시도", role, operation, correlationId);
        }
    }

    public void recordRateLimited(String operation, String role, String correlationId) {
        increment("rate_limited");
        immediate("RAG 반복 요청 차단", role, operation, correlationId);
    }

    @Scheduled(cron = "${archiveos.rag.usage-summary-cron:0 55 23 * * *}", zone = "Asia/Seoul")
    public void sendDailySummary() {
        Map<String, Long> snapshot = snapshotAndReset();
        long total = snapshot.getOrDefault("ask.total", 0L) + snapshot.getOrDefault("search.total", 0L);
        if (total == 0L) return;
        String message = "[ArchiveOS RAG 일일 집계]\n"
                + "질문: " + snapshot.getOrDefault("ask.total", 0L) + "건\n"
                + "검색: " + snapshot.getOrDefault("search.total", 0L) + "건\n"
                + "실패: " + (snapshot.getOrDefault("ask.failed", 0L) + snapshot.getOrDefault("search.failed", 0L)) + "건\n"
                + "민감 탐색: " + snapshot.getOrDefault("sensitive_probe", 0L) + "건\n"
                + "반복 차단: " + snapshot.getOrDefault("rate_limited", 0L) + "건\n"
                + "집계 시각: " + Instant.now();
        bestEffort(message);
    }

    Map<String, Long> snapshotAndReset() {
        Map<String, Long> snapshot = new java.util.LinkedHashMap<>();
        counters.forEach((key, value) -> snapshot.put(key, value.sumThenReset()));
        return snapshot;
    }

    private void immediate(String reason, String role, String operation, String correlationId) {
        bestEffort("[ArchiveOS RAG 보안 경보]\n"
                + "유형: " + reason + "\n"
                + "역할: " + normalize(role).toUpperCase(Locale.ROOT) + "\n"
                + "작업: " + operation + "\n"
                + "상관관계: " + correlationId);
    }

    private void bestEffort(String message) {
        try { notifications.send(message); }
        catch (RuntimeException ignored) { /* alert delivery must not break RAG */ }
    }

    private void increment(String key) {
        counters.computeIfAbsent(key, ignored -> new LongAdder()).increment();
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? "public" : value.trim().toLowerCase(Locale.ROOT);
    }
}
