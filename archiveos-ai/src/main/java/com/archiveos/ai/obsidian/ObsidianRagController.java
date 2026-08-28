package com.archiveos.ai.obsidian;

import com.archiveos.ai.audit.AuditLogService;
import com.archiveos.ai.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.security.Principal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ObsidianRagController {
    private final ObsidianRagService ragService;
    private final RagRateLimitService rateLimit;
    private final AuditLogService audit;
    private final NotificationService notifications;

    public ObsidianRagController(ObsidianRagService ragService, RagRateLimitService rateLimit, AuditLogService audit,
                                NotificationService notifications) {
        this.ragService = ragService;
        this.rateLimit = rateLimit;
        this.audit = audit;
        this.notifications = notifications;
    }

    @PostMapping("/api/obsidian/sync")
    public ResponseEntity<Map<String, Object>> sync() throws IOException {
        return ResponseEntity.ok(Map.of("data", ragService.syncVault()));
    }

    @GetMapping("/api/obsidian/documents")
    public ResponseEntity<Map<String, Object>> documents(@RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(Map.of("data", ragService.listDocuments(limit)));
    }

    @GetMapping("/api/rag/search")
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "10") int limit,
            Principal principal,
            HttpServletRequest request) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "query is required."));
        }
        ResponseEntity<Map<String, Object>> blocked = limited("search", principal, request);
        if (blocked != null) return blocked;
        String correlationId = "rag-search-" + UUID.randomUUID();
        try {
            var results = ragService.search(query, limit);
            notifyNonAdmin(request, "검색", "성공", results.size(), correlationId);
            return ResponseEntity.ok(Map.of("data", results, "status", "SEARCH_ONLY"));
        } catch (RuntimeException error) {
            notifyNonAdmin(request, "검색", "실패", 0, correlationId);
            throw error;
        }
    }

    @PostMapping("/api/rag/ask")
    public ResponseEntity<Map<String, Object>> ask(@Valid @RequestBody RagAskRequest request,
                                                    Principal principal,
                                                    HttpServletRequest httpRequest) {
        ResponseEntity<Map<String, Object>> blocked = limited("ask", principal, httpRequest);
        if (blocked != null) return blocked;
        String correlationId = "rag-" + UUID.randomUUID();
        try {
            RagAnswer answer = ragService.answer(request.question(), request.context());
            audit.recordEventWithTimeline("rag_question_answered", "knowledge", "rag-ask", correlationId,
                    Map.of("referenceCount", answer.references().size(), "answerRecorded", true),
                    "success", "RAG 질문 응답 완료",
                    "운영 지식 질문에 답변하고 참조 " + answer.references().size() + "건을 기록했습니다.");
            notifyNonAdmin(httpRequest, "질문", "성공", answer.references().size(), correlationId);
            return ResponseEntity.ok(Map.of("data", answer, "correlationId", correlationId));
        } catch (RuntimeException error) {
            audit.recordEventWithTimeline("rag_question_failed", "knowledge", "rag-ask", correlationId,
                    Map.of("errorType", error.getClass().getSimpleName()),
                    "failed", "RAG 질문 응답 실패", "운영 지식 질문 처리에 실패했습니다.");
            notifyNonAdmin(httpRequest, "질문", "실패", 0, correlationId);
            throw error;
        }
    }

    private void notifyNonAdmin(HttpServletRequest request, String operation, String result, int referenceCount,
                                String correlationId) {
        if (request.isUserInRole("ADMIN")) return;
        String role = request.isUserInRole("PM") ? "PM"
                : request.isUserInRole("OPERATOR") ? "OPERATOR" : "PUBLIC";
        String message = "[ArchiveOS RAG 사용]\n"
                + "역할: " + role + "\n"
                + "작업: " + operation + "\n"
                + "결과: " + result + "\n"
                + "참조: " + referenceCount + "건\n"
                + "상관관계: " + correlationId;
        try {
            notifications.send(message);
        } catch (RuntimeException ignored) {
            // Slack 전달 실패가 RAG 조회 자체를 중단시키지 않도록 best-effort로 처리한다.
        }
    }

    private ResponseEntity<Map<String, Object>> limited(String operation, Principal principal, HttpServletRequest request) {
        String key = principal != null && principal.getName() != null && !principal.getName().isBlank()
                ? "principal:" + principal.getName()
                : "remote:" + request.getRemoteAddr();
        RagRateLimitService.Decision decision = rateLimit.check(operation, key);
        if (decision.allowed()) return null;
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", Long.toString(decision.retryAfterSeconds()))
                .body(Map.of("error", "RAG request rate limit exceeded.", "retryAfterSeconds", decision.retryAfterSeconds()));
    }

    @ExceptionHandler(AiUnavailableException.class)
    public ResponseEntity<Map<String, Object>> aiUnavailable(AiUnavailableException error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", error.getMessage(),
                "status", "disabled"));
    }

    @ExceptionHandler({CannotGetJdbcConnectionException.class, DataAccessResourceFailureException.class})
    public ResponseEntity<Map<String, Object>> databaseUnavailable(Exception error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "Vector database is unavailable. Configure DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD for Supabase PostgreSQL or local pgvector.",
                "status", "database_unavailable"));
    }

    public record RagAskRequest(@NotBlank String question, Map<String, Object> context) {}
}
