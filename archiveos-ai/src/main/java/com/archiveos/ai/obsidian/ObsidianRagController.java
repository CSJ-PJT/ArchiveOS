package com.archiveos.ai.obsidian;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.util.Map;
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

    public ObsidianRagController(ObsidianRagService ragService) {
        this.ragService = ragService;
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
            @RequestParam(defaultValue = "10") int limit) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "query is required."));
        }
        return ResponseEntity.ok(Map.of("data", ragService.search(query, limit)));
    }

    @PostMapping("/api/rag/ask")
    public ResponseEntity<Map<String, Object>> ask(@Valid @RequestBody RagAskRequest request) {
        return ResponseEntity.ok(Map.of("data", ragService.answer(request.question())));
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

    public record RagAskRequest(@NotBlank String question) {}
}
