package com.archiveos.ai.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class NotificationServiceTest {
    @Test void reportsEachConfiguredChannelWithoutExposingWebhookValues() {
        NotificationPort discord = port("discord", true, true);
        NotificationPort slack = port("slack", false, false);
        NotificationService service = new NotificationService(List.of(discord, slack));

        var results = service.send("운영 보고");

        assertThat(results).extracting(NotificationResult::channel).containsExactly("discord", "slack");
        assertThat(service.configuration()).containsEntry("discord", true).containsEntry("slack", false);
        assertThat(results.toString()).doesNotContain("webhooks/").doesNotContain("hooks.slack.com");
    }

    private NotificationPort port(String channel, boolean configured, boolean sent) {
        return new NotificationPort() {
            public String channel() { return channel; }
            public boolean configured() { return configured; }
            public NotificationResult send(String message) { return new NotificationResult(channel, configured, sent, configured ? null : "not configured"); }
        };
    }
}
