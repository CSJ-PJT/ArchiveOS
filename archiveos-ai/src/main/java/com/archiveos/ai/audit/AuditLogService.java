package com.archiveos.ai.audit;

import com.archiveos.ai.security.PlatformRole;
import com.archiveos.ai.security.PlatformSession;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {
    private static final Pattern TASK_PATH = Pattern.compile("/api/tasks/([0-9a-fA-F-]{36})(?:/.*)?");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public AuditLogService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Actor actor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof PlatformSession session) {
            return new Actor(session.actor(), session.role());
        }
        return new Actor("anonymous", PlatformRole.PUBLIC);
    }

    public JsonNode snapshot(String path) {
        Matcher matcher = TASK_PATH.matcher(path);
        if (!matcher.matches()) return null;
        try {
            String value = jdbc.queryForObject("select to_jsonb(t)::text from public.pm_tasks t where id = ?", String.class,
                    UUID.fromString(matcher.group(1)));
            return value == null ? null : mapper.readTree(value);
        } catch (Exception ignored) {
            return null;
        }
    }

    public void record(String method, String path, int status, String correlationId, JsonNode oldValue, JsonNode newValue) {
        Actor actor = actor();
        String resourceId = resourceId(path);
        jdbc.update("""
                insert into public.audit_logs(actor, role, action, resource_type, resource_id, correlation_id,
                    request_method, request_path, response_status, old_value, new_value)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)
                """, actor.name(), actor.role().name(), action(method, path), resourceType(path), resourceId, correlationId,
                method, path, status, json(oldValue), json(newValue));
        recordTimeline(path, status, correlationId, resourceId, actor);
    }

    public void recordEvent(String action, String resourceType, String resourceId, String correlationId, Map<String, Object> metadata) {
        Actor actor = actor();
        jdbc.update("""
                insert into public.audit_logs(actor, role, action, resource_type, resource_id, correlation_id,
                    request_method, request_path, response_status, old_value, new_value, metadata)
                values (?, ?, ?, ?, ?, ?, 'SYSTEM', ?, 200, null, null, ?::jsonb)
                """, actor.name(), actor.role().name(), action, resourceType, resourceId, correlationId,
                "/api/" + resourceType + "/" + (resourceId == null ? "" : resourceId), json(metadata));
    }

    public List<Map<String, Object>> recent(int limit) {
        return jdbc.queryForList("select * from public.audit_logs order by occurred_at desc limit ?",
                Math.max(1, Math.min(limit, 200)));
    }

    public Map<String, Object> summary() {
        return jdbc.queryForMap("""
                select count(*)::int as total,
                       count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24_hours,
                       count(*) filter (where response_status >= 400)::int as failed
                from public.audit_logs
                """);
    }

    private void recordTimeline(String path, int status, String correlationId, String resourceId, Actor actor) {
        String eventType = eventType(path);
        if (eventType == null) return;
        jdbc.update("""
                insert into public.runtime_timeline(event_type, status, title, summary, correlation_id, source, reference_id, metadata)
                values (?, ?, ?, ?, ?, 'spring-api', ?, jsonb_build_object('actor', ?, 'role', ?))
                """, eventType, status < 400 ? "success" : "failed", action("", path), path, correlationId,
                resourceId, actor.name(), actor.role().name());
    }

    private String eventType(String path) {
        if (path.contains("/decision") || path.contains("/retry")) return "approval";
        if (path.contains("/batch")) return "batch";
        if (path.contains("/knowledge") || path.contains("/obsidian") || path.contains("/rag")) return "knowledge";
        if (path.contains("/notifications")) return "slack_notification";
        if (path.contains("/tasks")) return "task";
        if (path.contains("/workflow")) return "workflow";
        if (path.contains("/architect") || path.contains("/rpa")) return "agent";
        return null;
    }

    private String resourceType(String path) {
        String[] parts = path.split("/");
        return parts.length > 2 && !parts[2].isBlank() ? parts[2] : "api";
    }

    private String resourceId(String path) {
        Matcher matcher = TASK_PATH.matcher(path);
        return matcher.matches() ? matcher.group(1) : null;
    }

    private String action(String method, String path) {
        if (path.endsWith("/decision")) return "approval_decision";
        if (path.endsWith("/retry")) return "workflow_retry";
        return method.isBlank() ? path : method.toLowerCase() + " " + path;
    }

    private String json(JsonNode node) { return node == null ? null : node.toString(); }
    private String json(Map<String, Object> map) {
        try { return mapper.writeValueAsString(map == null ? Map.of() : map); }
        catch (Exception ignored) { return "{}"; }
    }
    public record Actor(String name, PlatformRole role) {}
}
