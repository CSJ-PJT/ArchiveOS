package com.archiveos.ai.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SlackNotificationAdapter implements NotificationPort {
    private final String webhookUrl;

    public SlackNotificationAdapter(@Value("${archiveos.notifications.slack-webhook-url:}") String webhookUrl) {
        this.webhookUrl = webhookUrl;
    }

    @Override public String channel() { return "slack"; }
    @Override public boolean configured() { return webhookUrl != null && !webhookUrl.isBlank(); }
    @Override public NotificationResult send(String message) {
        return WebhookNotificationSupport.send(channel(), webhookUrl, "text", message);
    }
}
