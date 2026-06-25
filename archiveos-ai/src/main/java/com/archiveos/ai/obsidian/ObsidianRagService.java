package com.archiveos.ai.obsidian;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import com.archiveos.ai.runtime.AiRuntimeState;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
public class ObsidianRagService {
    private final ArchiveOsAiProperties properties;
    private final MarkdownVaultReader vaultReader;
    private final MarkdownChunker chunker;
    private final ObsidianVaultResolver vaultResolver;
    private final ObsidianJdbcRepository repository;
    private final ObjectProvider<EmbeddingModel> embeddingModel;
    private final ObjectProvider<ChatModel> chatModel;
    private final AiRuntimeState runtimeState;

    public ObsidianRagService(
            ArchiveOsAiProperties properties,
            MarkdownVaultReader vaultReader,
            MarkdownChunker chunker,
            ObsidianVaultResolver vaultResolver,
            ObsidianJdbcRepository repository,
            ObjectProvider<EmbeddingModel> embeddingModel,
            ObjectProvider<ChatModel> chatModel,
            AiRuntimeState runtimeState) {
        this.properties = properties;
        this.vaultReader = vaultReader;
        this.chunker = chunker;
        this.vaultResolver = vaultResolver;
        this.repository = repository;
        this.embeddingModel = embeddingModel;
        this.chatModel = chatModel;
        this.runtimeState = runtimeState;
    }

    public ObsidianSyncResult syncVault() throws IOException {
        Instant startedAt = Instant.now();
        boolean success = false;
        int embeddedTotal = 0;
        Throwable failure = null;
        try {
            requireConfigured();
            Path vaultPath = vaultResolver.resolveVaultPath();
            if (!vaultPath.toFile().isDirectory()) {
                return new ObsidianSyncResult(false, 0, 0, 0, 0, 0, 0, "OBSIDIAN_VAULT_PATH not configured");
            }

            repository.ensureSchema();
            List<MarkdownDocument> documents = vaultReader.readVault(vaultPath);
            int created = 0;
            int updated = 0;
            int skipped = 0;
            int deletedChunks = 0;
            int embeddedChunks = 0;

            for (MarkdownDocument document : documents) {
                var existing = repository.findByPath(document.relativePath());
                if (existing != null && existing.contentHash().equals(document.contentHash())) {
                    skipped += 1;
                    continue;
                }

                long documentId = repository.upsertDocument(document);
                if (existing == null) created += 1;
                else updated += 1;

                deletedChunks += repository.deleteChunks(documentId);
                List<MarkdownChunk> chunks = chunker.chunk(document.content(), properties.obsidianChunkSize(), properties.obsidianChunkOverlap());

                for (int index = 0; index < chunks.size(); index += 1) {
                    MarkdownChunk chunk = chunks.get(index);
                    float[] embedding = embed(chunk.text());
                    repository.insertChunk(documentId, index, chunk, embedding, Map.of(
                            "file_path", document.relativePath(),
                            "title", document.title(),
                            "chunk_size", chunk.text().length(),
                            "embedding_status", "embedded",
                            "embedded_at", Instant.now().toString()));
                    embeddedChunks += 1;
                    embeddedTotal += 1;
                }
            }

            success = true;
            return new ObsidianSyncResult(true, documents.size(), created, updated, skipped, deletedChunks, embeddedChunks, null);
        } catch (IOException | RuntimeException error) {
            failure = error;
            throw error;
        } finally {
            runtimeState.recordSync(startedAt, success, embeddedTotal, failure);
        }
    }

    public List<Map<String, Object>> listDocuments(int limit) {
        repository.ensureSchema();
        return repository.listDocuments(limit);
    }

    public List<RagReference> search(String query, int limit) {
        Instant startedAt = Instant.now();
        boolean success = false;
        List<RagReference> references = List.of();
        Throwable failure = null;
        try {
            requireConfigured();
            repository.ensureSchema();
            references = repository.search(embed(query), limit);
            success = true;
            return references;
        } catch (RuntimeException error) {
            failure = error;
            throw error;
        } finally {
            runtimeState.recordSearch(startedAt, success, references.size(), failure);
        }
    }

    public RagAnswer answer(String question) {
        Instant startedAt = Instant.now();
        boolean success = false;
        int referenceCount = 0;
        Throwable failure = null;
        try {
            requireConfigured();
            List<RagReference> references = search(question, properties.ragMaxReferences());
            referenceCount = references.size();
            if (references.isEmpty()) {
                success = true;
                return new RagAnswer("관련 Obsidian 문맥을 찾지 못했습니다. 먼저 /api/obsidian/sync로 문서를 동기화하세요.", List.of());
            }

            String promptText = buildPrompt(question, references);
            long chatStarted = System.currentTimeMillis();
            String answer;
            try {
                answer = chatModel.getObject().call(new Prompt(promptText)).getResult().getOutput().getText();
                runtimeState.recordChatSuccess(System.currentTimeMillis() - chatStarted);
            } catch (RuntimeException error) {
                runtimeState.recordChatFailure(error, System.currentTimeMillis() - chatStarted);
                throw error;
            }
            success = true;
            return new RagAnswer(answer, references);
        } catch (RuntimeException error) {
            failure = error;
            throw error;
        } finally {
            runtimeState.recordAsk(startedAt, success, referenceCount, referenceCount, failure);
        }
    }

    private void requireConfigured() {
        if (!properties.openAiConfigured()) {
            throw new AiUnavailableException("OPENAI_API_KEY is not configured. ArchiveOS AI RAG is disabled.");
        }
        if (embeddingModel.getIfAvailable() == null) {
            throw new AiUnavailableException("EmbeddingModel bean is unavailable. Check Spring AI OpenAI configuration.");
        }
        if (chatModel.getIfAvailable() == null) {
            throw new AiUnavailableException("ChatModel bean is unavailable. Check Spring AI OpenAI configuration.");
        }
    }

    private float[] embed(String text) {
        long started = System.currentTimeMillis();
        try {
            float[] vector = embeddingModel.getObject().embed(text);
            runtimeState.recordEmbeddingSuccess(System.currentTimeMillis() - started);
            return vector;
        } catch (RuntimeException error) {
            runtimeState.recordEmbeddingFailure(error, System.currentTimeMillis() - started);
            throw error;
        }
    }

    private String buildPrompt(String question, List<RagReference> references) {
        List<String> contexts = new ArrayList<>();
        for (int index = 0; index < references.size(); index += 1) {
            RagReference reference = references.get(index);
            contexts.add("""
                    [%d]
                    title: %s
                    path: %s
                    heading: %s
                    score: %.4f
                    content:
                    %s
                    """.formatted(
                    index + 1,
                    reference.title(),
                    reference.path(),
                    reference.heading() == null ? "" : reference.heading(),
                    reference.score(),
                    reference.chunkText()));
        }

        return """
                You are ArchiveOS AI, an operations knowledge assistant.
                Answer in Korean.
                Use only the provided Obsidian context.
                If the context is insufficient, say what is missing.
                Include concise references by title/path in the answer.

                Question:
                %s

                Context:
                %s
                """.formatted(question, String.join("\n---\n", contexts));
    }
}
