package com.archiveos.ai.mail;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MailRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public MailRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public boolean reserveWebhook(String svixId, String eventType, String providerMessageId, String payloadSha256) {
        try {
            return jdbc.update("""
                    insert into public.archive_mail_webhook_receipt(svix_id, event_type, provider_message_id, payload_sha256)
                    values (?, ?, ?, ?)
                    """, svixId, eventType, providerMessageId, payloadSha256) == 1;
        } catch (DuplicateKeyException duplicate) {
            return false;
        }
    }

    public void removeWebhookReservation(String svixId) {
        jdbc.update("delete from public.archive_mail_webhook_receipt where svix_id = ?", svixId);
    }

    public Map<String, Object> saveInbound(String mailbox, ResendMailGateway.ReceivedMail mail, Instant occurredAt) {
        return jdbc.queryForObject("""
                insert into public.archive_mail_message(
                  id, provider_message_id, direction, mailbox, from_address, to_addresses, cc_addresses,
                  reply_to_addresses, subject, text_body, html_body, headers, attachments,
                  delivery_status, is_read, occurred_at)
                values (?, ?, 'inbound', ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb, ?::jsonb, 'received', false, ?)
                on conflict (provider_message_id) do update set delivery_status = excluded.delivery_status
                returning *, to_addresses::text as to_json, cc_addresses::text as cc_json,
                  reply_to_addresses::text as reply_to_json, headers::text as headers_json,
                  attachments::text as attachments_json
                """, this::row, UUID.randomUUID(), mail.id(), mailbox, mail.from(), json(mail.to()), json(mail.cc()),
                json(mail.replyTo()), mail.subject(), mail.text(), mail.html(), json(mail.headers()), json(mail.attachments()), Timestamp.from(occurredAt));
    }

    public Map<String, Object> saveOutbound(String mailbox, String providerMessageId, String from, List<String> to,
                                             List<String> cc, String subject, String text, String html, Instant occurredAt) {
        return jdbc.queryForObject("""
                insert into public.archive_mail_message(
                  id, provider_message_id, direction, mailbox, from_address, to_addresses, cc_addresses,
                  reply_to_addresses, subject, text_body, html_body, delivery_status, is_read, occurred_at)
                values (?, ?, 'outbound', ?, ?, ?::jsonb, ?::jsonb, '[]'::jsonb, ?, ?, ?, 'sent', true, ?)
                returning *, to_addresses::text as to_json, cc_addresses::text as cc_json,
                  reply_to_addresses::text as reply_to_json, headers::text as headers_json,
                  attachments::text as attachments_json
                """, this::row, UUID.randomUUID(), providerMessageId, mailbox, from, json(to), json(cc), subject, text, html, Timestamp.from(occurredAt));
    }

    public boolean updateOutboundStatus(String providerMessageId, String status, int priority) {
        return jdbc.update("""
                update public.archive_mail_message
                   set delivery_status = ?
                 where provider_message_id = ?
                   and direction = 'outbound'
                   and (case delivery_status
                          when 'sent' then 1
                          when 'delayed' then 2
                          when 'delivered' then 3
                          when 'bounced' then 4
                          when 'failed' then 4
                          when 'suppressed' then 4
                          when 'complained' then 5
                          else 0
                        end) <= ?
                   and delivery_status <> ?
                """, status, providerMessageId, priority, status) == 1;
    }

    public Map<String, Object> list(String mailbox, String folder, int page, int size) {
        String condition = switch (folder) {
            case "inbox" -> "direction = 'inbound'";
            case "sent" -> "direction = 'outbound'";
            default -> "true";
        };
        int safeSize = Math.min(Math.max(size, 1), 50);
        int safePage = Math.max(page, 0);
        long total = jdbc.queryForObject("select count(*) from public.archive_mail_message where mailbox = ? and " + condition, Long.class, mailbox);
        List<Map<String, Object>> items = jdbc.query("""
                select *, to_addresses::text as to_json, cc_addresses::text as cc_json,
                  reply_to_addresses::text as reply_to_json, headers::text as headers_json,
                  attachments::text as attachments_json
                from public.archive_mail_message where mailbox = ? and %s
                order by occurred_at desc limit ? offset ?
                """.formatted(condition), this::summaryRow, mailbox, safeSize, safePage * safeSize);
        return Map.of("items", items, "page", safePage, "size", safeSize, "total", total,
                "unread", unreadCount(mailbox));
    }

    public Map<String, Object> find(String mailbox, UUID id) {
        List<Map<String, Object>> rows = jdbc.query("""
                select *, to_addresses::text as to_json, cc_addresses::text as cc_json,
                  reply_to_addresses::text as reply_to_json, headers::text as headers_json,
                  attachments::text as attachments_json
                from public.archive_mail_message where mailbox = ? and id = ?
                """, this::row, mailbox, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean markRead(String mailbox, UUID id, boolean read) {
        return jdbc.update("update public.archive_mail_message set is_read = ? where mailbox = ? and id = ? and direction = 'inbound'", read, mailbox, id) == 1;
    }

    public long unreadCount(String mailbox) {
        return jdbc.queryForObject("select count(*) from public.archive_mail_message where mailbox = ? and direction = 'inbound' and is_read = false", Long.class, mailbox);
    }

    private Map<String, Object> summaryRow(ResultSet rs, int index) throws SQLException {
        Map<String, Object> value = row(rs, index);
        value.remove("text_body");
        value.remove("html_body");
        value.remove("headers");
        return value;
    }

    private Map<String, Object> row(ResultSet rs, int index) throws SQLException {
        return new java.util.LinkedHashMap<>(Map.ofEntries(
                Map.entry("id", rs.getObject("id").toString()),
                Map.entry("provider_message_id", rs.getString("provider_message_id")),
                Map.entry("direction", rs.getString("direction")),
                Map.entry("mailbox", rs.getString("mailbox")),
                Map.entry("from_address", rs.getString("from_address")),
                Map.entry("to_addresses", readList(rs.getString("to_json"))),
                Map.entry("cc_addresses", readList(rs.getString("cc_json"))),
                Map.entry("reply_to_addresses", readList(rs.getString("reply_to_json"))),
                Map.entry("subject", rs.getString("subject")),
                Map.entry("text_body", nullable(rs.getString("text_body"))),
                Map.entry("html_body", nullable(rs.getString("html_body"))),
                Map.entry("headers", readMap(rs.getString("headers_json"))),
                Map.entry("attachments", readListOfMaps(rs.getString("attachments_json"))),
                Map.entry("delivery_status", rs.getString("delivery_status")),
                Map.entry("is_read", rs.getBoolean("is_read")),
                Map.entry("occurred_at", rs.getTimestamp("occurred_at").toInstant().toString()),
                Map.entry("created_at", rs.getTimestamp("created_at").toInstant().toString())
        ));
    }

    private Object nullable(String value) { return value == null ? "" : value; }
    private String json(Object value) { try { return mapper.writeValueAsString(value); } catch (JsonProcessingException error) { throw new IllegalArgumentException("Mail JSON serialization failed.", error); } }
    private List<Object> readList(String value) { return read(value, new TypeReference<List<Object>>() {}, List.of()); }
    private List<Map<String, Object>> readListOfMaps(String value) { return read(value, new TypeReference<List<Map<String, Object>>>() {}, List.of()); }
    private Map<String, Object> readMap(String value) { return read(value, new TypeReference<Map<String, Object>>() {}, Map.of()); }
    private <T> T read(String value, TypeReference<T> type, T fallback) { try { return value == null ? fallback : mapper.readValue(value, type); } catch (JsonProcessingException error) { return fallback; } }
}
