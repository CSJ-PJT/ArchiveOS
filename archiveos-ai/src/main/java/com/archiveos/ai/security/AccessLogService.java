package com.archiveos.ai.security;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AccessLogService {
    private static final Set<String> ROUTES = Set.of(
            "root", "dashboard", "services", "operations", "finance", "records", "mail", "settings", "unknown");
    private static final int RETENTION_DAYS = 30;
    private final JdbcTemplate jdbc;

    public AccessLogService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void recordVisit(String route, String requestPath, String clientIp, String userAgent, String referer) {
        Actor actor = actor();
        String safeRoute = normalizeRoute(route);
        String safePath = limit(requestPath, 256, "/");
        String safeIp = limit(clientIp, 64, "unknown");
        String safeAgent = nullable(userAgent, 512);
        String safeReferer = nullable(referer, 512);
        jdbc.update("""
                insert into public.web_access_logs(actor, role, event_type, route, request_path, client_ip, user_agent, referer)
                select ?, ?, 'PAGE_VIEW', ?, ?, ?, ?, ?
                where not exists (
                    select 1
                    from public.web_access_logs
                    where actor = ?
                      and role = ?
                      and route = ?
                      and client_ip = ?
                      and occurred_at >= now() - interval '5 seconds'
                )
                """,
                actor.name(), actor.role().name(), safeRoute, safePath, safeIp, safeAgent, safeReferer,
                actor.name(), actor.role().name(), safeRoute, safeIp);
    }

    public List<Map<String, Object>> recent(int limit, String route) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        String safeRoute = route == null || route.isBlank() || "all".equalsIgnoreCase(route) ? null : normalizeRoute(route);
        if (safeRoute == null) {
            return jdbc.queryForList("""
                    select id, occurred_at, actor, role, event_type, route, request_path, client_ip, user_agent, referer
                    from public.web_access_logs
                    order by occurred_at desc, id desc
                    limit ?
                    """, safeLimit);
        }
        return jdbc.queryForList("""
                select id, occurred_at, actor, role, event_type, route, request_path, client_ip, user_agent, referer
                from public.web_access_logs
                where route = ?
                order by occurred_at desc, id desc
                limit ?
                """, safeRoute, safeLimit);
    }

    public Map<String, Object> summary() {
        Map<String, Object> totals = jdbc.queryForMap("""
                select count(*)::int as total,
                       count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24_hours,
                       count(distinct client_ip) filter (where occurred_at >= now() - interval '24 hours')::int as unique_ips_24h,
                       count(*) filter (where occurred_at >= now() - interval '24 hours' and role <> 'PUBLIC')::int as authenticated_24h,
                       count(*) filter (where occurred_at >= now() - interval '24 hours' and role = 'PUBLIC')::int as anonymous_24h,
                       max(occurred_at) as latest_at
                from public.web_access_logs
                """);
        List<Map<String, Object>> byRoute = jdbc.queryForList("""
                select route, count(*)::int as count, max(occurred_at) as last_seen
                from public.web_access_logs
                where occurred_at >= now() - interval '24 hours'
                group by route
                order by count(*) desc, route
                """);
        List<Map<String, Object>> activeVisitors = jdbc.queryForList("""
                select client_ip, actor, role, max(occurred_at) as last_seen, count(*)::int as visits
                from public.web_access_logs
                where occurred_at >= now() - interval '15 minutes'
                group by client_ip, actor, role
                order by max(occurred_at) desc
                limit 50
                """);
        Map<String, Object> result = new LinkedHashMap<>(totals);
        result.put("byRoute", byRoute);
        result.put("activeVisitors", activeVisitors);
        result.put("retentionDays", RETENTION_DAYS);
        return result;
    }

    public int purgeOlderThan(int retentionDays) {
        int days = Math.max(1, Math.min(retentionDays, 365));
        return jdbc.update("delete from public.web_access_logs where occurred_at < now() - make_interval(days => ?)", days);
    }

    private Actor actor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof PlatformSession session) {
            return new Actor(limit(session.actor(), 80, "anonymous"), session.role());
        }
        return new Actor("anonymous", PlatformRole.PUBLIC);
    }

    private String normalizeRoute(String route) {
        String value = route == null ? "unknown" : route.trim().toLowerCase();
        return ROUTES.contains(value) ? value : "unknown";
    }

    private String limit(String value, int max, String fallback) {
        String safe = value == null || value.isBlank() ? fallback : value.trim();
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    private String nullable(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String safe = value.trim();
        return safe.length() <= max ? safe : safe.substring(0, max);
    }

    private record Actor(String name, PlatformRole role) {}
}
