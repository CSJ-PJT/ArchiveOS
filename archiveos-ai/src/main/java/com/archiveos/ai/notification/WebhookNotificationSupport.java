package com.archiveos.ai.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

final class WebhookNotificationSupport {
    private static final HttpClient CLIENT = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WebhookNotificationSupport() {}

    static NotificationResult send(String channel, String webhookUrl, String payloadKey, String message) {
        if (webhookUrl == null || webhookUrl.isBlank()) return NotificationResult.notConfigured(channel);
        try {
            String payload = MAPPER.writeValueAsString(Map.of(payloadKey, truncate(message, 1900)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl.trim()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return new NotificationResult(channel, true, true, null);
            }
            return new NotificationResult(channel, true, false, channel + " webhook returned HTTP " + response.statusCode());
        } catch (Exception error) {
            return new NotificationResult(channel, true, false, sanitize(error.getMessage()));
        }
    }

    static NotificationResult sendSlackApi(String botToken, String slackChannel, String message) {
        if (botToken == null || botToken.isBlank() || slackChannel == null || slackChannel.isBlank()) {
            return NotificationResult.notConfigured("slack");
        }
        try {
            String payload = MAPPER.writeValueAsString(Map.of(
                    "channel", slackChannel.trim(),
                    "text", truncate(message, 39000)));
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://slack.com/api/chat.postMessage"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + botToken.trim())
                    .header("Content-Type", "application/json; charset=utf-8")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode body = MAPPER.readTree(response.body());
            if (response.statusCode() >= 200 && response.statusCode() < 300 && body.path("ok").asBoolean(false)) {
                return new NotificationResult("slack", true, true, null);
            }
            String error = body.path("error").asText("HTTP " + response.statusCode());
            return new NotificationResult("slack", true, false, "Slack API delivery failed: " + sanitize(error));
        } catch (Exception error) {
            return new NotificationResult("slack", true, false, sanitize(error.getMessage()));
        }
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String sanitize(String value) {
        if (value == null || value.isBlank()) return "notification delivery failed";
        return value
                .replaceAll("https://hooks\\.slack\\.com/services/[^\\s]+", "[redacted-slack-webhook]")
                .replaceAll("xox[baprs]-[A-Za-z0-9-]+", "[redacted-slack-token]")
                .replaceAll("sk-proj-[A-Za-z0-9_-]+", "[redacted-openai-key]");
    }
}
