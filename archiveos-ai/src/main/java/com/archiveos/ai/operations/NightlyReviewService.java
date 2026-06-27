package com.archiveos.ai.operations;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class NightlyReviewService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final NodeRuntimeClient runtimeClient;
    private final OperationsRepository repository;

    public NightlyReviewService(NodeRuntimeClient runtimeClient, OperationsRepository repository) {
        this.runtimeClient = runtimeClient;
        this.repository = repository;
    }

    public Map<String, Object> run(LocalDate targetDate) {
        LocalDate date = targetDate == null ? LocalDate.now(SEOUL).minusDays(1) : targetDate;
        Map<String, Object> summary = buildSummary(date);
        Map<String, Object> saved = repository.saveBatch("nightly_review", "completed", date, String.valueOf(summary.get("summaryText")), summary);
        repository.saveSnapshot(summary);
        return saved;
    }

    public Map<String, Object> buildSummary(LocalDate targetDate) {
        Map<String, Object> runtime;
        String runtimeError = null;
        try { runtime = runtimeClient.runtime(); }
        catch (Exception error) { runtime = fallbackRuntime(); runtimeError = sanitize(error.getMessage()); }

        Map<String, Object> queue = map(runtime.get("queue"));
        Map<String, Object> processes = map(runtime.get("processes"));
        Map<String, Object> latest = map(runtime.get("latest"));
        Map<String, Object> details = map(runtime.get("latest_details"));
        Map<String, Object> builderSource = map(details.get("builder"));
        Map<String, Object> reviewerSource = map(details.get("reviewer"));
        Map<String, Object> latestBuilder = builderSource.isEmpty() ? null : copyBuilder(builderSource, map(latest.get("outbox")));
        Map<String, Object> latestReviewer = reviewerSource.isEmpty() ? null : copyReviewer(reviewerSource, map(latest.get("review")));
        List<String> warnings = warnings(queue, processes, reviewerSource, runtimeError);
        String operationStatus = runtimeError != null ? "problem" : warnings.isEmpty() ? "normal" : "warning";
        String statusReason = runtimeError != null ? "backend runtime API 응답 실패" : warnings.isEmpty() ? "치명적 경고가 없습니다." : warnings.get(0);
        Map<String, Object> operators = new LinkedHashMap<>();
        operators.put("implementer", processes.get("implementer") == null ? "미감지" : integer(queue, "processing") > 0 ? "작업중" : "감지됨");
        operators.put("reviewer", processes.get("reviewer") == null ? "미감지" : "감지됨");
        operators.put("loop", processes.get("loop") == null ? "미감지" : "감지됨");
        operators.put("reviewerBridge", processes.get("reviewer_bridge") == null ? "미감지" : "감지됨");

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("date", targetDate.toString()); summary.put("operationStatus", operationStatus); summary.put("statusReason", statusReason);
        summary.put("queue", Map.of("inbox", integer(queue, "inbox"), "processing", integer(queue, "processing"), "outbox", integer(queue, "outbox"), "reviews", integer(queue, "reviews")));
        summary.put("latestInboxTask", string(map(latest.get("inbox")).get("name"))); summary.put("latestBuilder", latestBuilder); summary.put("latestReviewer", latestReviewer);
        summary.put("operators", operators); summary.put("warnings", warnings);
        summary.put("decisions", Map.of("count", 0, "recent", List.of())); summary.put("commands", Map.of("count", 0, "recent", List.of()));
        summary.put("summaryText", summaryText(targetDate, operationStatus, statusReason, queue, latestBuilder, latestReviewer, warnings));
        return summary;
    }

    private String summaryText(LocalDate date, String status, String reason, Map<String, Object> queue, Map<String, Object> builder, Map<String, Object> reviewer, List<String> warnings) {
        return String.join("\n",
                "ArchiveOS 일일 운영 요약: " + date,
                "상태: " + status + " / " + reason,
                String.format("Runtime: Inbox %d, Processing %d, Outbox %d, Reviews %d", integer(queue, "inbox"), integer(queue, "processing"), integer(queue, "outbox"), integer(queue, "reviews")),
                builder == null ? "Builder: 없음" : "Builder: " + builder.get("status") + " / " + builder.get("task_id"),
                reviewer == null ? "Reviewer: 없음" : "Reviewer: " + reviewer.get("verdict") + " / " + reviewer.get("reviewed_task_id"),
                warnings.isEmpty() ? "경고: 없음" : "경고: " + String.join(" | ", warnings),
                "Decisions: 0. Commands: 0.");
    }

    private List<String> warnings(Map<String, Object> queue, Map<String, Object> processes, Map<String, Object> reviewer, String runtimeError) {
        List<String> rows = new ArrayList<>();
        if (runtimeError != null) rows.add("backend runtime API 응답 실패: " + runtimeError);
        if (integer(queue, "processing") > 0 && processes.get("implementer") == null) rows.add("processing 작업이 있지만 implementer 프로세스가 감지되지 않았습니다.");
        if (integer(queue, "inbox") > 0 && processes.get("loop") == null) rows.add("inbox에 작업이 있지만 loop 프로세스가 감지되지 않았습니다.");
        if ("stop".equalsIgnoreCase(string(reviewer.get("verdict")))) rows.add("최신 reviewer verdict가 stop입니다.");
        return rows;
    }

    private Map<String, Object> copyBuilder(Map<String, Object> source, Map<String, Object> latest) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("task_id", source.get("task_id")); value.put("status", source.get("status")); value.put("result_name", latest.get("name"));
        value.put("finished_at", source.get("finished_at")); value.put("summary", source.get("summary")); return value;
    }
    private Map<String, Object> copyReviewer(Map<String, Object> source, Map<String, Object> latest) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("reviewed_task_id", source.get("reviewed_task_id")); value.put("verdict", source.get("verdict")); value.put("review_name", latest.get("name"));
        value.put("reviewed_at", source.get("reviewed_at")); value.put("summary", source.get("summary")); return value;
    }
    private Map<String, Object> fallbackRuntime() { return Map.of("queue", Map.of("inbox",0,"processing",0,"outbox",0,"reviews",0), "processes", Map.of(), "latest", Map.of(), "latest_details", Map.of()); }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private int integer(Map<String, Object> value, String key) { return value.get(key) instanceof Number number ? number.intValue() : 0; }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private String sanitize(String value) { return value == null ? "runtime unavailable" : value.replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]").replaceAll("password=([^\\s&]+)", "password=[redacted]"); }
}
