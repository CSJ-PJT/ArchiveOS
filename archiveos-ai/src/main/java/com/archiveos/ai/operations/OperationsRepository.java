package com.archiveos.ai.operations;

import com.archiveos.ai.obsidian.Json;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OperationsRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    public OperationsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void ensureSchema() {
        jdbc.execute("""
                create table if not exists public.batch_runs (
                  id uuid primary key,
                  batch_type text not null,
                  status text not null,
                  target_date date not null,
                  summary text not null,
                  metadata jsonb not null default '{}'::jsonb,
                  created_at timestamptz not null default now()
                )
                """);
        jdbc.execute("create index if not exists batch_runs_type_date_idx on public.batch_runs(batch_type, target_date desc, created_at desc)");
        jdbc.execute("""
                create table if not exists public.daily_reports (
                  id uuid primary key,
                  target_date date not null,
                  status text not null,
                  status_reason text not null,
                  runtime_summary jsonb not null default '{}'::jsonb,
                  latest_builder jsonb,
                  latest_reviewer jsonb,
                  operator_summary jsonb not null default '{}'::jsonb,
                  warnings jsonb not null default '[]'::jsonb,
                  decisions_count integer not null default 0,
                  commands_count integer not null default 0,
                  discord_sent boolean not null default false,
                  discord_skipped_reason text,
                  slack_sent boolean not null default false,
                  slack_skipped_reason text,
                  notification_results jsonb not null default '[]'::jsonb,
                  report_text text not null,
                  created_at timestamptz not null default now()
                )
                """);
        jdbc.execute("create index if not exists daily_reports_target_date_idx on public.daily_reports(target_date desc, created_at desc)");
        jdbc.execute("""
                create table if not exists public.runtime_snapshots (
                  id uuid primary key,
                  captured_at timestamptz not null default now(),
                  inbox_count integer not null default 0,
                  processing_count integer not null default 0,
                  outbox_count integer not null default 0,
                  reviews_count integer not null default 0,
                  active_task text,
                  latest_builder jsonb,
                  latest_reviewer jsonb,
                  operators jsonb not null default '{}'::jsonb,
                  warnings jsonb not null default '[]'::jsonb,
                  source text not null
                )
                """);
        jdbc.execute("create index if not exists runtime_snapshots_captured_at_idx on public.runtime_snapshots(captured_at desc)");
    }

    public Map<String, Object> saveBatch(String type, String status, LocalDate targetDate, String summary, Map<String, Object> metadata) {
        ensureSchema();
        UUID id = UUID.randomUUID();
        return jdbc.queryForObject("""
                insert into public.batch_runs(id, batch_type, status, target_date, summary, metadata)
                values (?, ?, ?, ?, ?, ?::jsonb)
                returning id, batch_type, status, target_date, summary, metadata::text as metadata_json, created_at
                """, this::batchRow, id, type, status, targetDate, summary, Json.write(metadata));
    }

    public void saveSnapshot(Map<String, Object> summary) {
        ensureSchema();
        Map<String, Object> queue = map(summary.get("queue"));
        jdbc.update("""
                insert into public.runtime_snapshots(
                  id, inbox_count, processing_count, outbox_count, reviews_count, active_task,
                  latest_builder, latest_reviewer, operators, warnings, source)
                values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, 'nightly_review_batch')
                """,
                UUID.randomUUID(), integer(queue, "inbox"), integer(queue, "processing"), integer(queue, "outbox"), integer(queue, "reviews"),
                firstNonBlank(string(summary.get("latestInboxTask")), nestedString(summary, "latestBuilder", "task_id"), nestedString(summary, "latestReviewer", "reviewed_task_id")),
                jsonOrNull(summary.get("latestBuilder")), jsonOrNull(summary.get("latestReviewer")), Json.write(map(summary.get("operators"))), writeJson(summary.getOrDefault("warnings", List.of())));
    }

    public Map<String, Object> saveDailyReport(Map<String, Object> report) {
        ensureSchema();
        UUID id = UUID.randomUUID();
        return jdbc.queryForObject("""
                insert into public.daily_reports(
                  id, target_date, status, status_reason, runtime_summary, latest_builder, latest_reviewer,
                  operator_summary, warnings, decisions_count, commands_count, slack_sent,
                  slack_skipped_reason, notification_results, report_text)
                values (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?)
                returning *, runtime_summary::text as runtime_json, latest_builder::text as builder_json,
                  latest_reviewer::text as reviewer_json, operator_summary::text as operator_json,
                  warnings::text as warnings_json, notification_results::text as notifications_json
                """, this::dailyRow,
                id, LocalDate.parse(string(report.get("target_date"))), string(report.get("status")), string(report.get("status_reason")),
                Json.write(map(report.get("runtime_summary"))), jsonOrNull(report.get("latest_builder")), jsonOrNull(report.get("latest_reviewer")),
                Json.write(map(report.get("operator_summary"))), writeJson(report.getOrDefault("warnings", List.of())), integer(report, "decisions_count"), integer(report, "commands_count"),
                Boolean.TRUE.equals(report.get("slack_sent")), report.get("slack_skipped_reason"), writeJson(report.getOrDefault("notification_results", List.of())), string(report.get("report_text")));
    }

    public List<Map<String, Object>> recentBatches(int limit) {
        ensureSchema();
        return jdbc.query("""
                select id, batch_type, status, target_date, summary, metadata::text as metadata_json, created_at
                from public.batch_runs order by created_at desc limit ?
                """, this::batchRow, clamp(limit));
    }

    public Map<String, Object> latestBatch(String type, LocalDate targetDate) {
        ensureSchema();
        List<Map<String, Object>> rows = targetDate == null
                ? jdbc.query("""
                    select id, batch_type, status, target_date, summary, metadata::text as metadata_json, created_at
                    from public.batch_runs where batch_type = ? order by created_at desc limit 1
                    """, this::batchRow, type)
                : jdbc.query("""
                    select id, batch_type, status, target_date, summary, metadata::text as metadata_json, created_at
                    from public.batch_runs where batch_type = ? and target_date = ? order by created_at desc limit 1
                    """, this::batchRow, type, targetDate);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> recentDailyReports(int limit) {
        ensureSchema();
        return jdbc.query("""
                select *, runtime_summary::text as runtime_json, latest_builder::text as builder_json,
                  latest_reviewer::text as reviewer_json, operator_summary::text as operator_json,
                  warnings::text as warnings_json, notification_results::text as notifications_json
                from public.daily_reports order by created_at desc limit ?
                """, this::dailyRow, clamp(limit));
    }

    public Map<String, Object> latestDailyReport() {
        List<Map<String, Object>> rows = recentDailyReports(1);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> recentSnapshots(int limit) {
        ensureSchema();
        return jdbc.query("""
                select *, latest_builder::text as builder_json, latest_reviewer::text as reviewer_json,
                  operators::text as operators_json, warnings::text as warnings_json
                from public.runtime_snapshots order by captured_at desc limit ?
                """, this::snapshotRow, clamp(limit));
    }

    private Map<String, Object> batchRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString()); value.put("batch_type", rs.getString("batch_type"));
        value.put("status", rs.getString("status")); value.put("target_date", rs.getObject("target_date").toString());
        value.put("summary", rs.getString("summary")); value.put("metadata", readJson(rs.getString("metadata_json")));
        value.put("created_at", rs.getTimestamp("created_at").toInstant().toString()); return value;
    }

    private Map<String, Object> dailyRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString()); value.put("target_date", rs.getObject("target_date").toString());
        value.put("status", rs.getString("status")); value.put("status_reason", rs.getString("status_reason"));
        value.put("runtime_summary", readJson(rs.getString("runtime_json"))); value.put("latest_builder", readJson(rs.getString("builder_json")));
        value.put("latest_reviewer", readJson(rs.getString("reviewer_json"))); value.put("operator_summary", readJson(rs.getString("operator_json")));
        value.put("warnings", readJson(rs.getString("warnings_json"))); value.put("decisions_count", rs.getInt("decisions_count"));
        value.put("commands_count", rs.getInt("commands_count")); value.put("slack_sent", rs.getBoolean("slack_sent"));
        value.put("slack_skipped_reason", rs.getString("slack_skipped_reason")); value.put("notification_results", readJson(rs.getString("notifications_json")));
        value.put("report_text", rs.getString("report_text")); value.put("created_at", rs.getTimestamp("created_at").toInstant().toString()); return value;
    }

    private Map<String, Object> snapshotRow(ResultSet rs, int row) throws SQLException {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", rs.getObject("id").toString()); value.put("captured_at", rs.getTimestamp("captured_at").toInstant().toString());
        value.put("inbox_count", rs.getInt("inbox_count")); value.put("processing_count", rs.getInt("processing_count"));
        value.put("outbox_count", rs.getInt("outbox_count")); value.put("reviews_count", rs.getInt("reviews_count"));
        value.put("active_task", rs.getString("active_task")); value.put("latest_builder", readJson(rs.getString("builder_json")));
        value.put("latest_reviewer", readJson(rs.getString("reviewer_json"))); value.put("operators", readJson(rs.getString("operators_json")));
        value.put("warnings", readJson(rs.getString("warnings_json"))); value.put("source", rs.getString("source")); return value;
    }

    private Object readJson(String value) {
        if (value == null) return null;
        try { return mapper.readValue(value, Object.class); } catch (JsonProcessingException error) { return Map.of("parse_error", true); }
    }
    private String writeJson(Object value) { try { return mapper.writeValueAsString(value); } catch (JsonProcessingException error) { return "null"; } }
    private String jsonOrNull(Object value) { return value == null ? null : writeJson(value); }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of(); }
    private int integer(Map<String, Object> map, String key) { Object value = map.get(key); return value instanceof Number number ? number.intValue() : 0; }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private String nestedString(Map<String, Object> root, String objectKey, String valueKey) { return string(map(root.get(objectKey)).get(valueKey)); }
    private String firstNonBlank(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value; return null; }
    private int clamp(int limit) { return Math.min(Math.max(limit, 1), 100); }
}
