package com.archiveos.ai.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@SuppressWarnings("unchecked")
class WorkflowJdbcRepositoryTest {
    @Test void listUsesPmTasksWithoutRuntimeSchemaMutation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(eq("select * from public.pm_tasks order by created_at desc"),
                org.mockito.ArgumentMatchers.<RowMapper<WorkflowTaskRecord>>any())).thenReturn(List.of());
        WorkflowJdbcRepository repository = new WorkflowJdbcRepository(jdbc);

        assertThat(repository.list()).isEmpty();

        verify(jdbc).query(eq("select * from public.pm_tasks order by created_at desc"), any(RowMapper.class));
    }

    @Test void updateRejectsFieldsOutsideTheRepositoryAllowlist() {
        WorkflowJdbcRepository repository = new WorkflowJdbcRepository(mock(JdbcTemplate.class));

        assertThatThrownBy(() -> repository.update(UUID.randomUUID(), Map.of("metadata", "unsafe")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unsupported PM task field: metadata");
    }
}
