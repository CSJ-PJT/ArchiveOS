package com.archiveos.ai.audit;

import com.archiveos.ai.security.ClientAddressResolver;
import com.archiveos.ai.security.PlatformRole;
import com.archiveos.ai.security.UsageAddressPolicy;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UsageAuditService {
    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Set<String> ATLAS_REPORT_KEYS = Set.of(
            "schemaVersion", "targetDate", "baselineCutoff", "monitoredRequests",
            "monitoredUniqueIdentities", "statusCounts", "serviceCounts", "delivered",
            "generatedAt", "deliveredAt"
    );
    private static final Set<String> ATLAS_EVENT_BATCH_KEYS = Set.of("schemaVersion", "generatedAt", "events");
    private static final Set<String> ATLAS_EVENT_KEYS = Set.of(
            "sourceId", "occurredAt", "project", "route", "method", "status", "clientIp", "userAgent"
    );
    private static final Set<String> ACCESS_SERVICES = new LinkedHashSet<>(List.of(
            "Atlas Home/Other", "Learn Atlas", "Sketchfy Atlas", "Incruit Atlas",
            "Health Atlas", "Travel Atlas", "World Atlas", "ArchiveOS", "Archive-Market",
            "Archive-Nexus", "Archive-Logistics", "Archive-Ledger", "Archive-World"
    ));
    private static final Pattern SOURCE_ID = Pattern.compile("^[a-f0-9]{64}$");
    private static final Pattern IP_LITERAL = Pattern.compile("^[0-9a-fA-F:.]+$");
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
        if (UsageAddressPolicy.isExcluded(clientIp)) {
            return new RecordResult(false, false, "excluded_address");
        }
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
        return recent(page, size, LocalDate.now(KST).toString(), null, null);
    }

    public Map<String, Object> recent(int page, int size, String requestedDate) {
        return recent(page, size, requestedDate, null, null);
    }

    public Map<String, Object> recent(int page, int size, String requestedDate, String requestedQuery, String requestedRole) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(10, Math.min(size, 100));
        int offset = safePage * safeSize;
        LocalDate selectedDate = parseUsageDate(requestedDate);
        String query = normalizeSearch(requestedQuery);
        String role = normalizeRole(requestedRole);
        String likeQuery = "%" + query.toLowerCase(Locale.ROOT) + "%";
        Timestamp dayStart = Timestamp.from(selectedDate.atStartOfDay(KST).toInstant());
        Timestamp dayEnd = Timestamp.from(selectedDate.plusDays(1).atStartOfDay(KST).toInstant());
        String union = auditUnion();
        String filters = usageFilters();
        Object[] filterArgs = filterArgs(dayStart, dayEnd, query, likeQuery, role);
        Integer total = jdbc.queryForObject("select count(*)::int from (" + union + ") usage where " + filters,
                Integer.class, filterArgs);
        List<Object> itemArgs = new ArrayList<>(List.of(filterArgs));
        itemArgs.add(safeSize);
        itemArgs.add(offset);
        List<Map<String, Object>> items = jdbc.queryForList("""
                select id, occurred_at, actor, role, feature, route, action, client_ip, user_agent,
                       authenticated, source
                  from (%s) usage
                 where %s
                 order by occurred_at desc, id desc
                 limit ? offset ?
                """.formatted(union, filters), itemArgs.toArray());
        Map<String, Object> summary = jdbc.queryForMap("""
                select count(*)::int as total,
                       count(distinct client_ip)::int as unique_ips,
                       count(*) filter (where authenticated)::int as authenticated,
                       count(*) filter (where source = 'ATLAS_PAGE_VIEW')::int as atlas_page_views,
                       count(*) filter (where role = 'ADMIN')::int as admin_count,
                       count(*) filter (where role = 'PM')::int as pm_count,
                       count(*) filter (where role = 'OPERATOR')::int as operator_count,
                       count(*) filter (where role = 'PUBLIC')::int as public_count
                  from (%s) usage
                 where %s
                """.formatted(union, filters), filterArgs);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("page", safePage);
        result.put("size", safeSize);
        result.put("total", total == null ? 0 : total);
        result.put("selected_date", selectedDate.toString());
        result.put("filters", Map.of("query", query, "role", role));
        result.put("summary", summary);
        result.put("atlas", atlasAccessSummary(selectedDate));
        return result;
    }

    @Transactional
    public Map<String, Object> importAtlasReport(Map<String, Object> report) {
        if (report == null) throw new IllegalArgumentException("Atlas 집계 보고서가 필요합니다.");
        Set<String> unexpected = new LinkedHashSet<>(report.keySet());
        unexpected.removeAll(ATLAS_REPORT_KEYS);
        if (!unexpected.isEmpty()) throw new IllegalArgumentException("Atlas 보고서에 허용되지 않은 필드가 있습니다.");
        if (number(report.get("schemaVersion")) != 1) throw new IllegalArgumentException("지원하지 않는 Atlas 보고서 버전입니다.");

        LocalDate targetDate = date(report.get("targetDate"), "targetDate");
        Instant generatedAt = instant(report.get("generatedAt"), "generatedAt");
        Instant deliveredAt = optionalInstant(report.get("deliveredAt"), "deliveredAt");
        long requests = nonNegative(report.get("monitoredRequests"), "monitoredRequests");
        long uniqueConnections = nonNegative(report.get("monitoredUniqueIdentities"), "monitoredUniqueIdentities");
        Map<String, Object> statuses = objectMap(report.get("statusCounts"), "statusCounts");
        Map<String, Object> services = objectMap(report.get("serviceCounts"), "serviceCounts");
        if (!Set.of("2xx", "3xx", "4xx", "5xx").containsAll(statuses.keySet())
                || !statuses.keySet().containsAll(Set.of("2xx", "3xx", "4xx", "5xx"))) {
            throw new IllegalArgumentException("Atlas 응답 상태 집계 형식이 올바르지 않습니다.");
        }
        if (!ACCESS_SERVICES.containsAll(services.keySet())) {
            throw new IllegalArgumentException("등록되지 않은 Atlas 프로젝트가 보고서에 포함되어 있습니다.");
        }

        jdbc.update("""
                insert into public.atlas_access_daily_reports(target_date, generated_at, delivered_at,
                    monitored_requests, monitored_unique_connections, status_2xx, status_3xx, status_4xx, status_5xx)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (target_date) do update set
                    generated_at = excluded.generated_at,
                    delivered_at = excluded.delivered_at,
                    monitored_requests = excluded.monitored_requests,
                    monitored_unique_connections = excluded.monitored_unique_connections,
                    status_2xx = excluded.status_2xx,
                    status_3xx = excluded.status_3xx,
                    status_4xx = excluded.status_4xx,
                    status_5xx = excluded.status_5xx,
                    imported_at = now()
                """, targetDate, Timestamp.from(generatedAt), deliveredAt == null ? null : Timestamp.from(deliveredAt), requests, uniqueConnections,
                nonNegative(statuses.get("2xx"), "statusCounts.2xx"),
                nonNegative(statuses.get("3xx"), "statusCounts.3xx"),
                nonNegative(statuses.get("4xx"), "statusCounts.4xx"),
                nonNegative(statuses.get("5xx"), "statusCounts.5xx"));
        jdbc.update("delete from public.atlas_access_daily_services where target_date = ?", targetDate);
        for (String service : ACCESS_SERVICES) {
            jdbc.update("""
                    insert into public.atlas_access_daily_services(target_date, service_name, request_count)
                    values (?, ?, ?)
                    """, targetDate, service, nonNegative(services.getOrDefault(service, 0), "serviceCounts." + service));
        }
        return Map.of("imported", true, "targetDate", targetDate.toString(), "projectCount", ACCESS_SERVICES.size());
    }

    @Transactional
    public Map<String, Object> importAtlasEvents(Map<String, Object> batch) {
        if (batch == null) throw new IllegalArgumentException("Atlas 접속 이벤트 묶음이 필요합니다.");
        rejectUnexpected(batch, ATLAS_EVENT_BATCH_KEYS, "Atlas 이벤트 묶음");
        if (number(batch.get("schemaVersion")) != 1) throw new IllegalArgumentException("지원하지 않는 Atlas 이벤트 버전입니다.");
        instant(batch.get("generatedAt"), "generatedAt");
        if (!(batch.get("events") instanceof List<?> events)) throw new IllegalArgumentException("Atlas 접속 이벤트 목록이 필요합니다.");
        if (events.size() > 200) throw new IllegalArgumentException("Atlas 접속 이벤트는 한 번에 200건까지 허용됩니다.");

        int imported = 0;
        int excluded = 0;
        for (Object value : events) {
            Map<String, Object> event = objectMap(value, "events[]");
            rejectUnexpected(event, ATLAS_EVENT_KEYS, "Atlas 접속 이벤트");
            String sourceId = requiredText(event.get("sourceId"), "sourceId", 64);
            if (!SOURCE_ID.matcher(sourceId).matches()) throw new IllegalArgumentException("sourceId 형식이 올바르지 않습니다.");
            Instant occurredAt = instant(event.get("occurredAt"), "occurredAt");
            String project = requiredText(event.get("project"), "project", 80);
            if (!ACCESS_SERVICES.contains(project)) throw new IllegalArgumentException("등록되지 않은 Atlas/Archive 프로젝트입니다.");
            String route = requiredText(event.get("route"), "route", 512);
            if (!route.startsWith("/") || route.contains("\n") || route.contains("\r")) throw new IllegalArgumentException("route 형식이 올바르지 않습니다.");
            String method = requiredText(event.get("method"), "method", 8).toUpperCase(Locale.ROOT);
            if (!Set.of("GET", "HEAD").contains(method)) throw new IllegalArgumentException("페이지 조회 메서드만 허용됩니다.");
            long status = nonNegative(event.get("status"), "status");
            if (status < 100 || status > 599) throw new IllegalArgumentException("status 값이 올바르지 않습니다.");
            String clientIp = requiredText(event.get("clientIp"), "clientIp", 64);
            validateIp(clientIp);
            if (UsageAddressPolicy.isExcluded(clientIp)) {
                excluded += 1;
                continue;
            }
            String userAgent = truncate(event.get("userAgent") == null ? null : String.valueOf(event.get("userAgent")), 512);
            String action = route.startsWith("/api/") ? "API_READ" : "PAGE_VIEW";
            imported += jdbc.update("""
                    insert into public.atlas_access_events(id, source_event_id, occurred_at, project_name,
                        route, action, client_ip, user_agent, http_status)
                    values (?, ?, ?, ?, ?, ?, ?::inet, ?, ?)
                    on conflict (source_event_id) do update set
                        project_name = excluded.project_name,
                        route = excluded.route,
                        action = excluded.action,
                        http_status = excluded.http_status
                    where atlas_access_events.project_name is distinct from excluded.project_name
                       or atlas_access_events.route is distinct from excluded.route
                       or atlas_access_events.action is distinct from excluded.action
                       or atlas_access_events.http_status is distinct from excluded.http_status
                    """, UUID.randomUUID(), sourceId, Timestamp.from(occurredAt), project, route, action, clientIp, userAgent, (int) status);
        }
        return Map.of("accepted", events.size(), "imported", imported,
                "duplicates", events.size() - imported - excluded, "excluded", excluded);
    }

    private Map<String, Object> atlasAccessSummary(LocalDate selectedDate) {
        List<Map<String, Object>> reports = jdbc.queryForList("""
                select target_date, generated_at, delivered_at, monitored_requests,
                       monitored_unique_connections, status_2xx, status_3xx, status_4xx, status_5xx
                  from public.atlas_access_daily_reports
                 order by target_date desc
                 limit 31
                """);
        List<Map<String, Object>> projects = jdbc.queryForList("""
                select s.service_name, s.request_count
                  from public.atlas_access_daily_services s
                 where s.target_date = ?
                 order by s.request_count desc, s.service_name
                """, selectedDate);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("reports", reports);
        result.put("projects", projects);
        result.put("privacy", "aggregate_only");
        return result;
    }

    private LocalDate parseUsageDate(String value) {
        if (value == null || value.isBlank()) return LocalDate.now(KST);
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException error) {
            throw new IllegalArgumentException("조회 날짜는 YYYY-MM-DD 형식이어야 합니다.");
        }
    }

    private String normalizeSearch(String value) {
        if (value == null || value.isBlank()) return "";
        String normalized = value.trim();
        if (normalized.length() > 100) throw new IllegalArgumentException("검색어는 100자 이하여야 합니다.");
        return normalized;
    }

    private String normalizeRole(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) return "";
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ADMIN", "PM", "OPERATOR", "PUBLIC").contains(normalized)) {
            throw new IllegalArgumentException("조회할 계정 권한이 올바르지 않습니다.");
        }
        return normalized;
    }

    private String usageFilters() {
        return """
                occurred_at >= ? and occurred_at < ?
                and (? = '' or lower(coalesce(actor, '')) like ?
                    or lower(coalesce(feature, '')) like ?
                    or lower(coalesce(route, '')) like ?
                    or lower(coalesce(action, '')) like ?
                    or lower(coalesce(client_ip, '')) like ?)
                and (? = '' or upper(coalesce(role, '')) = ?)
                """;
    }

    private Object[] filterArgs(Timestamp dayStart, Timestamp dayEnd, String query, String likeQuery, String role) {
        return new Object[] { dayStart, dayEnd, query, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, role, role };
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
                union all
                select id::text as id, occurred_at, actor, role, project_name as feature, route, action,
                       client_ip::text as client_ip, user_agent, authenticated,
                       case when action = 'API_READ' then 'ATLAS_API_READ' else 'ATLAS_PAGE_VIEW' end as source
                  from public.atlas_access_events
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> objectMap(Object value, String label) {
        if (!(value instanceof Map<?, ?> source)) throw new IllegalArgumentException(label + " 집계가 필요합니다.");
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
    }

    private int number(Object value) {
        return value instanceof Number number ? number.intValue() : -1;
    }

    private void rejectUnexpected(Map<String, Object> source, Set<String> allowed, String label) {
        Set<String> unexpected = new LinkedHashSet<>(source.keySet());
        unexpected.removeAll(allowed);
        if (!unexpected.isEmpty()) throw new IllegalArgumentException(label + "에 허용되지 않은 필드가 있습니다.");
    }

    private String requiredText(Object value, String label, int maxLength) {
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(label + " 값이 필요합니다.");
        String text = String.valueOf(value).trim();
        if (text.length() > maxLength) throw new IllegalArgumentException(label + " 값이 너무 깁니다.");
        return text;
    }

    private void validateIp(String value) {
        if (!IP_LITERAL.matcher(value).matches()) throw new IllegalArgumentException("clientIp 형식이 올바르지 않습니다.");
        try { InetAddress.getByName(value); }
        catch (UnknownHostException error) { throw new IllegalArgumentException("clientIp 형식이 올바르지 않습니다."); }
    }

    private long nonNegative(Object value, String label) {
        if (!(value instanceof Number number) || number.longValue() < 0) {
            throw new IllegalArgumentException(label + " 값이 올바르지 않습니다.");
        }
        return number.longValue();
    }

    private LocalDate date(Object value, String label) {
        try { return LocalDate.parse(String.valueOf(value)); }
        catch (RuntimeException error) { throw new IllegalArgumentException(label + " 날짜가 올바르지 않습니다."); }
    }

    private Instant instant(Object value, String label) {
        try { return Instant.parse(String.valueOf(value)); }
        catch (RuntimeException error) { throw new IllegalArgumentException(label + " 시각이 올바르지 않습니다."); }
    }

    private Instant optionalInstant(Object value, String label) {
        return value == null ? null : instant(value, label);
    }

    private record RateWindow(Instant minute, int count) { }
    public record RecordResult(boolean recorded, boolean rateLimited, String reason) { }
}
