package com.archiveos.ai;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import com.archiveos.ai.obsidian.ObsidianVaultResolver;
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
    private final ObsidianVaultResolver vaultResolver;

    public AiRuntimeController(
            ArchiveOsAiProperties properties,
            ObjectProvider<ChatModel> chatModel,
            ObjectProvider<EmbeddingModel> embeddingModel,
            ObjectProvider<VectorStore> vectorStore,
            ObsidianVaultResolver vaultResolver) {
        this.properties = properties;
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
        this.vectorStore = vectorStore;
        this.vaultResolver = vaultResolver;
    }

    @GetMapping("/api/ai/runtime")
    public Map<String, Object> runtime() {
        return Map.of(
                "module", "archiveos-ai",
                "provider", "openai",
                "openAiConfigured", properties.openAiConfigured(),
                "obsidianVaultConfigured", properties.obsidianConfigured(),
                "resolvedVaultAvailable", vaultResolver.resolveVaultPath().toFile().isDirectory(),
                "chatModelBean", chatModel.getIfAvailable() != null,
                "embeddingModelBean", embeddingModel.getIfAvailable() != null,
                "vectorStoreBean", vectorStore.getIfAvailable() != null,
                "vectorDatabase", "Supabase PostgreSQL + pgvector by default; docker-compose pgvector is local fallback");
    }
}
