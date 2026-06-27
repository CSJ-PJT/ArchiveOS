package com.archiveos.ai.notification;

public record NotificationResult(String channel, boolean configured, boolean sent, String reason) {
    public static NotificationResult notConfigured(String channel) {
        return new NotificationResult(channel, false, false, channel + " webhook is not configured");
    }
}
