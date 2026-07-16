package com.archiveos.ai.runtime;

import com.archiveos.ai.obsidian.AiUnavailableException;
import java.util.List;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
public class AiModelGateway {
    private final ObjectProvider<ChatModel> chatModel;
    private final ObjectProvider<EmbeddingModel> embeddingModel;
    private final AiRuntimeState state;

    public AiModelGateway(ObjectProvider<ChatModel> chatModel,
                          ObjectProvider<EmbeddingModel> embeddingModel,
                          AiRuntimeState state) {
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
        this.state = state;
    }

    public boolean chatAvailable() { return chatModel.getIfAvailable() != null; }
    public boolean embeddingAvailable() { return embeddingModel.getIfAvailable() != null; }

    public float[] embed(String text) {
        EmbeddingModel model = embeddingModel.getIfAvailable();
        if (model == null) throw new AiUnavailableException("EmbeddingModel bean is unavailable. Check Spring AI configuration.");
        long startedAt = System.currentTimeMillis();
        try {
            float[] vector = model.embed(text);
            state.recordEmbeddingSuccess(System.currentTimeMillis() - startedAt);
            return vector;
        } catch (RuntimeException error) {
            state.recordEmbeddingFailure(error, System.currentTimeMillis() - startedAt);
            throw error;
        }
    }

    public List<float[]> embed(List<String> texts) {
        EmbeddingModel model = embeddingModel.getIfAvailable();
        if (model == null) throw new AiUnavailableException("EmbeddingModel bean is unavailable. Check Spring AI OpenAI configuration.");
        if (texts == null || texts.isEmpty()) return List.of();
        long startedAt = System.currentTimeMillis();
        try {
            List<float[]> vectors = model.embed(texts);
            state.recordEmbeddingSuccess(System.currentTimeMillis() - startedAt);
            return vectors;
        } catch (RuntimeException error) {
            state.recordEmbeddingFailure(error, System.currentTimeMillis() - startedAt);
            throw error;
        }
    }

    public String chat(String prompt) {
        ChatModel model = chatModel.getIfAvailable();
        if (model == null) throw new AiUnavailableException("ChatModel bean is unavailable. Check Spring AI configuration.");
        long startedAt = System.currentTimeMillis();
        try {
            String text = model.call(new Prompt(prompt)).getResult().getOutput().getText();
            state.recordChatSuccess(System.currentTimeMillis() - startedAt);
            return text == null ? "" : text;
        } catch (RuntimeException error) {
            state.recordChatFailure(error, System.currentTimeMillis() - startedAt);
            throw error;
        }
    }
}
