package com.archiveos.ai.mail;

import com.archiveos.ai.notification.NotificationResult;
import com.archiveos.ai.notification.NotificationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.svix.Webhook;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class MailService {
    private static final Pattern EMAIL = Pattern.compile("^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\\.[A-Z]{2,63}$", Pattern.CASE_INSENSITIVE);
    private final MailProperties properties;
    private final MailRepository repository;
    private final ResendMailGateway gateway;
    private final NotificationService notifications;
    private final ObjectMapper mapper;

    public MailService(MailProperties properties, MailRepository repository, ResendMailGateway gateway,
                       NotificationService notifications, ObjectMapper mapper) {
        this.properties = properties;
        this.repository = repository;
        this.gateway = gateway;
        this.notifications = notifications;
        this.mapper = mapper;
    }

    public Map<String, Object> status() {
        return Map.of(
                "enabled", properties.enabled(),
                "mailbox", properties.normalizedAddress(),
                "outbound_ready", properties.outboundReady(),
                "inbound_ready", properties.inboundReady(),
                "slack_ready", notifications.configured("slack"),
                "unread", properties.normalizedAddress().isBlank() ? 0 : repository.unreadCount(properties.normalizedAddress()));
    }

    public Map<String, Object> list(String folder, int page, int size) {
        requireMailbox();
        String normalizedFolder = folder == null ? "inbox" : folder.trim().toLowerCase(Locale.ROOT);
        if (!List.of("inbox", "sent", "all").contains(normalizedFolder)) throw new IllegalArgumentException("folder must be inbox, sent, or all.");
        return repository.list(properties.normalizedAddress(), normalizedFolder, page, size);
    }

    public Map<String, Object> get(UUID id) {
        requireMailbox();
        Map<String, Object> message = repository.find(properties.normalizedAddress(), id);
        if (message == null) throw new MailNotFoundException();
        return message;
    }

    public Map<String, Object> markRead(UUID id, boolean read) {
        requireMailbox();
        if (!repository.markRead(properties.normalizedAddress(), id, read)) throw new MailNotFoundException();
        return Map.of("id", id, "read", read, "unread", repository.unreadCount(properties.normalizedAddress()));
    }

    public Map<String, Object> send(List<String> to, List<String> cc, String subject, String text, String html) {
        requireMailbox();
        List<String> recipients = normalizeEmails(to, true);
        List<String> copies = normalizeEmails(cc, false);
        String safeSubject = required(subject, "subject", 200);
        String safeText = optional(text, 500_000);
        String safeHtml = optional(html, 500_000);
        if (safeText.isBlank() && safeHtml.isBlank()) throw new IllegalArgumentException("text or html body is required.");
        ResendMailGateway.SentMail sent = gateway.send(recipients, copies, safeSubject, safeText, safeHtml);
        return repository.saveOutbound(properties.normalizedAddress(), sent.id(), properties.normalizedAddress(),
                recipients, copies, safeSubject, safeText, safeHtml, Instant.now());
    }

    public WebhookOutcome receiveWebhook(String rawBody, String svixId, String svixTimestamp, String svixSignature) {
        if (!properties.inboundReady()) throw new ResendMailGateway.MailConfigurationException("ArchiveOS mail receiving is not configured.");
        if (blank(svixId) || blank(svixTimestamp) || blank(svixSignature)) throw new InvalidWebhookException("Missing webhook signature headers.");
        try {
            new Webhook(properties.resendWebhookSecret()).verify(rawBody, Map.of(
                    "svix-id", List.of(svixId),
                    "svix-timestamp", List.of(svixTimestamp),
                    "svix-signature", List.of(svixSignature)));
        } catch (Exception error) {
            throw new InvalidWebhookException("Invalid webhook signature.");
        }
        JsonNode event = parse(rawBody);
        String type = event.path("type").asText("");
        String providerMessageId = event.path("data").path("email_id").asText("");
        if (!repository.reserveWebhook(svixId, type, providerMessageId, sha256(rawBody))) return new WebhookOutcome(true, false, "duplicate");
        DeliveryUpdate delivery = outboundDelivery(type);
        if (delivery != null) {
            boolean updated = repository.updateOutboundStatus(providerMessageId, delivery.status(), delivery.priority());
            return new WebhookOutcome(false, false, updated ? "delivery_status_updated" : "delivery_status_unchanged");
        }
        if (!"email.received".equals(type)) return new WebhookOutcome(false, false, "ignored_event");
        try {
            ResendMailGateway.ReceivedMail mail = gateway.receive(providerMessageId);
            if (mail.to().stream().map(this::normalizeAddress).noneMatch(properties.normalizedAddress()::equals)) {
                return new WebhookOutcome(false, false, "unrouted_address");
            }
            repository.saveInbound(properties.normalizedAddress(), mail, instant(mail.createdAt()));
            List<NotificationResult> slack = notifications.send(slackMessage(mail));
            boolean notified = slack.stream().anyMatch(result -> "slack".equals(result.channel()) && result.sent());
            return new WebhookOutcome(false, notified, "stored");
        } catch (RuntimeException error) {
            repository.removeWebhookReservation(svixId);
            throw error;
        }
    }

    @Scheduled(fixedDelayString = "${archiveos.mail.status-refresh-ms:30000}")
    public void refreshOutboundDeliveryStatuses() {
        if (!properties.outboundReady() || properties.normalizedAddress().isBlank()) return;
        for (String providerMessageId : repository.pendingOutboundProviderIds(properties.normalizedAddress(), 20)) {
            try {
                DeliveryUpdate delivery = outboundDelivery("email." + gateway.deliveryStatus(providerMessageId));
                if (delivery != null) repository.updateOutboundStatus(providerMessageId, delivery.status(), delivery.priority());
            } catch (RuntimeException ignored) {
                // Provider/webhook delivery is retried on the next bounded refresh cycle.
            }
        }
    }

    private String slackMessage(ResendMailGateway.ReceivedMail mail) {
        return "[ArchiveOS 메일 수신]\n"
                + "받는 계정: " + properties.normalizedAddress() + "\n"
                + "보낸 사람: " + compact(mail.from(), 180) + "\n"
                + "제목: " + compact(mail.subject(), 240) + "\n"
                + "첨부: " + mail.attachments().size() + "개\n"
                + "ArchiveOS 관리자 메일함에서 본문을 확인하세요.";
    }

    static DeliveryUpdate outboundDelivery(String eventType) {
        return switch (eventType == null ? "" : eventType) {
            case "email.sent" -> new DeliveryUpdate("sent", 1);
            case "email.delivery_delayed" -> new DeliveryUpdate("delayed", 2);
            case "email.delivered" -> new DeliveryUpdate("delivered", 3);
            case "email.opened", "email.clicked" -> new DeliveryUpdate("delivered", 3);
            case "email.bounced" -> new DeliveryUpdate("bounced", 4);
            case "email.failed" -> new DeliveryUpdate("failed", 4);
            case "email.suppressed" -> new DeliveryUpdate("suppressed", 4);
            case "email.complained" -> new DeliveryUpdate("complained", 5);
            default -> null;
        };
    }

    private List<String> normalizeEmails(List<String> values, boolean required) {
        List<String> result = values == null ? List.of() : values.stream().map(this::normalizeAddress).filter(value -> !value.isBlank()).distinct().toList();
        if (required && result.isEmpty()) throw new IllegalArgumentException("At least one recipient is required.");
        if (result.size() > 10) throw new IllegalArgumentException("A maximum of 10 recipients is allowed.");
        if (result.stream().anyMatch(value -> !EMAIL.matcher(value).matches())) throw new IllegalArgumentException("Invalid email address.");
        return result;
    }

    private String normalizeAddress(String value) {
        if (value == null) return "";
        String trimmed = value.trim().toLowerCase(Locale.ROOT);
        int left = trimmed.lastIndexOf('<');
        int right = trimmed.lastIndexOf('>');
        return left >= 0 && right > left ? trimmed.substring(left + 1, right).trim() : trimmed;
    }

    private String required(String value, String name, int max) {
        String normalized = optional(value, max);
        if (normalized.isBlank()) throw new IllegalArgumentException(name + " is required.");
        return normalized;
    }
    private String optional(String value, int max) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() > max) throw new IllegalArgumentException("Mail content is too large.");
        return normalized;
    }
    private String compact(String value, int max) { String normalized = value == null ? "(없음)" : value.replaceAll("[\\r\\n]+", " ").trim(); return normalized.length() <= max ? normalized : normalized.substring(0, max) + "…"; }
    private Instant instant(String value) { try { return Instant.parse(value); } catch (DateTimeParseException error) { return Instant.now(); } }
    private JsonNode parse(String value) { try { return mapper.readTree(value); } catch (JsonProcessingException error) { throw new InvalidWebhookException("Invalid webhook payload."); } }
    private String sha256(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); } }
    private String requireMailbox() { if (!properties.enabled() || properties.normalizedAddress().isBlank()) throw new ResendMailGateway.MailConfigurationException("ArchiveOS mailbox is disabled."); return properties.normalizedAddress(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }

    public record WebhookOutcome(boolean duplicate, boolean slackNotified, String status) {}
    record DeliveryUpdate(String status, int priority) {}
    public static class MailNotFoundException extends RuntimeException {}
    public static class InvalidWebhookException extends RuntimeException { public InvalidWebhookException(String message) { super(message); } }
}
