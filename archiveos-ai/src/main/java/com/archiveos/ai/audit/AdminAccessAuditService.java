package com.archiveos.ai.audit;

import com.archiveos.ai.security.PlatformRole;
import com.archiveos.ai.security.PlatformSession;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAccessAuditService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final JdbcTemplate jdbc;

    public AdminAccessAuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void recordSuccessfulLogin(PlatformSession session, String clientIp, String userAgent) {
        if (session == null || session.role() != PlatformRole.ADMIN || clientIp == null || clientIp.isBlank()) return;
        jdbc.update("""
                insert into public.admin_access_logs(actor, role, event_type, feature, route, action,
                    client_ip, user_agent, source, source_event_id)
                values (?, 'ADMIN', 'LOGIN', '로그인', '/api/auth/login', 'LOGIN_SUCCEEDED',
                    ?::inet, ?, 'AUTH_LOGIN', ?)
                on conflict (source, source_event_id) do nothing
                """, session.actor(), clientIp, truncate(userAgent, 512), session.id());
    }

    public Map<String, Object> recent(int page, int size, String requestedDate, String requestedQuery) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(10, Math.min(size, 100));
        LocalDate selectedDate = parseDate(requestedDate);
        String query = requestedQuery == null ? "" : requestedQuery.trim();
        if (query.length() > 100) throw new IllegalArgumentException("검색어는 100자 이하여야 합니다.");
        String like = "%" + query.toLowerCase(Locale.ROOT) + "%";
        Timestamp start = Timestamp.from(selectedDate.atStartOfDay(KST).toInstant());
        Timestamp end = Timestamp.from(selectedDate.plusDays(1).atStartOfDay(KST).toInstant());
        Object[] filters = { start, end, query, like, like, like, like, like };
        String where = """
                occurred_at >= ? and occurred_at < ?
                and (? = '' or lower(actor) like ? or lower(coalesce(feature, '')) like ?
                    or lower(coalesce(route, '')) like ? or lower(action) like ?
                    or lower(client_ip::text) like ?)
                """;
        Integer total = jdbc.queryForObject("select count(*)::int from public.admin_access_logs where " + where,
                Integer.class, filters);
        List<Object> args = new ArrayList<>(List.of(filters));
        args.add(safeSize);
        args.add(safePage * safeSize);
        List<Map<String, Object>> items = jdbc.queryForList("""
                select id::text as id, occurred_at, actor, role, event_type, feature, route, action,
                       client_ip::text as client_ip, user_agent, source
                  from public.admin_access_logs
                 where %s
                 order by occurred_at desc, id desc
                 limit ? offset ?
                """.formatted(where), args.toArray());
        Map<String, Object> summary = jdbc.queryForMap("""
                select count(*)::int as total,
                       count(*) filter (where event_type = 'LOGIN')::int as logins,
                       count(distinct actor)::int as accounts,
                       count(distinct client_ip)::int as unique_ips
                  from public.admin_access_logs
                 where occurred_at >= ? and occurred_at < ?
                """, start, end);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("total", total == null ? 0 : total);
        result.put("selected_date", selectedDate.toString());
        result.put("query", query);
        result.put("summary", summary);
        return result;
    }

    @Transactional
    public int archiveUsageEvents() {
        int pageViews = jdbc.update("""
                insert into public.admin_access_logs(occurred_at, actor, role, event_type, feature, route, action,
                    client_ip, user_agent, source, source_event_id)
                select occurred_at, actor, role, 'PAGE_VIEW', feature, console_route, action,
                       client_ip, user_agent, 'USAGE_LOG', id::text
                  from public.archiveos_usage_logs
                 where role = 'ADMIN'
                on conflict (source, source_event_id) do nothing
                """);
        int actions = jdbc.update("""
                insert into public.admin_access_logs(occurred_at, actor, role, event_type, feature, route, action,
                    client_ip, user_agent, source, source_event_id)
                select occurred_at, actor, role, 'API_ACTION', resource_type, request_path, action,
                       (metadata->>'clientIp')::inet, metadata->>'userAgent', 'AUDIT_LOG', id::text
                  from public.audit_logs
                 where role = 'ADMIN'
                   and metadata->>'clientIp' is not null
                   and (metadata->>'clientIp') ~ '^[0-9a-fA-F:.]+$'
                on conflict (source, source_event_id) do nothing
                """);
        return pageViews + actions;
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return LocalDate.now(KST);
        try { return LocalDate.parse(value); }
        catch (DateTimeParseException error) {
            throw new IllegalArgumentException("조회 날짜는 YYYY-MM-DD 형식이어야 합니다.");
        }
    }

    private String truncate(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
