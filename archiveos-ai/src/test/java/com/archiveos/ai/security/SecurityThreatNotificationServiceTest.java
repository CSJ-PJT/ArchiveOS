package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.archiveos.ai.notification.NotificationPort;
import com.archiveos.ai.notification.NotificationResult;
import com.archiveos.ai.notification.NotificationService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class SecurityThreatNotificationServiceTest {
    @Test void sendsIdentifiedIpOnceDuringCooldownWithoutCredentials() {
        AtomicReference<String> sentMessage = new AtomicReference<>();
        NotificationPort slack = new NotificationPort() {
            public String channel() { return "slack"; }
            public boolean configured() { return true; }
            public NotificationResult send(String message) {
                sentMessage.set(message);
                return new NotificationResult("slack", true, true, null);
            }
        };
        var service = new SecurityThreatNotificationService(
                new NotificationService(List.of(slack)),
                Clock.fixed(Instant.parse("2026-08-28T02:00:00Z"), ZoneOffset.UTC));

        assertThat(service.notifyLoginLockout("203.0.113.55")).isTrue();
        assertThat(service.notifyLoginLockout("203.0.113.55")).isFalse();
        assertThat(sentMessage.get())
                .contains("식별 IP: 203.0.113.55")
                .contains("HTTP 429")
                .doesNotContain("password=")
                .doesNotContain("Bearer ");
    }
}
