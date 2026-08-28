package com.archiveos.ai.obsidian;

import com.archiveos.ai.audit.AuditLogService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ObsidianRagController {
    private final ObsidianRagService ragService;
    private final RagRateLimitService rateLimit;
    private final AuditLogService audit;
    private final RagUsageMonitor usageMonitor;
    private final RagVerificationService verification;

    public ObsidianRagController(ObsidianRagService ragService, RagRateLimitService rateLimit, AuditLogService audit,
                                RagUsageMonitor usageMonitor, RagVerificationService verification) {
        this.ragService = ragService;
        this.rateLimit = rateLimit;
        this.audit = audit;
        this.usageMonitor = usageMonitor;
        this.verification = verification;
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
        String correlationId = "rag-search-" + UUID.randomUUID();
        ResponseEntity<Map<String, Object>> blocked = limited("search", principal, request, correlationId);
        if (blocked != null) return blocked;
        boolean suspicious = usageMonitor.suspicious(query);
        try {
            var results = ragService.search(query, limit);
            usageMonitor.record("search", role(request), true, suspicious, correlationId);
            return ResponseEntity.ok(Map.of("data", results, "status", "SEARCH_ONLY"));
        } catch (RuntimeException error) {
            usageMonitor.record("search", role(request), false, suspicious, correlationId);
            throw error;
        }
    }

    @PostMapping("/api/rag/ask")
    public ResponseEntity<Map<String, Object>> ask(@Valid @RequestBody RagAskRequest request,
                                                    Principal principal,
                                                    HttpServletRequest httpRequest) {
        String correlationId = "rag-" + UUID.randomUUID();
        ResponseEntity<Map<String, Object>> blocked = limited("ask", principal, httpRequest, correlationId);
        if (blocked != null) return blocked;
        boolean trusted = trusted(httpRequest);
        boolean suspicious = usageMonitor.suspicious(request.question());
        try {
            // Browser-provided runtime context is accepted only for an authenticated
            // operator. Public callers cannot inject "trusted" runtime facts.
            RagAnswer answer = trusted
                    ? ragService.answerTrusted(request.question(), request.context())
                    : ragService.answerPublic(request.question());
            audit.recordEventWithTimeline("rag_question_answered", "knowledge", "rag-ask", correlationId,
                    Map.of("referenceCount", answer.references().size(), "answerRecorded", true),
                    "success", "RAG 질문 응답 완료",
                    "운영 지식 질문에 답변하고 참조 " + answer.references().size() + "건을 기록했습니다.");
            usageMonitor.record("ask", role(httpRequest), true, suspicious, correlationId);
            return ResponseEntity.ok(Map.of("data", answer, "correlationId", correlationId));
        } catch (RuntimeException error) {
            audit.recordEventWithTimeline("rag_question_failed", "knowledge", "rag-ask", correlationId,
                    Map.of("errorType", error.getClass().getSimpleName()),
                    "failed", "RAG 질문 응답 실패", "운영 지식 질문 처리에 실패했습니다.");
            usageMonitor.record("ask", role(httpRequest), false, suspicious, correlationId);
            throw error;
        }
    }

    @PostMapping("/api/rag/verification/plans")
    public ResponseEntity<Map<String, Object>> verificationPlan(
            @Valid @RequestBody VerificationPlanRequest request,
            Principal principal, HttpServletRequest httpRequest) {
        String correlationId = "rag-plan-" + UUID.randomUUID();
        ResponseEntity<Map<String, Object>> blocked = limited("plan", principal, httpRequest, correlationId);
        if (blocked != null) return blocked;
        return ResponseEntity.ok(Map.of("data", verification.createPlan(request.question()),
                "correlationId", correlationId));
    }

    @PostMapping("/api/rag/verification/plans/{planId}/execute")
    public ResponseEntity<Map<String, Object>> executeVerification(
            @PathVariable String planId,
            @Valid @RequestBody VerificationExecutionRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(Map.of("data",
                verification.execute(planId, request.approved(), httpRequest.isUserInRole("ADMIN"))));
    }

    private ResponseEntity<Map<String, Object>> limited(String operation, Principal principal,
                                                        HttpServletRequest request, String correlationId) {
        String key = principal != null && principal.getName() != null && !principal.getName().isBlank()
                ? "principal:" + principal.getName()
                : "remote:" + request.getRemoteAddr();
        RagRateLimitService.Decision decision = rateLimit.check(operation, key);
        if (decision.allowed()) return null;
        usageMonitor.recordRateLimited(operation, role(request), correlationId);
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", Long.toString(decision.retryAfterSeconds()))
                .body(Map.of("error", "RAG request rate limit exceeded.", "retryAfterSeconds", decision.retryAfterSeconds()));
    }

    @ExceptionHandler(AiUnavailableException.class)
    public ResponseEntity<Map<String, Object>> aiUnavailable(AiUnavailableException error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "AI knowledge service is temporarily unavailable.",
                "status", "disabled"));
    }

    @ExceptionHandler({CannotGetJdbcConnectionException.class, DataAccessResourceFailureException.class})
    public ResponseEntity<Map<String, Object>> databaseUnavailable(Exception error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "Knowledge database is temporarily unavailable.",
                "status", "database_unavailable"));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> verificationForbidden(SecurityException error) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "error", "Administrator approval is required for this verification plan.",
                "status", "approval_required"));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, Object>> invalidVerificationPlan(RuntimeException error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "The verification plan is invalid, expired, or already used.",
                "status", "verification_plan_unavailable"));
    }

    private boolean trusted(HttpServletRequest request) {
        return request.isUserInRole("AUTHENTICATED_READ") || request.isUserInRole("OPERATOR")
                || request.isUserInRole("PM") || request.isUserInRole("ADMIN");
    }

    private String role(HttpServletRequest request) {
        if (request.isUserInRole("ADMIN")) return "ADMIN";
        if (request.isUserInRole("PM")) return "PM";
        if (request.isUserInRole("OPERATOR")) return "OPERATOR";
        if (request.isUserInRole("AUTHENTICATED_READ")) return "AUTHENTICATED_READ";
        return "PUBLIC";
    }

    public record RagAskRequest(@NotBlank String question, Map<String, Object> context) {}
    public record VerificationPlanRequest(@NotBlank String question) {}
    public record VerificationExecutionRequest(boolean approved) {}
}
