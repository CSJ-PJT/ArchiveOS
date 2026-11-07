package com.archiveos.ai.managed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

import com.archiveos.ai.approval.ExternalApprovalRepository;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

class ManagedSystemsPostgresIntegrationTest {
    private static final String INBOX_ID = "daily-report-report-1";

    private JdbcTemplate jdbc;
    private ManagedSystemsRepository repository;
    private TransactionTemplate transactions;

    @BeforeEach
    void setUp() {
        String url = requiredProperty("archiveos.pgtest.url");
        DataSource dataSource = new DriverManagerDataSource(url,
                System.getProperty("archiveos.pgtest.user", "postgres"),
                System.getProperty("archiveos.pgtest.password", ""));
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                create table if not exists public.pm_inbox_item_states (
                  id text primary key,
                  status text not null check (status in ('open', 'acknowledged', 'resolved')),
                  acknowledged_at timestamptz,
                  resolved_at timestamptz,
                  updated_at timestamptz not null default now(),
                  metadata jsonb not null default '{}'::jsonb
                )
                """);
        jdbc.execute("""
                create table if not exists public.runtime_timeline (
                  id bigserial primary key,
                  event_type text not null,
                  status text not null,
                  title text not null,
                  summary text,
                  project_id text,
                  source text,
                  reference_id text,
                  metadata jsonb not null default '{}'::jsonb
                )
                """);
        jdbc.update("delete from public.runtime_timeline");
        jdbc.update("delete from public.pm_inbox_item_states");
        repository = new ManagedSystemsRepository(jdbc);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from public.runtime_timeline");
        jdbc.update("delete from public.pm_inbox_item_states");
    }

    @Test
    void acknowledgeAndResolveUseQualifiedPostgresUpsertAndPreserveTimestamps() {
        ManagedSystemsService service = inboxService();

        Map<String, Object> acknowledged = inTransaction(() -> service.acknowledge(INBOX_ID));
        String acknowledgedAt = (String) acknowledged.get("acknowledged_at");
        assertThat(acknowledged).containsEntry("status", "acknowledged");
        assertThat(acknowledgedAt).isNotNull();
        assertThat(acknowledged.get("resolved_at")).isNull();

        Map<String, Object> resolved = inTransaction(() -> service.resolve(INBOX_ID));
        assertThat(resolved).containsEntry("status", "resolved");
        assertThat(resolved.get("acknowledged_at")).isEqualTo(acknowledgedAt);
        assertThat(resolved.get("resolved_at")).isInstanceOf(String.class);
        assertThat(timelineCount(INBOX_ID)).isEqualTo(2);
    }

    @Test
    void repeatedAcknowledgementAndResolutionAreIdempotentAndDoNotDuplicateTimeline() {
        ManagedSystemsService service = inboxService();

        Map<String, Object> acknowledged = inTransaction(() -> service.acknowledge(INBOX_ID));
        Map<String, Object> acknowledgedAgain = inTransaction(() -> service.acknowledge(INBOX_ID));
        assertThat(acknowledgedAgain).isEqualTo(acknowledged);
        assertThat(timelineCount(INBOX_ID)).isEqualTo(1);

        Map<String, Object> resolved = inTransaction(() -> service.resolve(INBOX_ID));
        Map<String, Object> resolvedAgain = inTransaction(() -> service.resolve(INBOX_ID));
        Map<String, Object> afterResolvedAcknowledgement = inTransaction(() -> service.acknowledge(INBOX_ID));
        assertThat(resolvedAgain).isEqualTo(resolved);
        assertThat(afterResolvedAcknowledgement).isEqualTo(resolved);
        assertThat(timelineCount(INBOX_ID)).isEqualTo(2);
    }

    @Test
    void newResolutionSucceedsAndExistingMetadataIsMerged() {
        Map<String, Object> resolved = repository.updateInboxState("new-resolution", "resolved", Map.of("newKey", "newValue"));
        assertThat(resolved).containsEntry("status", "resolved");
        assertThat(resolved.get("acknowledged_at")).isNull();
        assertThat(resolved.get("resolved_at")).isInstanceOf(String.class);

        repository.updateInboxState("metadata-item", "acknowledged", Map.of("preserved", "value"));
        Map<String, Object> merged = repository.updateInboxState("metadata-item", "resolved", Map.of("newKey", "newValue"));
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = (Map<String, Object>) merged.get("metadata");
        assertThat(metadata).containsEntry("preserved", "value").containsEntry("newKey", "newValue");
    }

    @Test
    void failedTransactionLeavesNeitherInboxStateNorTimeline() {
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
            repository.updateInboxState("rollback-item", "acknowledged", Map.of("action", "test"));
            repository.recordTimeline("approval", "success", "rollback", "rollback", "archive-os", "rollback-item", Map.of());
            throw new IllegalStateException("rollback");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(repository.inboxState("rollback-item")).isNull();
        assertThat(timelineCount("rollback-item")).isZero();
    }

    private ManagedSystemsService inboxService() {
        ExternalApprovalRepository approvals = mock(ExternalApprovalRepository.class);
        ManagedSystemsService service = Mockito.spy(new ManagedSystemsService(repository, approvals));
        doReturn(List.of(Map.of("id", INBOX_ID))).when(service).pmInbox();
        return service;
    }

    private Map<String, Object> inTransaction(java.util.concurrent.Callable<Map<String, Object>> callback) {
        return transactions.execute(status -> {
            try {
                return callback.call();
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        });
    }

    private long timelineCount(String referenceId) {
        Long count = jdbc.queryForObject("select count(*) from public.runtime_timeline where reference_id = ?", Long.class, referenceId);
        return count == null ? 0 : count;
    }

    private String requiredProperty(String name) {
        String value = System.getProperty(name);
        if (value == null || value.isBlank()) throw new IllegalStateException(name + " is required for PostgreSQL integration tests.");
        return value;
    }
}
