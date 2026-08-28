package com.archiveos.ai.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos.mail")
public record MailProperties(
        boolean enabled,
        String address,
        String senderName,
        String forwardTo,
        String resendApiKey,
        String resendWebhookSecret) {

    public String normalizedAddress() {
        return address == null ? "" : address.trim().toLowerCase();
    }

    public String displayFrom() {
        String normalizedName = senderName == null || senderName.isBlank() ? "ArchiveOS" : senderName.trim();
        return normalizedName + " <" + normalizedAddress() + ">";
    }

    public String normalizedForwardTo() {
        return forwardTo == null ? "" : forwardTo.trim().toLowerCase();
    }

    public boolean forwardingReady() {
        return outboundReady() && !normalizedForwardTo().isBlank();
    }

    public boolean outboundReady() {
        return enabled && !normalizedAddress().isBlank() && resendApiKey != null && !resendApiKey.isBlank();
    }

    public boolean inboundReady() {
        return outboundReady() && resendWebhookSecret != null && !resendWebhookSecret.isBlank();
    }
}
