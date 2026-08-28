package com.archiveos.ai.liveflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.world.WorldEventBroadcaster;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class LiveFlowRepositoryTest {
    @Test void latestBusinessEventByNodeUsesDatabaseAggregateWithoutGlobalLimitSample() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(any(String.class), any(RowMapper.class))).thenReturn(List.of());
        LiveFlowRepository repository = new LiveFlowRepository(
                jdbc,
                mock(LiveFlowEventBroadcaster.class),
                mock(WorldEventBroadcaster.class));

        repository.latestBusinessEventByNode();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class));
        assertThat(sql.getValue()).contains("group by node");
        assertThat(sql.getValue()).contains("union all");
        assertThat(sql.getValue().toLowerCase()).doesNotContain("limit");
        assertThat(sql.getValue()).contains("SERVICE_UNAVAILABLE".toLowerCase());
        assertThat(sql.getValue()).contains("SERVICE_DEGRADED".toLowerCase());
        assertThat(sql.getValue()).doesNotContain("andnot", "wherenot");
    }

    @Test
    void summaryKeepsBusinessFilterSeparatedFromSqlKeywords() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForMap(anyString())).thenReturn(Map.of());
        LiveFlowRepository repository = new LiveFlowRepository(
                jdbc, mock(LiveFlowEventBroadcaster.class), mock(WorldEventBroadcaster.class));

        repository.summary();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForMap(sql.capture());
        assertThat(sql.getValue()).doesNotContain("andnot", "wherenot");
        assertThat(sql.getValue()).containsPattern("where\\s+not\\s+\\(");
    }

    @Test
    void balancedRecentEventsRotateAcrossServicesBeforeRepeatingNoisySources() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class),
                anyInt(), anyInt(), anyInt(), anyInt(), anyInt(), anyInt(), anyInt())).thenReturn(List.of());
        LiveFlowRepository repository = new LiveFlowRepository(
                jdbc, mock(LiveFlowEventBroadcaster.class), mock(WorldEventBroadcaster.class));

        repository.recentBalanced(30);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class),
                anyInt(), anyInt(), anyInt(), anyInt(), anyInt(), anyInt(), anyInt());
        assertThat(sql.getValue())
                .contains("with service_sample as")
                .contains("partition by service_bucket")
                .contains("ranked.service_rank asc")
                .contains("source_system_id in ('archive-logistics', 'archive-logitics')")
                .contains("partition by lower(trim(coalesce(from_node, '')))")
                .doesNotContain("'runtime_activity'");
    }
}
