package com.archiveos.ai.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DiscordNotificationAdapter implements NotificationPort {
    private final String webhookUrl;

    public DiscordNotificationAdapter(@Value("${archiveos.notifications.discord-webhook-url:}") String webhookUrl) {
        this.webhookUrl = webhookUrl;
    }

    @Override public String channel() { return "discord"; }
    @Override public boolean configured() { return webhookUrl != null && !webhookUrl.isBlank(); }
    @Override public NotificationResult send(String message) {
        return WebhookNotificationSupport.send(channel(), webhookUrl, "content", message);
    }
}
