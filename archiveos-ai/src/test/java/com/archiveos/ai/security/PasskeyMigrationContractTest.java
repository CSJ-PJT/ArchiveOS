package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class PasskeyMigrationContractTest {
    @Test
    void storesCredentialBinariesAsByteaAndNeverLargeObjects() throws Exception {
        String sql;
        try (var input = getClass().getResourceAsStream("/db/migration/V39__create_passkey_credentials.sql")) {
            assertThat(input).isNotNull();
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8).toLowerCase();
        }
        assertThat(sql).contains("public_key bytea not null")
                .contains("attestation_object bytea")
                .contains("attestation_client_data_json bytea")
                .doesNotContain(" blob")
                .doesNotContain(" lo_");
    }
}
