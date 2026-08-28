package com.archiveos.ai.audit;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import com.archiveos.ai.security.PlatformRole;
import com.archiveos.ai.security.PlatformSession;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class AdminAccessAuditServiceTest {
    @Test
    void recordsSuccessfulAdminLoginEvenForPreviouslyExcludedAddress() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AdminAccessAuditService service = new AdminAccessAuditService(jdbc);
        PlatformSession session = new PlatformSession("session-id", "csj", PlatformRole.ADMIN,
                Instant.parse("2026-08-28T11:00:00Z"), Instant.parse("2026-08-28T12:00:00Z"));

        service.recordSuccessfulLogin(session, "106.101.66.105", "Android Chrome");

        verify(jdbc).update(contains("admin_access_logs"), eq("csj"), eq("106.101.66.105"),
                eq("Android Chrome"), eq("session-id"));
    }

    @Test
    void nightlyArchiveIsIdempotentAcrossUsageAndActionSources() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(contains("from public.archiveos_usage_logs"))).thenReturn(3);
        when(jdbc.update(contains("from public.audit_logs"))).thenReturn(2);
        AdminAccessAuditService service = new AdminAccessAuditService(jdbc);

        org.assertj.core.api.Assertions.assertThat(service.archiveUsageEvents()).isEqualTo(5);
        verify(jdbc, times(2)).update(contains("on conflict (source, source_event_id) do nothing"));
    }
}
