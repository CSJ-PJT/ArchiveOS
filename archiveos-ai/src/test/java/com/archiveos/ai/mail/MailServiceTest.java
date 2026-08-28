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
import java.util.UUID;
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
        MailProperties properties = new MailProperties(true, "csj@archiveos.kr", "ArchiveOS", "csj1116@kakao.com", "re_test", "whsec_dGVzdA==");
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

    @Test
    void mapsProviderDeliveryEventsWithoutRegressingDeliveredMail() {
        assertThat(MailService.outboundDelivery("email.sent")).isEqualTo(new MailService.DeliveryUpdate("sent", 1));
        assertThat(MailService.outboundDelivery("email.delivery_delayed")).isEqualTo(new MailService.DeliveryUpdate("delayed", 2));
        assertThat(MailService.outboundDelivery("email.delivered")).isEqualTo(new MailService.DeliveryUpdate("delivered", 3));
        assertThat(MailService.outboundDelivery("email.bounced")).isEqualTo(new MailService.DeliveryUpdate("bounced", 4));
        assertThat(MailService.outboundDelivery("email.opened")).isEqualTo(new MailService.DeliveryUpdate("delivered", 3));
        assertThat(MailService.outboundDelivery("email.received")).isNull();
    }

    @Test
    void reconcilesPendingOutboundMailFromProviderStatus() {
        when(repository.pendingOutboundProviderIds("csj@archiveos.kr", 20)).thenReturn(List.of("provider-message-123"));
        when(gateway.deliveryStatus("provider-message-123")).thenReturn("delivered");

        service.refreshOutboundDeliveryStatuses();

        verify(repository).updateOutboundStatus("provider-message-123", "delivered", 3);
    }

    @Test
    void mailboxRefreshImportsProviderMessagesMissedByWebhook() {
        when(gateway.listReceived()).thenReturn(List.of(new ResendMailGateway.ReceivedSummary(
                "provider-inbound-123", List.of("csj@archiveos.kr"), "2026-08-28T07:30:00Z")));
        when(repository.providerMessageExists("provider-inbound-123")).thenReturn(false);
        when(repository.beginForward("provider-inbound-123")).thenReturn(true);
        ResendMailGateway.ReceivedMail received = new ResendMailGateway.ReceivedMail(
                "provider-inbound-123", "sender@example.com", List.of("csj@archiveos.kr"), List.of(), List.of(),
                "동기화 확인", "본문", null, Map.of(), List.of(), "2026-08-28T07:30:00Z");
        when(gateway.receive("provider-inbound-123")).thenReturn(received);
        when(gateway.send(anyList(), anyList(), anyString(), anyString(), anyString()))
                .thenReturn(new ResendMailGateway.SentMail("provider-forward-123"));
        when(repository.list("csj@archiveos.kr", "inbox", 0, 20)).thenReturn(Map.of("items", List.of(), "total", 1));

        service.list("inbox", 0, 20);

        verify(repository).saveInbound(anyString(), any(ResendMailGateway.ReceivedMail.class), any(Instant.class));
        verify(repository).completeForward("provider-inbound-123", "provider-forward-123");
    }

    @Test
    void softDeletesSelectedMessagesWithinTheBoundedPageLimit() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        when(repository.deleteSelected("csj@archiveos.kr", List.of(first, second))).thenReturn(2);
        when(repository.unreadCount("csj@archiveos.kr")).thenReturn(1L);

        Map<String, Object> result = service.deleteSelected(List.of(first, second, first));

        assertThat(result).containsEntry("deleted", 2).containsEntry("unread", 1L);
        verify(repository).deleteSelected("csj@archiveos.kr", List.of(first, second));
    }

    @Test
    void rejectsAnUnscopedOrUnsupportedFolderDelete() {
        assertThatThrownBy(() -> service.deleteFolder("all"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inbox or sent");
        verify(repository, never()).deleteFolder(anyString(), anyString());
    }

    @Test
    void softDeletesOnlyTheRequestedFolder() {
        when(repository.deleteFolder("csj@archiveos.kr", "inbox")).thenReturn(4);
        when(repository.unreadCount("csj@archiveos.kr")).thenReturn(0L);

        Map<String, Object> result = service.deleteFolder("INBOX");

        assertThat(result).containsEntry("deleted", 4).containsEntry("unread", 0L);
        verify(repository).deleteFolder("csj@archiveos.kr", "inbox");
    }
}
