package com.archiveos.ai.audit;

import com.archiveos.ai.security.ClientAddressResolver;
import com.archiveos.ai.security.PlatformRole;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class UsageAuditService {
    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    private static final Map<String, String> FEATURES = Map.of(
            "dashboard", "대시보드",
            "services", "서비스",
            "operations", "운영",
            "finance", "재무",
            "records", "기록",
            "mail", "메일",
            "settings", "설정"
    );

    private final JdbcTemplate jdbc;
    private final AuditLogService audit;
    private final ConcurrentHashMap<String, RateWindow> rateWindows = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> recentViews = new ConcurrentHashMap<>();

    public UsageAuditService(JdbcTemplate jdbc, AuditLogService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public RecordResult recordPageView(String requestedRoute, HttpServletRequest request) {
        String route = normalizeRoute(requestedRoute);
        String feature = FEATURES.get(route);
        if (feature == null) throw new IllegalArgumentException("지원하지 않는 ArchiveOS 화면입니다.");

        String clientIp = ClientAddressResolver.resolve(request);
        AuditLogService.Actor actor = audit.actor();
        Instant now = Instant.now();
        String rateKey = clientIp;
        if (!allow(rateKey, now)) return new RecordResult(false, true, "rate_limited");

        String duplicateKey = clientIp + "|" + actor.name() + "|" + route;
        Instant previous = recentViews.put(duplicateKey, now);
        if (previous != null && previous.plusSeconds(3).isAfter(now)) {
            return new RecordResult(false, false, "duplicate");
        }

        String userAgent = truncate(request.getHeader("User-Agent"), 512);
        boolean authenticated = actor.role() != PlatformRole.PUBLIC;
        jdbc.update("""
                insert into public.archiveos_usage_logs(actor, role, feature, console_route, action,
                    client_ip, user_agent, authenticated)
                values (?, ?, ?, ?, 'PAGE_VIEW', ?::inet, ?, ?)
                """, actor.name(), actor.role().name(), feature, route, clientIp, userAgent, authenticated);
        prune(now);
        return new RecordResult(true, false, "recorded");
    }

    public Map<String, Object> recent(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(10, Math.min(size, 100));
        int offset = safePage * safeSize;
        String union = auditUnion();
        Integer total = jdbc.queryForObject("select count(*)::int from (" + union + ") usage", Integer.class);
        List<Map<String, Object>> items = jdbc.queryForList("""
                select id, occurred_at, actor, role, feature, route, action, client_ip, user_agent,
                       authenticated, source
                  from (%s) usage
                 order by occurred_at desc, id desc
                 limit ? offset ?
                """.formatted(union), safeSize, offset);
        Map<String, Object> summary = jdbc.queryForMap("""
                select count(*)::int as total,
                       count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last_24_hours,
                       count(distinct client_ip) filter (where occurred_at >= now() - interval '24 hours')::int as unique_ips_24_hours,
                       count(*) filter (where occurred_at >= now() - interval '24 hours' and authenticated)::int as authenticated_24_hours
                  from (%s) usage
                """.formatted(union));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("total", total == null ? 0 : total);
        result.put("summary", summary);
        return result;
    }

    private String auditUnion() {
        return """
                select id::text as id, occurred_at, actor, role, feature, console_route as route, action,
                       client_ip::text as client_ip, user_agent, authenticated, 'PAGE_VIEW' as source
                  from public.archiveos_usage_logs
                union all
                select id::text as id, occurred_at, actor, role, resource_type as feature, request_path as route, action,
                       metadata->>'clientIp' as client_ip, metadata->>'userAgent' as user_agent,
                       (role <> 'PUBLIC' and actor <> 'anonymous') as authenticated, 'API_ACTION' as source
                  from public.audit_logs
                 where metadata->>'clientIp' is not null
                   and lower(coalesce(resource_type, '')) not in ('live_flow', 'live-flow')
                   and lower(coalesce(request_path, '')) not like '/api/live-flow/%'
                """;
    }

    private boolean allow(String key, Instant now) {
        Instant minute = now.truncatedTo(ChronoUnit.MINUTES);
        RateWindow updated = rateWindows.compute(key, (ignored, current) -> {
            if (current == null || !current.minute().equals(minute)) return new RateWindow(minute, 1);
            return new RateWindow(minute, current.count() + 1);
        });
        return updated.count() <= MAX_REQUESTS_PER_MINUTE;
    }

    private void prune(Instant now) {
        if (rateWindows.size() > 10_000) {
            Instant cutoff = now.minus(2, ChronoUnit.MINUTES);
            rateWindows.entrySet().removeIf(entry -> entry.getValue().minute().isBefore(cutoff));
        }
        if (recentViews.size() > 10_000) {
            Instant cutoff = now.minusSeconds(10);
            recentViews.entrySet().removeIf(entry -> entry.getValue().isBefore(cutoff));
        }
    }

    private String normalizeRoute(String value) {
        if (value == null) return "";
        return value.trim().toLowerCase(Locale.ROOT).replaceFirst("^#?/?", "").replaceAll("/+$", "");
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private record RateWindow(Instant minute, int count) { }
    public record RecordResult(boolean recorded, boolean rateLimited, String reason) { }
}
