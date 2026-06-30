package com.archiveos.ai.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class KnowledgeJdbcRepositoryTest {
    @Test void reportsSchemaAvailabilityFromPostgresCatalog() {
        JdbcTemplate jdbc = org.mockito.Mockito.mock(JdbcTemplate.class);
        when(jdbc.queryForObject("select to_regclass('public.knowledge_nodes') is not null and to_regclass('public.knowledge_edges') is not null", Boolean.class)).thenReturn(true);
        assertThat(new KnowledgeJdbcRepository(jdbc).available()).isTrue();
    }

    @Test void databaseFailureDegradesInsteadOfThrowing() {
        JdbcTemplate jdbc = org.mockito.Mockito.mock(JdbcTemplate.class);
        when(jdbc.queryForObject("select to_regclass('public.knowledge_nodes') is not null and to_regclass('public.knowledge_edges') is not null", Boolean.class)).thenThrow(new IllegalStateException("offline"));
        assertThat(new KnowledgeJdbcRepository(jdbc).available()).isFalse();
    }
}
