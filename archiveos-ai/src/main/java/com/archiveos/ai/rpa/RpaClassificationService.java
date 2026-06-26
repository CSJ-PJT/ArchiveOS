package com.archiveos.ai.rpa;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import com.archiveos.ai.obsidian.Json;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Locale;
import java.util.Map;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Service
public class RpaClassificationService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private final ArchiveOsAiProperties properties;
    private final ObjectProvider<ChatModel> chatModel;
    private final ObjectMapper objectMapper;

    public RpaClassificationService(
            ArchiveOsAiProperties properties,
            ObjectProvider<ChatModel> chatModel,
            ObjectMapper objectMapper) {
        this.properties = properties;
        this.chatModel = chatModel;
        this.objectMapper = objectMapper;
    }

    public RpaClassification classify(RpaTaskRecord task) {
        if (!properties.openAiConfigured() || chatModel.getIfAvailable() == null) {
            return RpaRuleClassifier.classify(task, "rule_based_fallback", "Spring AI ChatModel is not configured.");
        }

        try {
            String response = chatModel.getObject().call(new Prompt(buildPrompt(task))).getResult().getOutput().getText();
            return parseAiResponse(task, response);
        } catch (RuntimeException error) {
            return RpaRuleClassifier.classify(task, "rule_based_fallback_after_ai_error", sanitize(error));
        }
    }

    private String buildPrompt(RpaTaskRecord task) {
        return """
                You are ArchiveOS Architect/RPA classifier.
                Classify the task before any execution. Do not approve execution directly.
                Return strict JSON only with these fields:
                category: one of architecture_review, data_operation, execution_control, batch_operation, knowledge_operation, general_operations
                riskLevel: one of low, medium, high
                recommendation: one of PROCEED_WITH_LOGGING, REVIEW_BEFORE_EXECUTION, PM_APPROVAL_REQUIRED, HOLD
                approvalRequired: boolean
                summary: Korean one sentence explaining the decision

                Rules:
                - shell, MCP execution, Codex control, deployment, git push, destructive DB work, secrets => high risk and PM_APPROVAL_REQUIRED.
                - schema, batch, pgvector, RAG, database, report sending => medium risk unless destructive.
                - visibility-only documentation or read-only checks => low risk.

                Task title:
                %s

                Target project:
                %s

                Description:
                %s
                """.formatted(task.title(), task.targetProject() == null ? "" : task.targetProject(), task.description());
    }

    private RpaClassification parseAiResponse(RpaTaskRecord task, String response) {
        try {
            String json = extractJson(response);
            Map<String, Object> parsed = objectMapper.readValue(json, MAP_TYPE);
            String category = readAllowed(parsed.get("category"), "general_operations");
            String risk = readRisk(parsed.get("riskLevel"));
            String recommendation = readRecommendation(parsed.get("recommendation"), risk);
            boolean approvalRequired = Boolean.TRUE.equals(parsed.get("approvalRequired")) || "high".equals(risk) || "medium".equals(risk);
            String summary = readText(parsed.get("summary"), "Spring AI가 작업을 분류했으며 PM 승인 정책에 따라 기록했습니다.");
            return new RpaClassification(category, risk, recommendation, approvalRequired, summary, "spring_ai_chat_model", null, Map.of(
                    "ai_response_shape", parsed.keySet(),
                    "raw_response_hash", Integer.toHexString(response == null ? 0 : response.hashCode())));
        } catch (Exception error) {
            return RpaRuleClassifier.classify(task, "rule_based_fallback_after_parse_error", sanitize(error));
        }
    }

    private String extractJson(String value) {
        if (value == null) throw new IllegalArgumentException("AI response was empty.");
        int start = value.indexOf('{');
        int end = value.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalArgumentException("AI response did not contain a JSON object.");
        return value.substring(start, end + 1);
    }

    private String readAllowed(Object value, String fallback) {
        String text = readText(value, fallback).toLowerCase(Locale.ROOT);
        return switch (text) {
            case "architecture_review", "data_operation", "execution_control", "batch_operation", "knowledge_operation", "general_operations" -> text;
            default -> fallback;
        };
    }

    private String readRisk(Object value) {
        String text = readText(value, "medium").toLowerCase(Locale.ROOT);
        return switch (text) {
            case "low", "medium", "high" -> text;
            default -> "medium";
        };
    }

    private String readRecommendation(Object value, String risk) {
        String text = readText(value, risk.equals("high") ? "PM_APPROVAL_REQUIRED" : "REVIEW_BEFORE_EXECUTION");
        return switch (text) {
            case "PROCEED_WITH_LOGGING", "REVIEW_BEFORE_EXECUTION", "PM_APPROVAL_REQUIRED", "HOLD" -> text;
            default -> risk.equals("low") ? "PROCEED_WITH_LOGGING" : "REVIEW_BEFORE_EXECUTION";
        };
    }

    private String readText(Object value, String fallback) {
        return value instanceof String text && !text.isBlank() ? text.trim() : fallback;
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
}
