package com.archiveos.ai.mail;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
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

    public boolean providerMessageExists(String providerMessageId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select exists(select 1 from public.archive_mail_message where provider_message_id = ?)",
                Boolean.class, providerMessageId));
    }

    public boolean beginForward(String providerMessageId) {
        return jdbc.update("""
                update public.archive_mail_message
                   set forward_status = 'forwarding', forward_error = null
                 where provider_message_id = ? and direction = 'inbound' and forward_status is null
                """, providerMessageId) == 1;
    }

    public void completeForward(String providerMessageId, String forwardProviderMessageId) {
        jdbc.update("""
                update public.archive_mail_message
                   set forward_status = 'sent', forward_provider_message_id = ?, forwarded_at = now(), forward_error = null
                 where provider_message_id = ? and direction = 'inbound' and forward_status = 'forwarding'
                """, forwardProviderMessageId, providerMessageId);
    }

    public void failForward(String providerMessageId, String error) {
        jdbc.update("""
                update public.archive_mail_message
                   set forward_status = 'failed', forward_error = ?
                 where provider_message_id = ? and direction = 'inbound' and forward_status = 'forwarding'
                """, error == null ? "forwarding failed" : error.substring(0, Math.min(error.length(), 500)), providerMessageId);
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

    public List<String> pendingOutboundProviderIds(String mailbox, int limit) {
        return jdbc.queryForList("""
                select provider_message_id
                  from public.archive_mail_message
                 where mailbox = ?
                   and direction = 'outbound'
                   and deleted_at is null
                   and delivery_status in ('sent', 'delayed')
                 order by created_at desc
                 limit ?
                """, String.class, mailbox, Math.min(Math.max(limit, 1), 50));
    }

    public Map<String, Object> list(String mailbox, String folder, int page, int size, String query, String field) {
        String folderCondition = switch (folder) {
            case "inbox" -> "direction = 'inbound'";
            case "sent" -> "direction = 'outbound'";
            case "unread" -> "direction = 'inbound' and is_read = false";
            case "starred" -> "is_starred = true";
            case "attachments" -> "jsonb_array_length(attachments) > 0";
            case "trash" -> "true";
            default -> "true";
        };
        String deletionCondition = "trash".equals(folder) ? "deleted_at is not null" : "deleted_at is null";
        String searchCondition = switch (field) {
            case "subject" -> "lower(subject) like ?";
            case "sender" -> "lower(from_address) like ?";
            case "recipient" -> "lower(to_addresses::text) like ?";
            default -> "lower(subject || ' ' || from_address || ' ' || to_addresses::text) like ?";
        };
        int safeSize = Math.min(Math.max(size, 1), 50);
        int safePage = Math.max(page, 0);
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        String where = "mailbox = ? and " + deletionCondition + " and " + folderCondition
                + (normalizedQuery.isBlank() ? "" : " and " + searchCondition);
        List<Object> parameters = new java.util.ArrayList<>();
        parameters.add(mailbox);
        if (!normalizedQuery.isBlank()) parameters.add("%" + normalizedQuery + "%");
        long total = jdbc.queryForObject("select count(*) from public.archive_mail_message where " + where,
                Long.class, parameters.toArray());
        List<Object> pageParameters = new java.util.ArrayList<>(parameters);
        pageParameters.add(safeSize);
        pageParameters.add(safePage * safeSize);
        List<Map<String, Object>> items = jdbc.query("""
                select *, to_addresses::text as to_json, cc_addresses::text as cc_json,
                  reply_to_addresses::text as reply_to_json, headers::text as headers_json,
                  attachments::text as attachments_json
                from public.archive_mail_message where %s
                order by occurred_at desc limit ? offset ?
                """.formatted(where), this::summaryRow, pageParameters.toArray());
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
        return jdbc.update("update public.archive_mail_message set is_read = ? where mailbox = ? and id = ? and direction = 'inbound' and deleted_at is null", read, mailbox, id) == 1;
    }

    public int markReadSelected(String mailbox, List<UUID> ids, boolean read) {
        return updateIds("update public.archive_mail_message set is_read = ? where mailbox = ? and direction = 'inbound' and deleted_at is null and id in (%s)",
                mailbox, ids, read);
    }

    public int markStarred(String mailbox, List<UUID> ids, boolean starred) {
        return updateIds("update public.archive_mail_message set is_starred = ? where mailbox = ? and id in (%s)",
                mailbox, ids, starred);
    }

    public long unreadCount(String mailbox) {
        return jdbc.queryForObject("select count(*) from public.archive_mail_message where mailbox = ? and direction = 'inbound' and is_read = false and deleted_at is null", Long.class, mailbox);
    }

    public int deleteSelected(String mailbox, List<UUID> ids) {
        return updateIds("update public.archive_mail_message set deleted_at = now() where mailbox = ? and deleted_at is null and id in (%s)", mailbox, ids);
    }

    public int restoreSelected(String mailbox, List<UUID> ids) {
        return updateIds("update public.archive_mail_message set deleted_at = null where mailbox = ? and deleted_at is not null and id in (%s)", mailbox, ids);
    }

    public int permanentlyDeleteSelected(String mailbox, List<UUID> ids) {
        return updateIds("delete from public.archive_mail_message where mailbox = ? and deleted_at is not null and id in (%s)", mailbox, ids);
    }

    public int emptyTrash(String mailbox) {
        return jdbc.update("delete from public.archive_mail_message where mailbox = ? and deleted_at is not null", mailbox);
    }

    public int deleteFolder(String mailbox, String folder) {
        String direction = "inbox".equals(folder) ? "inbound" : "outbound";
        return jdbc.update("update public.archive_mail_message set deleted_at = now() where mailbox = ? and direction = ? and deleted_at is null", mailbox, direction);
    }

    public Map<String, Long> folderCounts(String mailbox) {
        Map<String, Object> values = jdbc.queryForMap("""
                select count(*) filter (where deleted_at is null and direction = 'inbound') as inbox,
                       count(*) filter (where deleted_at is null and direction = 'outbound') as sent,
                       count(*) filter (where deleted_at is null and direction = 'inbound' and is_read = false) as unread,
                       count(*) filter (where deleted_at is null and is_starred = true) as starred,
                       count(*) filter (where deleted_at is null and jsonb_array_length(attachments) > 0) as attachments,
                       count(*) filter (where deleted_at is not null) as trash
                  from public.archive_mail_message
                 where mailbox = ?
                """, mailbox);
        return Map.of(
                "inbox", number(values.get("inbox")), "sent", number(values.get("sent")),
                "unread", number(values.get("unread")), "starred", number(values.get("starred")),
                "attachments", number(values.get("attachments")), "trash", number(values.get("trash")));
    }

    private Map<String, Object> summaryRow(ResultSet rs, int index) throws SQLException {
        Map<String, Object> value = row(rs, index);
        value.remove("text_body");
        value.remove("html_body");
        value.remove("headers");
        return value;
    }

    private Map<String, Object> row(ResultSet rs, int index) throws SQLException {
        String textBody = nullable(rs.getString("text_body"));
        String htmlBody = nullable(rs.getString("html_body"));
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
                Map.entry("text_body", textBody),
                Map.entry("html_body", htmlBody),
                Map.entry("body_preview", preview(textBody, htmlBody)),
                Map.entry("headers", readMap(rs.getString("headers_json"))),
                Map.entry("attachments", readListOfMaps(rs.getString("attachments_json"))),
                Map.entry("delivery_status", rs.getString("delivery_status")),
                Map.entry("is_read", rs.getBoolean("is_read")),
                Map.entry("is_starred", rs.getBoolean("is_starred")),
                Map.entry("size_bytes", textBody.getBytes(StandardCharsets.UTF_8).length + htmlBody.getBytes(StandardCharsets.UTF_8).length),
                Map.entry("deleted_at", rs.getTimestamp("deleted_at") == null ? "" : rs.getTimestamp("deleted_at").toInstant().toString()),
                Map.entry("occurred_at", rs.getTimestamp("occurred_at").toInstant().toString()),
                Map.entry("created_at", rs.getTimestamp("created_at").toInstant().toString())
        ));
    }

    private String nullable(String value) { return value == null ? "" : value; }
    private String preview(String text, String html) {
        String value = text == null || text.isBlank() ? html.replaceAll("<[^>]+>", " ") : text;
        value = value.replaceAll("\\s+", " ").trim();
        return value.substring(0, Math.min(value.length(), 180));
    }
    private long number(Object value) { return value instanceof Number number ? number.longValue() : 0L; }
    private int updateIds(String sqlTemplate, String mailbox, List<UUID> ids, Object... leadingValues) {
        String placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        List<Object> parameters = new java.util.ArrayList<>();
        parameters.addAll(List.of(leadingValues));
        parameters.add(mailbox);
        parameters.addAll(ids);
        return jdbc.update(sqlTemplate.formatted(placeholders), parameters.toArray());
    }
    private String json(Object value) { try { return mapper.writeValueAsString(value); } catch (JsonProcessingException error) { throw new IllegalArgumentException("Mail JSON serialization failed.", error); } }
    private List<Object> readList(String value) { return read(value, new TypeReference<List<Object>>() {}, List.of()); }
    private List<Map<String, Object>> readListOfMaps(String value) { return read(value, new TypeReference<List<Map<String, Object>>>() {}, List.of()); }
    private Map<String, Object> readMap(String value) { return read(value, new TypeReference<Map<String, Object>>() {}, Map.of()); }
    private <T> T read(String value, TypeReference<T> type, T fallback) { try { return value == null ? fallback : mapper.readValue(value, type); } catch (JsonProcessingException error) { return fallback; } }
}
