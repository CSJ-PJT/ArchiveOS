package com.archiveos.ai.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class NotificationServiceTest {
    @Test void reportsSlackWithoutExposingCredentials() {
        NotificationPort slack = port("slack", true, true);
        NotificationService service = new NotificationService(List.of(slack));

        var results = service.send("운영 보고");

        assertThat(results).extracting(NotificationResult::channel).containsExactly("slack");
        assertThat(service.configuration()).containsExactlyEntriesOf(java.util.Map.of("slack", true));
        assertThat(results.toString()).doesNotContain("webhooks/").doesNotContain("hooks.slack.com").doesNotContain("xoxb-");
    }

    private NotificationPort port(String channel, boolean configured, boolean sent) {
        return new NotificationPort() {
            public String channel() { return channel; }
            public boolean configured() { return configured; }
            public NotificationResult send(String message) { return new NotificationResult(channel, configured, sent, configured ? null : "not configured"); }
        };
    }
}
