package com.archiveos.ai.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class AtlasSsoGrantRepositoryTest {
    @Test
    void bindsAuthorizationExpiryAsSqlTimestamp() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AtlasSsoGrantRepository repository = new AtlasSsoGrantRepository(jdbc);

        repository.createCode("a".repeat(64), "admin", PlatformRole.ADMIN, "atlas",
                "https://161.33.17.84/auth/archiveos/callback", "challenge", "portal",
                Instant.parse("2026-08-31T00:00:00Z"));

        verify(jdbc).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(Timestamp.class));
    }
}
