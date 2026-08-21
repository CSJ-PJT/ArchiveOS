package com.archiveos.ai.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.notification.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MailServiceTest {
    @Mock MailRepository repository;
    @Mock ResendMailGateway gateway;
    @Mock NotificationService notifications;
    private MailService service;

    @BeforeEach
    void setUp() {
        MailProperties properties = new MailProperties(true, "csj@archiveos.kr", "ArchiveOS", "re_test", "whsec_dGVzdA==");
        service = new MailService(properties, repository, gateway, notifications, new ObjectMapper());
    }

    @Test
    void sendsExternalMailAndPersistsTheProviderIdentity() {
        when(gateway.send(List.of("outside@example.com"), List.of(), "운영 확인", "본문", ""))
                .thenReturn(new ResendMailGateway.SentMail("provider-message-123"));
        when(repository.saveOutbound(anyString(), anyString(), anyString(), anyList(), anyList(), anyString(), anyString(), anyString(), any(Instant.class)))
                .thenReturn(Map.of("id", "mail-1", "direction", "outbound"));

        Map<String, Object> sent = service.send(List.of("outside@example.com"), List.of(), "운영 확인", "본문", null);

        assertThat(sent).containsEntry("direction", "outbound");
        verify(repository).saveOutbound(anyString(), anyString(), anyString(), anyList(), anyList(), anyString(), anyString(), anyString(), any(Instant.class));
    }

    @Test
    void rejectsInvalidRecipientBeforeCallingProvider() {
        assertThatThrownBy(() -> service.send(List.of("not-an-email"), List.of(), "제목", "본문", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid email");
        verify(gateway, never()).send(anyList(), anyList(), anyString(), anyString(), anyString());
    }

    @Test
    void rejectsUnsignedWebhookWithoutPersistingAnything() {
        assertThatThrownBy(() -> service.receiveWebhook("{}", "message-id", "1", "invalid"))
                .isInstanceOf(MailService.InvalidWebhookException.class);
        verify(repository, never()).reserveWebhook(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void statusExposesReadinessButNeverCredentials() {
        when(repository.unreadCount("csj@archiveos.kr")).thenReturn(3L);
        when(notifications.configured("slack")).thenReturn(true);

        Map<String, Object> status = service.status();

        assertThat(status).containsEntry("mailbox", "csj@archiveos.kr")
                .containsEntry("outbound_ready", true)
                .containsEntry("inbound_ready", true)
                .containsEntry("slack_ready", true)
                .doesNotContainKeys("resend_api_key", "resend_webhook_secret");
    }
}
