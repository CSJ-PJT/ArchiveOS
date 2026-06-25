package com.archiveos.ai;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

@Component
public class AiSmokeRunner implements ApplicationRunner {
    private final ApplicationContext context;
    private final ArchiveOsAiProperties properties;
    private final ObjectProvider<ChatModel> chatModel;
    private final ObjectProvider<EmbeddingModel> embeddingModel;

    public AiSmokeRunner(
            ApplicationContext context,
            ArchiveOsAiProperties properties,
            ObjectProvider<ChatModel> chatModel,
            ObjectProvider<EmbeddingModel> embeddingModel) {
        this.context = context;
        this.properties = properties;
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!args.containsOption("archiveos.ai-smoke")) {
            return;
        }

        if (!properties.openAiConfigured()) {
            System.out.println("ARCHIVEOS_AI_SMOKE openaiConfigured=false");
            SpringApplication.exit(context, () -> 2);
            return;
        }

        ChatModel chat = chatModel.getIfAvailable();
        EmbeddingModel embedding = embeddingModel.getIfAvailable();

        if (chat == null || embedding == null) {
            System.out.println("ARCHIVEOS_AI_SMOKE beansAvailable=false");
            SpringApplication.exit(context, () -> 3);
            return;
        }

        String answer = chat.call(new Prompt("Reply with exactly: ArchiveOS AI smoke OK"))
                .getResult()
                .getOutput()
                .getText();
        float[] vector = embedding.embed("ArchiveOS vector smoke test");

        System.out.println("ARCHIVEOS_AI_SMOKE chatOk=" + answer.toLowerCase().contains("archiveos"));
        System.out.println("ARCHIVEOS_AI_SMOKE embeddingDimension=" + vector.length);
        SpringApplication.exit(context, () -> 0);
    }
}
