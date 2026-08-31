package com.archiveos.ai.liveflow;

import com.archiveos.ai.obsidian.Json;
import com.archiveos.ai.world.WorldEventBroadcaster;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

@Repository
public class LiveFlowRepository {
    private static final Logger log = LoggerFactory.getLogger(LiveFlowRepository.class);
    private final JdbcTemplate jdbc;
    private final LiveFlowEventBroadcaster broadcaster;
    private final WorldEventBroadcaster worldBroadcaster;
    // Keep explicit boundary spaces: several text-block queries concatenate
    // this predicate after SQL keywords such as AND and WHERE.
    private static final String DASHBOARD_EVENT_FILTER = " " + """
            not (
              lower(coalesce(event_type, '')) like '%heartbeat%' or
              lower(coalesce(event_type, '')) like '%health%' or
              lower(coalesce(event_type, '')) like '%availability%' or
              lower(coalesce(event_type, '')) like '%collector%' or
              lower(coalesce(event_type, '')) in ('service_unavailable', 'service_degraded') or
              lower(coalesce(event_type, '')) like '%system%' or
              lower(coalesce(metadata->>'eventCategory', '')) in ('heartbeat', 'health', 'availability', 'collector', 'system')
            )
            """ + " ";
    // Runtime activity evidence keeps the service-balanced dashboard current, but it is
    // deliberately not business throughput and must not affect operational counters.
    private static final String BUSINESS_EVENT_FILTER = " " + """
            not (
              lower(coalesce(event_type, '')) like '%heartbeat%' or
              lower(coalesce(event_type, '')) like '%health%' or
              lower(coalesce(event_type, '')) like '%availability%' or
              lower(coalesce(event_type, '')) like '%collector%' or
              lower(coalesce(event_type, '')) in ('service_unavailable', 'service_degraded') or
              lower(coalesce(event_type, '')) like '%system%' or
              lower(coalesce(metadata->>'eventCategory', '')) in
                ('heartbeat', 'health', 'availability', 'collector', 'system', 'runtime_activity')
            )
            """ + " ";

    public LiveFlowRepository(JdbcTemplate jdbc, LiveFlowEventBroadcaster broadcaster, WorldEventBroadcaster worldBroadcaster) {
        this.jdbc = jdbc;
        this.broadcaster = broadcaster;
        this.worldBroadcaster = worldBroadcaster;
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
        if (!changed.isEmpty()) {
            broadcaster.publish(saved);
            worldBroadcaster.publishRuntimeEvent(saved);
        }
        return saved;
    }

    public List<Map<String, Object>> recent(int limit) {
        return jdbc.query("select * from public.ecosystem_flow_event order by occurred_at desc, received_at desc limit ?",
                this::row, clamp(limit));
    }

    /**
     * Service- and route-balanced dashboard sample; chronological record views keep using recent().
     *
     * A high-volume source (normally Ledger) must not occupy the first dashboard page while
     * real events from the other Archive services are still available. Events remain newest-first
     * inside each service round, and the route cap prevents one path from dominating a service.
     */
    public List<Map<String, Object>> recentBalanced(int limit) {
        int safeLimit = clamp(limit);
        int perRoute = Math.max(1, Math.min(6, safeLimit / 8 + 1));
        int perService = Math.max(12, Math.min(100, safeLimit * 2));
        return jdbc.query("""
                with service_sample as (
                    (select event.*, 'market' as service_bucket
                       from public.ecosystem_flow_event event
                      where source_system_id = 'archive-market' and %1$s
                      order by occurred_at desc, received_at desc, id desc limit ?)
                    union all
                    (select event.*, 'nexus' as service_bucket
                       from public.ecosystem_flow_event event
                      where source_system_id = 'archive-nexus' and %1$s
                      order by occurred_at desc, received_at desc, id desc limit ?)
                    union all
                    (select event.*, 'logistics' as service_bucket
                       from public.ecosystem_flow_event event
                      where source_system_id in ('archive-logistics', 'archive-logitics') and %1$s
                      order by occurred_at desc, received_at desc, id desc limit ?)
                    union all
                    (select event.*, 'ledger' as service_bucket
                       from public.ecosystem_flow_event event
                      where source_system_id = 'archive-ledger' and %1$s
                      order by occurred_at desc, received_at desc, id desc limit ?)
                    union all
                    (select event.*, 'archiveos' as service_bucket
                       from public.ecosystem_flow_event event
                      where source_system_id in ('archiveos', 'archive-os') and %1$s
                      order by occurred_at desc, received_at desc, id desc limit ?)
                ), ranked as (
                    select service_sample.*,
                           row_number() over (
                             partition by service_bucket
                             order by occurred_at desc, received_at desc, id desc
                           ) as service_rank,
                           row_number() over (
                             partition by lower(trim(coalesce(from_node, ''))), lower(trim(coalesce(to_node, '')))
                             order by occurred_at desc, received_at desc, id desc
                           ) as route_rank
                      from service_sample
                )
                select ranked.*
                  from ranked
                 where ranked.route_rank <= ?
                 order by ranked.service_rank asc,
                          case when ranked.service_bucket = 'other' then 1 else 0 end asc,
                          ranked.occurred_at desc,
                          ranked.received_at desc,
                          ranked.id desc
                  limit ?
                """.formatted(DASHBOARD_EVENT_FILTER), this::row,
                perService, perService, perService, perService, perService, perRoute, safeLimit);
    }

    public boolean existsEventId(String eventId) {
        Integer count = jdbc.queryForObject("select count(*) from public.ecosystem_flow_event where event_id = ?", Integer.class, eventId);
        return count != null && count > 0;
    }

    /** Returns persisted events strictly after a Last-Event-ID in receive order. */
    public List<Map<String, Object>> findAfterEventId(String eventId, int limit) {
        return jdbc.query("""
                select current_event.* from public.ecosystem_flow_event current_event
                join public.ecosystem_flow_event checkpoint on checkpoint.event_id = ?
                 where current_event.received_at > checkpoint.received_at
                    or (current_event.received_at = checkpoint.received_at and current_event.id > checkpoint.id)
                 order by current_event.received_at asc, current_event.id asc
                 limit ?
                """, this::row, eventId, clampReplayLimit(limit));
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
            String sql = """
                    select
                      (select count(distinct event_id)::int from public.ecosystem_flow_event
                        where occurred_at > now() - interval '30 minutes' and %1$s) as active_flows,
                      (select count(*)::int from public.ecosystem_flow_event
                        where occurred_at > now() - interval '24 hours' and %1$s) as recent_events,
                      (select count(*)::int from public.ecosystem_flow_event
                        where occurred_at > now() - interval '24 hours' and lower(status) = 'approval_required') as pending_approvals,
                      (select count(*)::int from public.ecosystem_flow_event
                        where occurred_at > now() - interval '24 hours' and lower(status) = 'delayed') as delayed_shipments,
                      (select count(*)::int from public.ecosystem_flow_event
                        where occurred_at > now() - interval '24 hours'
                          and (event_type in ('CALLBACK_FAILED', 'ledger_callback_failed') or lower(status) = 'failed')) as failed_callbacks,
                      (select count(*)::int from public.ecosystem_flow_event
                        where lower(status) = 'approval_required') as historical_pending_approvals,
                      (select count(*)::int from public.ecosystem_flow_event
                        where lower(status) = 'delayed') as historical_delayed_shipments,
                      (select count(*)::int from public.ecosystem_flow_event
                        where event_type in ('CALLBACK_FAILED', 'ledger_callback_failed') or lower(status) = 'failed') as historical_failed_callbacks,
                      (select count(*)::int from (
                         select distinct on (lower(source_system_id)) lower(status) as latest_status
                           from public.ecosystem_flow_event
                          where source_system_id is not null
                          order by lower(source_system_id), occurred_at desc, id desc
                       ) latest_source where latest_status = 'unavailable') as degraded_systems,
                      (select count(distinct source_system_id)::int from public.ecosystem_flow_event
                        where lower(status) = 'unavailable') as historical_degraded_systems,
                      (select occurred_at from public.ecosystem_flow_event
                        where %1$s order by occurred_at desc, received_at desc, id desc limit 1) as latest_event_at
                    """.formatted(BUSINESS_EVENT_FILTER);
            return jdbc.queryForMap(sql);
        } catch (DataAccessException error) {
            log.warn("Business-event summary query failed; falling back to persisted event totals", error);
            try {
                return jdbc.queryForMap("""
                        select
                          count(distinct event_id) filter (where occurred_at > now() - interval '30 minutes')::int as active_flows,
                          count(*) filter (where occurred_at > now() - interval '24 hours')::int as recent_events,
                          count(*) filter (where occurred_at > now() - interval '24 hours' and lower(status) = 'approval_required')::int as pending_approvals,
                          count(*) filter (where occurred_at > now() - interval '24 hours' and lower(status) = 'delayed')::int as delayed_shipments,
                          count(*) filter (where occurred_at > now() - interval '24 hours' and (event_type in ('CALLBACK_FAILED', 'ledger_callback_failed') or lower(status) = 'failed'))::int as failed_callbacks,
                          count(*) filter (where lower(status) = 'approval_required')::int as historical_pending_approvals,
                          count(*) filter (where lower(status) = 'delayed')::int as historical_delayed_shipments,
                          count(*) filter (where event_type in ('CALLBACK_FAILED', 'ledger_callback_failed') or lower(status) = 'failed')::int as historical_failed_callbacks,
                          (select count(*)::int from (
                             select distinct on (lower(source_system_id)) lower(status) as latest_status
                               from public.ecosystem_flow_event
                              where source_system_id is not null
                              order by lower(source_system_id), occurred_at desc, id desc
                           ) latest_source where latest_status = 'unavailable') as degraded_systems,
                          count(distinct source_system_id) filter (where lower(status) = 'unavailable')::int as historical_degraded_systems,
                          max(occurred_at) as latest_event_at
                        from public.ecosystem_flow_event
                        """);
            } catch (DataAccessException fallbackError) {
                log.error("Persisted event summary fallback failed", fallbackError);
                return Map.of("active_flows", 0, "recent_events", 0, "pending_approvals", 0,
                        "delayed_shipments", 0, "failed_callbacks", 0, "degraded_systems", 0,
                        "historical_degraded_systems", 0,
                        "historical_pending_approvals", 0, "historical_delayed_shipments", 0,
                        "historical_failed_callbacks", 0);
            }
        }
    }

    public Long businessEventCountByNode(String sourceSystem, long minutes) {
        try {
            Long value = jdbc.queryForObject("""
                select count(distinct event_id)
                  from public.ecosystem_flow_event
                 where source_system_id = ?
                   and occurred_at > now() - (?::int || ' minutes')::interval
                   and """ + BUSINESS_EVENT_FILTER + """
                """, Long.class, sourceSystem, minutes);
            return value == null ? 0L : value;
        } catch (DataAccessException error) {
            return 0L;
        }
    }

    public Instant lastBusinessEventAtByNode(String sourceSystem) {
        try {
            return queryInstant("""
                select max(occurred_at)
                  from public.ecosystem_flow_event
                 where source_system_id = ?
                   and """ + BUSINESS_EVENT_FILTER + """
                """, sourceSystem);
        } catch (DataAccessException error) {
            return null;
        }
    }

    public List<Map<String, Object>> latestBusinessEvents(int limit) {
        try {
            return jdbc.query("""
                    select * from public.ecosystem_flow_event
                     where """ + BUSINESS_EVENT_FILTER + """
                     order by occurred_at desc, id desc
                     limit ?
                """, this::row, Math.max(1, Math.min(limit, 200)));
        } catch (DataAccessException error) {
            return List.of();
        }
    }

    public Map<String, Instant> latestBusinessEventByNode() {
        try {
            List<Map<String, Object>> rows = jdbc.query("""
                    with node_aliases(raw_node, node) as (values
                        ('market', 'market'), ('archive-market', 'market'),
                        ('nexus', 'nexus'), ('archive-nexus', 'nexus'),
                        ('logistics', 'logistics'), ('archive-logistics', 'logistics'),
                        ('ledger', 'ledger'), ('archive-ledger', 'ledger'),
                        ('archiveos', 'archiveos'), ('ARCHIVE_OS', 'archiveos'),
                        ('settlement', 'settlement')
                    ), node_latest as (
                        select aliases.node,
                               greatest(from_event.occurred_at, to_event.occurred_at) as occurred_at
                          from node_aliases aliases
                          left join lateral (
                              select occurred_at
                                from public.ecosystem_flow_event
                               where from_node = aliases.raw_node and """ + BUSINESS_EVENT_FILTER + """
                               order by occurred_at desc, id desc
                               limit 1
                          ) from_event on true
                          left join lateral (
                              select occurred_at
                                from public.ecosystem_flow_event
                               where to_node = aliases.raw_node and """ + BUSINESS_EVENT_FILTER + """
                               order by occurred_at desc, id desc
                               limit 1
                          ) to_event on true
                    )
                    select node, max(occurred_at) as latest_event_at
                      from node_latest
                     where occurred_at is not null
                     group by node
                    """, (rs, index) -> {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("node", rs.getString("node"));
                        row.put("latest_event_at", rs.getTimestamp("latest_event_at").toInstant());
                        return row;
                    });
            Map<String, Instant> value = new LinkedHashMap<>();
            for (Map<String, Object> row : rows) {
                Object occurred = row.get("latest_event_at");
                if (occurred instanceof Instant instant) value.put(String.valueOf(row.get("node")), instant);
            }
            return value;
        } catch (DataAccessException error) {
            return Map.of();
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
    private int clampReplayLimit(int limit) { return Math.min(Math.max(limit, 1), 250); }
    private String instant(ResultSet rs, String name) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(name);
        return timestamp == null ? null : timestamp.toInstant().toString();
    }

    private Instant queryInstant(String sql, Object... args) {
        try {
            Object value = jdbc.queryForObject(sql, Object.class, args);
            if (value == null) return null;
            if (value instanceof Timestamp timestamp) return timestamp.toInstant();
            if (value instanceof Instant instant) return instant;
            return Instant.parse(String.valueOf(value));
        } catch (Exception error) {
            return null;
        }
    }
}
