package com.archiveos.ai.mail;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ResendMailGateway {
    private static final URI SEND_URI = URI.create("https://api.resend.com/emails");
    private static final URI SENT_EMAIL_URI = URI.create("https://api.resend.com/emails/");
    private static final URI RECEIVING_URI = URI.create("https://api.resend.com/emails/receiving/");
    private final MailProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient client;

    @Autowired
    public ResendMailGateway(MailProperties properties, ObjectMapper mapper) {
        this(properties, mapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    ResendMailGateway(MailProperties properties, ObjectMapper mapper, HttpClient client) {
        this.properties = properties;
        this.mapper = mapper;
        this.client = client;
    }

    public SentMail send(List<String> to, List<String> cc, String subject, String text, String html) {
        if (!properties.outboundReady()) throw new MailConfigurationException("ArchiveOS mail sending is not configured.");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", properties.displayFrom());
        body.put("to", to);
        if (!cc.isEmpty()) body.put("cc", cc);
        body.put("subject", subject);
        if (text != null && !text.isBlank()) body.put("text", text);
        if (html != null && !html.isBlank()) body.put("html", html);
        Map<String, Object> response = exchange(SEND_URI, "POST", body);
        String id = string(response.get("id"));
        if (id.isBlank()) throw new MailProviderException("Resend did not return a message id.");
        return new SentMail(id);
    }

    public ReceivedMail receive(String providerMessageId) {
        if (!properties.outboundReady()) throw new MailConfigurationException("ArchiveOS mail receiving is not configured.");
        Map<String, Object> response = exchange(RECEIVING_URI.resolve(encodePath(providerMessageId)), "GET", null);
        return new ReceivedMail(
                string(response.get("id")),
                string(response.get("from")),
                strings(response.get("to")),
                strings(response.get("cc")),
                strings(response.get("reply_to")),
                string(response.get("subject")),
                nullableString(response.get("text")),
                nullableString(response.get("html")),
                map(response.get("headers")),
                list(response.get("attachments")),
                string(response.get("created_at")));
    }

    public List<ReceivedSummary> listReceived() {
        Map<String, Object> response = exchange(URI.create("https://api.resend.com/emails/receiving"), "GET", null);
        return list(response.get("data")).stream().map(item -> new ReceivedSummary(
                string(item.get("id")), strings(item.get("to")), string(item.get("created_at"))))
                .filter(item -> !item.id().isBlank()).limit(100).toList();
    }

    public String deliveryStatus(String providerMessageId) {
        if (!properties.outboundReady()) throw new MailConfigurationException("ArchiveOS mail sending is not configured.");
        return string(exchange(SENT_EMAIL_URI.resolve(encodePath(providerMessageId)), "GET", null).get("last_event"));
    }

    private Map<String, Object> exchange(URI uri, String method, Object body) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + properties.resendApiKey())
                    .header("User-Agent", "ArchiveOS-Mail/1.0")
                    .header("Accept", "application/json");
            if (body == null) request.GET();
            else request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
            HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
            Map<String, Object> payload = mapper.readValue(response.body(), new TypeReference<>() {});
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String message = string(payload.get("message"));
                throw new MailProviderException(message.isBlank() ? "Resend request failed with status " + response.statusCode() + "." : message);
            }
            return payload;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new MailProviderException("Resend request was interrupted.", error);
        } catch (IOException error) {
            throw new MailProviderException("Resend request failed.", error);
        }
    }

    private String encodePath(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{8,128}")) throw new IllegalArgumentException("Invalid provider message id.");
        return value;
    }

    private String string(Object value) { return value == null ? "" : String.valueOf(value); }
    private String nullableString(Object value) { return value == null ? null : String.valueOf(value); }
    @SuppressWarnings("unchecked") private List<String> strings(Object value) { return value instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of(); }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    @SuppressWarnings("unchecked") private List<Map<String, Object>> list(Object value) { return value instanceof List<?> list ? list.stream().filter(Map.class::isInstance).map(item -> (Map<String, Object>) item).toList() : List.of(); }

    public record SentMail(String id) {}
    public record ReceivedSummary(String id, List<String> to, String createdAt) {}
    public record ReceivedMail(String id, String from, List<String> to, List<String> cc, List<String> replyTo,
                               String subject, String text, String html, Map<String, Object> headers,
                               List<Map<String, Object>> attachments, String createdAt) {}
    public static class MailConfigurationException extends RuntimeException { public MailConfigurationException(String message) { super(message); } }
    public static class MailProviderException extends RuntimeException {
        public MailProviderException(String message) { super(message); }
        public MailProviderException(String message, Throwable cause) { super(message, cause); }
    }
}
