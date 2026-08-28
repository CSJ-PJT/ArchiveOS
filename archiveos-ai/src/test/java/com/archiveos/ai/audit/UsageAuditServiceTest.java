package com.archiveos.ai.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.security.PlatformRole;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

class UsageAuditServiceTest {
    @Test
    void usageViewExcludesLiveFlowAutomationFromHumanActivity() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class))).thenReturn(0);
        when(jdbc.queryForList(anyString(), eq(25), eq(0))).thenReturn(java.util.List.of());
        when(jdbc.queryForMap(anyString())).thenReturn(java.util.Map.of());
        UsageAuditService service = new UsageAuditService(jdbc, mock(AuditLogService.class));

        service.recent(0, 25);

        ArgumentCaptor<String> totalSql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForObject(totalSql.capture(), eq(Integer.class));
        assertThat(totalSql.getValue())
                .contains("not in ('live_flow', 'live-flow')")
                .contains("not like '/api/live-flow/%'");
    }

    @Test
    void recordsCanonicalPageViewWithServerResolvedAddress() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditLogService audit = mock(AuditLogService.class);
        when(audit.actor()).thenReturn(new AuditLogService.Actor("archiveos-admin", PlatformRole.ADMIN));
        UsageAuditService service = new UsageAuditService(jdbc, audit);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Real-IP", "203.0.113.21");
        request.addHeader("User-Agent", "ArchiveOS-Test-Browser");

        service.recordPageView("#/settings", request);

        verify(jdbc).update(contains("archiveos_usage_logs"), eq("archiveos-admin"), eq("ADMIN"),
                eq("설정"), eq("settings"), eq("203.0.113.21"), eq("ArchiveOS-Test-Browser"), eq(true));
    }

    @Test
    void rejectsUnknownRoutesWithoutWriting() {
        UsageAuditService service = new UsageAuditService(mock(JdbcTemplate.class), mock(AuditLogService.class));
        assertThatThrownBy(() -> service.recordPageView("../../private", new MockHttpServletRequest()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("지원하지 않는");
    }

    @Test
    void importsAggregateOnlyAtlasReportAndCreatesEveryProjectRow() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UsageAuditService service = new UsageAuditService(jdbc, mock(AuditLogService.class));
        java.util.Map<String, Object> report = new java.util.LinkedHashMap<>();
        report.put("schemaVersion", 1);
        report.put("targetDate", "2026-08-27");
        report.put("generatedAt", "2026-08-27T15:10:03.399Z");
        report.put("deliveredAt", "2026-08-27T15:10:04.088Z");
        report.put("monitoredRequests", 18);
        report.put("monitoredUniqueIdentities", 4);
        report.put("statusCounts", java.util.Map.of("2xx", 15, "3xx", 1, "4xx", 2, "5xx", 0));
        report.put("serviceCounts", java.util.Map.of("Learn Atlas", 7, "Health Atlas", 11));

        java.util.Map<String, Object> result = service.importAtlasReport(report);

        assertThat(result).containsEntry("imported", true).containsEntry("projectCount", 13);
        verify(jdbc).update(contains("atlas_access_daily_reports"), any(), any(), any(), eq(18L), eq(4L),
                eq(15L), eq(1L), eq(2L), eq(0L));
        verify(jdbc, org.mockito.Mockito.times(13)).update(contains("atlas_access_daily_services"), any(), anyString(), any());
    }

    @Test
    void rejectsAtlasReportContainingIdentityDetail() {
        UsageAuditService service = new UsageAuditService(mock(JdbcTemplate.class), mock(AuditLogService.class));
        java.util.Map<String, Object> report = new java.util.LinkedHashMap<>();
        report.put("schemaVersion", 1);
        report.put("topIdentities", java.util.List.of("접속-ABCDEF"));

        assertThatThrownBy(() -> service.importAtlasReport(report))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("허용되지 않은 필드");
    }

    @Test
    void importsAtlasHumanPageViewWithAdminOnlyNetworkEvidence() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(contains("atlas_access_events"), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        UsageAuditService service = new UsageAuditService(jdbc, mock(AuditLogService.class));
        java.util.Map<String, Object> event = new java.util.LinkedHashMap<>();
        event.put("sourceId", "a".repeat(64));
        event.put("occurredAt", "2026-08-28T06:04:27Z");
        event.put("project", "Learn Atlas");
        event.put("route", "/learn/backend-study/");
        event.put("method", "GET");
        event.put("status", 200);
        event.put("clientIp", "203.0.113.21");
        event.put("userAgent", "Atlas-Test-Chrome");

        java.util.Map<String, Object> result = service.importAtlasEvents(java.util.Map.of(
                "schemaVersion", 1,
                "generatedAt", "2026-08-28T06:10:00Z",
                "events", java.util.List.of(event)));

        assertThat(result).containsEntry("accepted", 1).containsEntry("imported", 1).containsEntry("duplicates", 0);
        verify(jdbc).update(contains("atlas_access_events"), any(), eq("a".repeat(64)), any(), eq("Learn Atlas"),
                eq("/learn/backend-study/"), eq("203.0.113.21"), eq("Atlas-Test-Chrome"), eq(200));
    }

    @Test
    void rejectsAtlasEventWithUnexpectedIdentityFields() {
        UsageAuditService service = new UsageAuditService(mock(JdbcTemplate.class), mock(AuditLogService.class));
        java.util.Map<String, Object> event = new java.util.LinkedHashMap<>();
        event.put("sourceId", "b".repeat(64));
        event.put("occurredAt", "2026-08-28T06:04:27Z");
        event.put("project", "ArchiveOS");
        event.put("route", "/archiveos/");
        event.put("method", "GET");
        event.put("status", 200);
        event.put("clientIp", "203.0.113.21");
        event.put("identityDigest", "forbidden");

        assertThatThrownBy(() -> service.importAtlasEvents(java.util.Map.of(
                "schemaVersion", 1, "generatedAt", "2026-08-28T06:10:00Z", "events", java.util.List.of(event))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("허용되지 않은 필드");
    }
}
