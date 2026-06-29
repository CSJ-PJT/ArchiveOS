package com.archiveos.ai.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SlackNotificationAdapter implements NotificationPort {
    private final String webhookUrl;
    private final String botToken;
    private final String channel;

    public SlackNotificationAdapter(
            @Value("${archiveos.notifications.slack-webhook-url:}") String webhookUrl,
            @Value("${archiveos.notifications.slack-bot-token:}") String botToken,
            @Value("${archiveos.notifications.slack-channel:}") String channel) {
        this.webhookUrl = webhookUrl;
        this.botToken = botToken;
        this.channel = channel;
    }

    @Override public String channel() { return "slack"; }
    @Override public boolean configured() {
        return hasText(webhookUrl) || (hasText(botToken) && hasText(channel));
    }
    @Override public NotificationResult send(String message) {
        if (hasText(botToken) && hasText(channel)) {
            return WebhookNotificationSupport.sendSlackApi(botToken, channel, message);
        }
        return WebhookNotificationSupport.send(channel(), webhookUrl, "text", message);
    }

    private boolean hasText(String value) { return value != null && !value.isBlank(); }
}
