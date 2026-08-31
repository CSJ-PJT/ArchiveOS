package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class AccountRecoveryMigrationContractTest {
    @Test
    void storesOnlyHashedSingleUseExpiringResetTokens() throws Exception {
        String sql;
        try (var input = getClass().getResourceAsStream("/db/migration/V40__add_managed_account_recovery.sql")) {
            assertThat(input).isNotNull();
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8).toLowerCase();
        }
        assertThat(sql).contains("token_hash char(64) not null unique")
                .contains("expires_at timestamptz not null")
                .contains("used_at timestamptz")
                .doesNotContain(" token text")
                .doesNotContain("password_reset_token text");
    }
}
