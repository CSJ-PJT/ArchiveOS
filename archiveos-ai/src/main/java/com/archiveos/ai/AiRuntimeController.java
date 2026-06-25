package com.archiveos.ai;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiRuntimeController {
    private final ArchiveOsAiProperties properties;
    private final ObjectProvider<ChatModel> chatModel;
    private final ObjectProvider<EmbeddingModel> embeddingModel;
    private final ObjectProvider<VectorStore> vectorStore;

    public AiRuntimeController(
            ArchiveOsAiProperties properties,
            ObjectProvider<ChatModel> chatModel,
            ObjectProvider<EmbeddingModel> embeddingModel,
            ObjectProvider<VectorStore> vectorStore) {
        this.properties = properties;
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
        this.vectorStore = vectorStore;
    }

    @GetMapping("/api/ai/runtime")
    public Map<String, Object> runtime() {
        return Map.of(
                "module", "archiveos-ai",
                "provider", "openai",
                "openAiConfigured", properties.openAiConfigured(),
                "obsidianVaultConfigured", properties.obsidianConfigured(),
                "chatModelBean", chatModel.getIfAvailable() != null,
                "embeddingModelBean", embeddingModel.getIfAvailable() != null,
                "vectorStoreBean", vectorStore.getIfAvailable() != null,
                "vectorDatabase", "Supabase PostgreSQL + pgvector by default; docker-compose pgvector is local fallback");
    }
}
