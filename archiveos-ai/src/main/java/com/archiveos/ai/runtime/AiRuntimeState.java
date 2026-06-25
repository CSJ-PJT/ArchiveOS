package com.archiveos.ai.runtime;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.stereotype.Component;

@Component
public class AiRuntimeState {
    private final AtomicReference<ModelCallState> chatModel = new AtomicReference<>(ModelCallState.empty());
    private final AtomicReference<ModelCallState> embeddingModel = new AtomicReference<>(ModelCallState.empty());
    private final AtomicReference<RagExecutionState> sync = new AtomicReference<>(RagExecutionState.empty());
    private final AtomicReference<RagExecutionState> search = new AtomicReference<>(RagExecutionState.empty());
    private final AtomicReference<RagExecutionState> ask = new AtomicReference<>(RagExecutionState.empty());

    public ModelCallState chatModel() {
        return chatModel.get();
    }

    public ModelCallState embeddingModel() {
        return embeddingModel.get();
    }

    public RagExecutionState sync() {
        return sync.get();
    }

    public RagExecutionState search() {
        return search.get();
    }

    public RagExecutionState ask() {
        return ask.get();
    }

    public void recordChatSuccess(long durationMs) {
        chatModel.set(ModelCallState.success(Instant.now(), durationMs));
    }

    public void recordChatFailure(Throwable error, long durationMs) {
        chatModel.set(ModelCallState.failure(Instant.now(), durationMs, sanitize(error)));
    }

    public void recordEmbeddingSuccess(long durationMs) {
        embeddingModel.set(ModelCallState.success(Instant.now(), durationMs));
    }

    public void recordEmbeddingFailure(Throwable error, long durationMs) {
        embeddingModel.set(ModelCallState.failure(Instant.now(), durationMs, sanitize(error)));
    }

    public void recordSync(Instant startedAt, boolean success, int resultCount, Throwable error) {
        sync.set(RagExecutionState.from(startedAt, success, resultCount, 0, sanitize(error)));
    }

    public void recordSearch(Instant startedAt, boolean success, int resultCount, Throwable error) {
        search.set(RagExecutionState.from(startedAt, success, resultCount, 0, sanitize(error)));
    }

    public void recordAsk(Instant startedAt, boolean success, int resultCount, int referenceCount, Throwable error) {
        ask.set(RagExecutionState.from(startedAt, success, resultCount, referenceCount, sanitize(error)));
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

    public record ModelCallState(Instant lastSuccessAt, Instant lastFailureAt, Long lastLatencyMs, String lastError) {
        static ModelCallState empty() {
            return new ModelCallState(null, null, null, null);
        }

        static ModelCallState success(Instant at, long durationMs) {
            return new ModelCallState(at, null, durationMs, null);
        }

        static ModelCallState failure(Instant at, long durationMs, String error) {
            return new ModelCallState(null, at, durationMs, error);
        }
    }

    public record RagExecutionState(
            Instant startedAt,
            Instant finishedAt,
            Long durationMs,
            Boolean success,
            int resultCount,
            int referenceCount,
            Instant lastSuccessAt,
            String lastError) {
        static RagExecutionState empty() {
            return new RagExecutionState(null, null, null, null, 0, 0, null, null);
        }

        static RagExecutionState from(Instant startedAt, boolean success, int resultCount, int referenceCount, String error) {
            Instant finishedAt = Instant.now();
            return new RagExecutionState(
                    startedAt,
                    finishedAt,
                    Math.max(0, finishedAt.toEpochMilli() - startedAt.toEpochMilli()),
                    success,
                    resultCount,
                    referenceCount,
                    success ? finishedAt : null,
                    success ? null : error);
        }
    }
}
