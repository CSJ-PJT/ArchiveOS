package com.archiveos.ai.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class MailRepositoryTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MailRepository repository = new MailRepository(jdbc, new ObjectMapper());

    @Test
    void outboundOccurredAtUsesPostgresCompatibleTimestamp() {
        Instant occurredAt = Instant.parse("2026-08-28T06:02:52Z");
        captureQueryArguments((sql, args) -> repository.saveOutbound(
                "csj@archiveos.kr", "provider-1", "csj@archiveos.kr",
                List.of("outside@example.com"), List.of(), "subject", "body", "", occurredAt),
                occurredAt);
    }

    @Test
    void inboundOccurredAtUsesPostgresCompatibleTimestamp() {
        Instant occurredAt = Instant.parse("2026-08-28T06:03:00Z");
        ResendMailGateway.ReceivedMail mail = new ResendMailGateway.ReceivedMail(
                "provider-2", "outside@example.com", List.of("csj@archiveos.kr"), List.<String>of(),
                List.<String>of(), "subject", "body", "", Map.<String, Object>of(),
                List.<Map<String, Object>>of(), occurredAt.toString());
        captureQueryArguments((sql, args) -> repository.saveInbound("csj@archiveos.kr", mail, occurredAt), occurredAt);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void captureQueryArguments(QueryInvocation invocation, Instant occurredAt) {
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(call -> {
                    Object[] arguments = call.getArguments();
                    assertThat(arguments).isNotEmpty();
                    assertThat(arguments[arguments.length - 1])
                            .isEqualTo(Timestamp.from(occurredAt))
                            .isInstanceOf(Timestamp.class);
                    return Map.of("id", "mail-1");
                });

        invocation.run("ignored", new Object[0]);
    }

    @FunctionalInterface
    private interface QueryInvocation {
        void run(String sql, Object[] args);
    }
}
