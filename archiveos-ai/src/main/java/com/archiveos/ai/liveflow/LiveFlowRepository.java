package com.archiveos.ai.liveflow;

import com.archiveos.ai.obsidian.Json;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class LiveFlowRepository {
    private final JdbcTemplate jdbc;
    private final LiveFlowEventBroadcaster broadcaster;

    public LiveFlowRepository(JdbcTemplate jdbc, LiveFlowEventBroadcaster broadcaster) {
        this.jdbc = jdbc;
        this.broadcaster = broadcaster;
    }

    public Map<String, Object> upsert(LiveFlowEvent event) {
        List<Map<String, Object>> changed = jdbc.query("""
                insert into public.ecosystem_flow_event(
                  event_id, correlation_id, source_system_id, source_service_id, domain, event_type,
                  entity_type, entity_id, from_node, to_node, status, severity, display_label,
                  amount_bucket, occurred_at, metadata)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                on conflict (event_id) do update set
                  status = excluded.status,
                  severity = excluded.severity,
                  display_label = excluded.display_label,
                  amount_bucket = excluded.amount_bucket,
                  occurred_at = excluded.occurred_at,
                  metadata = excluded.metadata,
                  received_at = now()
                where ecosystem_flow_event.status is distinct from excluded.status
                   or ecosystem_flow_event.severity is distinct from excluded.severity
                   or ecosystem_flow_event.display_label is distinct from excluded.display_label
                   or ecosystem_flow_event.amount_bucket is distinct from excluded.amount_bucket
                   or ecosystem_flow_event.metadata is distinct from excluded.metadata
                returning *
                """, this::row,
                event.eventId(), event.correlationId(), event.sourceSystemId(), event.sourceServiceId(), event.domain(), event.eventType(),
                event.entityType(), event.entityId(), event.fromNode(), event.toNode(), event.status(), event.severity(), event.displayLabel(),
                event.amountBucket(), Timestamp.from(event.occurredAt()), Json.write(event.metadata() == null ? Map.of() : event.metadata()));
        Map<String, Object> saved = changed.stream().findFirst().orElseGet(() -> jdbc.queryForObject(
                "select * from public.ecosystem_flow_event where event_id = ?", this::row, event.eventId()));
        if (!changed.isEmpty()) broadcaster.publish(saved);
        return saved;
    }

    public List<Map<String, Object>> recent(int limit) {
        return jdbc.query("select * from public.ecosystem_flow_event order by occurred_at desc, received_at desc limit ?",
                this::row, clamp(limit));
    }

    public List<Map<String, Object>> replay(String from, String to, int limit) {
        if (from != null && !from.isBlank() && to != null && !to.isBlank()) {
            return jdbc.query("""
                    select * from public.ecosystem_flow_event
                     where occurred_at between ?::timestamptz and ?::timestamptz
                     order by occurred_at asc, id asc limit ?
                    """, this::row, from, to, clamp(limit));
        }
        return jdbc.query("select * from public.ecosystem_flow_event order by occurred_at asc, id asc limit ?",
                this::row, clamp(limit));
    }

    public List<Map<String, Object>> byCorrelation(String correlationId, int limit) {
        return jdbc.query("""
                select * from public.ecosystem_flow_event
                 where correlation_id = ? order by occurred_at asc, id asc limit ?
                """, this::row, correlationId, clamp(limit));
    }

    public List<Map<String, Object>> byEntity(String entityId, int limit) {
        return jdbc.query("""
                select * from public.ecosystem_flow_event
                 where entity_id = ? order by occurred_at asc, id asc limit ?
                """, this::row, entityId, clamp(limit));
    }

    public Map<String, Object> summary() {
        try {
            return jdbc.queryForMap("""
                    select
                      count(*) filter (where occurred_at > now() - interval '30 minutes')::int as active_flows,
                      count(*) filter (where received_at > now() - interval '24 hours')::int as recent_events,
                      count(*) filter (where status = 'approval_required')::int as pending_approvals,
                      count(*) filter (where status = 'delayed')::int as delayed_shipments,
                      count(*) filter (where event_type in ('CALLBACK_FAILED', 'ledger_callback_failed') or status = 'failed')::int as failed_callbacks,
                      count(distinct source_system_id) filter (where status = 'unavailable')::int as degraded_systems,
                      max(occurred_at) as latest_event_at
                    from public.ecosystem_flow_event
                    """);
        } catch (DataAccessException error) {
            return Map.of("active_flows", 0, "recent_events", 0, "pending_approvals", 0,
                    "delayed_shipments", 0, "failed_callbacks", 0, "degraded_systems", 0);
        }
    }

    private Map<String, Object> row(ResultSet rs, int index) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getLong("id"));
        value.put("event_id", rs.getString("event_id"));
        value.put("correlation_id", rs.getString("correlation_id"));
        value.put("source_system_id", rs.getString("source_system_id"));
        value.put("source_service_id", rs.getString("source_service_id"));
        value.put("domain", rs.getString("domain"));
        value.put("event_type", rs.getString("event_type"));
        value.put("entity_type", rs.getString("entity_type"));
        value.put("entity_id", rs.getString("entity_id"));
        value.put("from_node", rs.getString("from_node"));
        value.put("to_node", rs.getString("to_node"));
        value.put("status", rs.getString("status"));
        value.put("severity", rs.getString("severity"));
        value.put("display_label", rs.getString("display_label"));
        value.put("amount_bucket", rs.getString("amount_bucket"));
        value.put("occurred_at", instant(rs, "occurred_at"));
        value.put("received_at", instant(rs, "received_at"));
        value.put("metadata", Json.readObject(rs.getString("metadata")));
        return value;
    }

    private int clamp(int limit) { return Math.min(Math.max(limit, 1), 500); }
    private String instant(ResultSet rs, String name) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }
}
