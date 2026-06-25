package com.archiveos.ai.obsidian;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ObsidianJdbcRepositoryDiagnosticsTest {
    @Test
    void returnsUnavailableVectorDiagnosticsWhenDatabaseFails() {
        JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(eq("select 1"), eq(Integer.class))).thenThrow(new RuntimeException("password=secret"));
        ObsidianJdbcRepository repository = new ObsidianJdbcRepository(jdbcTemplate);

        ObsidianJdbcRepository.VectorStoreDiagnostics diagnostics = repository.safeVectorDiagnostics();

        assertThat(diagnostics.databaseConnected()).isFalse();
        assertThat(diagnostics.extensionInstalled()).isFalse();
        assertThat(diagnostics.indexReady()).isFalse();
        assertThat(diagnostics.lastError()).contains("password=[redacted]");
        assertThat(diagnostics.lastError()).doesNotContain("password=secret");
    }

    @Test
    void returnsZeroStatisticsWhenTablesAreMissing() {
        JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(any(String.class), eq(Boolean.class))).thenReturn(false);
        ObsidianJdbcRepository repository = new ObsidianJdbcRepository(jdbcTemplate);

        ObsidianJdbcRepository.KnowledgeStatistics statistics = repository.safeKnowledgeStatistics();

        assertThat(statistics.documents()).isZero();
        assertThat(statistics.chunks()).isZero();
        assertThat(statistics.embeddedChunks()).isZero();
        assertThat(statistics.lastError()).isNull();
    }
}
