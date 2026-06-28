package com.archiveos.ai.runtime;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import com.archiveos.ai.obsidian.ObsidianJdbcRepository;
import com.archiveos.ai.obsidian.ObsidianVaultResolver;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootVersion;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class AiRuntimeService {
    private final ArchiveOsAiProperties properties;
    private final AiModelGateway models;
    private final ObsidianJdbcRepository repository;
    private final ObsidianVaultResolver vaultResolver;
    private final AiRuntimeState state;
    private final String chatModelName;
    private final String embeddingModelName;

    public AiRuntimeService(
            ArchiveOsAiProperties properties,
            AiModelGateway models,
            ObsidianJdbcRepository repository,
            ObsidianVaultResolver vaultResolver,
            AiRuntimeState state,
            @Value("${spring.ai.openai.chat.options.model:gpt-4o-mini}") String chatModelName,
            @Value("${spring.ai.openai.embedding.options.model:text-embedding-3-small}") String embeddingModelName) {
        this.properties = properties;
        this.models = models;
        this.repository = repository;
        this.vaultResolver = vaultResolver;
        this.state = state;
        this.chatModelName = chatModelName;
        this.embeddingModelName = embeddingModelName;
    }

    public Map<String, Object> runtime() {
        Instant checkedAt = Instant.now();
        Map<String, Object> response = new LinkedHashMap<>();
        ObsidianJdbcRepository.KnowledgeStatistics stats = repository.safeKnowledgeStatistics();
        ObsidianJdbcRepository.VectorStoreDiagnostics vector = repository.safeVectorDiagnostics();
        boolean vaultReachable = vaultResolver.tryResolveVaultPath()
                .map(path -> path.toFile().isDirectory())
                .orElse(false);
        AiRuntimeState.ModelCallState chat = state.chatModel();
        AiRuntimeState.ModelCallState embedding = state.embeddingModel();
        AiRuntimeState.RagExecutionState search = state.search();
        AiRuntimeState.RagExecutionState ask = state.ask();
        AiRuntimeState.RagExecutionState sync = state.sync();

        boolean chatConfigured = properties.openAiConfigured();
        boolean chatBean = models.chatAvailable();
        boolean embeddingBean = models.embeddingAvailable();
        boolean dbConnected = vector.databaseConnected();
        boolean vectorReady = dbConnected && vector.extensionInstalled() && vector.indexReady();
        boolean ragReady = chatConfigured && chatBean && embeddingBean && vectorReady && stats.embeddedChunks() > 0;

        String status = "healthy";
        if (!chatConfigured || !properties.obsidianConfigured()) status = "degraded";
        if (!dbConnected || !chatBean || !embeddingBean) status = "unavailable";

        response.put("status", status);
        response.put("checkedAt", checkedAt.toString());
        response.put("springBoot", map("status", "up", "version", SpringBootVersion.getVersion()));
        response.put("springAi", map("status", (chatBean && embeddingBean) ? "up" : "down", "version", implementationVersion(ChatModel.class)));
        response.put("chatModel", map(
                "configured", chatConfigured,
                "beanAvailable", chatBean,
                "lastCallSucceeded", chat.lastSuccessAt() != null,
                "available", chatConfigured && chatBean,
                "provider", "openai",
                "model", chatModelName,
                "lastSuccessAt", chat.lastSuccessAt(),
                "lastError", chat.lastError()));
        response.put("embeddingModel", map(
                "configured", chatConfigured,
                "beanAvailable", embeddingBean,
                "lastCallSucceeded", embedding.lastSuccessAt() != null,
                "available", chatConfigured && embeddingBean,
                "provider", "openai",
                "model", embeddingModelName,
                "dimensions", stats.embeddingDimensions() > 0 ? stats.embeddingDimensions() : 1536,
                "lastSuccessAt", embedding.lastSuccessAt(),
                "lastError", embedding.lastError()));
        response.put("vectorStore", map(
                "available", vectorReady,
                "type", "pgvector",
                "databaseConnected", vector.databaseConnected(),
                "extensionInstalled", vector.extensionInstalled(),
                "indexType", vector.indexType(),
                "indexReady", vector.indexReady(),
                "lastError", vector.lastError()));
        response.put("knowledge", map(
                "documents", stats.documents(),
                "chunks", stats.chunks(),
                "embeddedChunks", stats.embeddedChunks(),
                "pendingEmbeddings", stats.pendingEmbeddings(),
                "failedEmbeddings", stats.failedEmbeddings(),
                "lastSyncAt", stats.lastSyncAt(),
                "lastError", stats.lastError()));
        response.put("rag", map(
                "ready", ragReady,
                "lastSearchAt", search.finishedAt(),
                "lastAskAt", ask.finishedAt(),
                "lastSyncAt", sync.finishedAt(),
                "lastSuccessAt", latest(search.lastSuccessAt(), ask.lastSuccessAt(), sync.lastSuccessAt()),
                "lastLatencyMs", ask.durationMs() != null ? ask.durationMs() : search.durationMs(),
                "lastReferenceCount", ask.referenceCount(),
                "lastSearchResultCount", search.resultCount(),
                "lastError", firstNonBlank(ask.lastError(), search.lastError(), sync.lastError())));
        response.put("obsidian", map(
                "configured", properties.obsidianConfigured(),
                "reachable", vaultReachable,
                "documentCount", stats.documents(),
                "lastSyncAt", stats.lastSyncAt()));
        return response;
    }

    public ResponseEntity<Map<String, Object>> check() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            if (!properties.openAiConfigured()) {
                throw new IllegalStateException("OPENAI_API_KEY is not configured. Runtime check skipped.");
            }
            float[] vector = models.embed("ArchiveOS runtime smoke check");
            result.put("embedding", map("success", true, "dimensions", vector.length));
        } catch (Exception error) {
            result.put("embedding", map("success", false, "error", sanitize(error)));
        }

        try {
            if (!properties.openAiConfigured()) {
                throw new IllegalStateException("OPENAI_API_KEY is not configured. Runtime check skipped.");
            }
            String text = models.chat("Reply with OK only.");
            result.put("chat", map("success", true, "response", text.trim()));
        } catch (Exception error) {
            result.put("chat", map("success", false, "error", sanitize(error)));
        }

        result.put("runtime", runtime());
        return ResponseEntity.ok(result);
    }

    private String implementationVersion(Class<?> type) {
        String version = type.getPackage().getImplementationVersion();
        return version == null || version.isBlank() ? "unknown" : version;
    }

    private Instant latest(Instant... values) {
        Instant latest = null;
        for (Instant value : values) {
            if (value != null && (latest == null || value.isAfter(latest))) latest = value;
        }
        return latest;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private String sanitize(Throwable error) {
        if (error == null) return null;
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return message
                .replaceAll("sk-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]")
                .replaceAll("password=([^\\s&]+)", "password=[redacted]");
    }

    private Map<String, Object> map(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            out.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return out;
    }
}
