package com.archiveos.ai.obsidian;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.util.Map;
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

    public ObsidianRagController(ObsidianRagService ragService, RagRateLimitService rateLimit) {
        this.ragService = ragService;
        this.rateLimit = rateLimit;
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
        return ResponseEntity.ok(Map.of("data", ragService.search(query, limit), "status", "SEARCH_ONLY"));
    }

    @PostMapping("/api/rag/ask")
    public ResponseEntity<Map<String, Object>> ask(@Valid @RequestBody RagAskRequest request,
                                                    Principal principal,
                                                    HttpServletRequest httpRequest) {
        ResponseEntity<Map<String, Object>> blocked = limited("ask", principal, httpRequest);
        if (blocked != null) return blocked;
        return ResponseEntity.ok(Map.of("data", ragService.answer(request.question(), request.context())));
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
