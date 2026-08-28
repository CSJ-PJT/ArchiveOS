package com.archiveos.ai.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.contains;
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
}
