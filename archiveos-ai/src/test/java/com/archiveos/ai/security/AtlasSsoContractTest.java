package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AtlasSsoContractTest {
    @Test
    void migrationStoresOnlyHashedExpiringSingleUseCodesAndSeparateGrants() throws Exception {
        String sql;
        try (var input = getClass().getResourceAsStream("/db/migration/V41__add_atlas_one_way_sso.sql")) {
            assertThat(input).isNotNull();
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8).toLowerCase();
        }
        assertThat(sql).contains("code_hash char(64) not null unique")
                .contains("code_challenge text not null")
                .contains("expires_at timestamptz not null")
                .contains("used_at timestamptz")
                .contains("archiveos_atlas_sso_grant")
                .doesNotContain("authorization_code text")
                .doesNotContain("client_secret");
    }

    @Test
    void pkceUsesRfc7636S256Vector() {
        assertThat(AtlasSsoService.pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
                .isEqualTo("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    @Test
    void serviceAndReadOnlyPrincipalsCannotMintAtlasSessions() {
        AtlasSsoService service = new AtlasSsoService(mock(AtlasSsoGrantRepository.class),
                new AtlasSsoProperties(true, "https://161.33.17.84",
                        Set.of("https://161.33.17.84/auth/archiveos/callback"), 90));
        AtlasSsoService.AuthorizationRequest request = new AtlasSsoService.AuthorizationRequest(
                "atlas", "https://161.33.17.84/auth/archiveos/callback",
                "A".repeat(43), "state-value-123456", "portal");

        assertThatThrownBy(() -> service.authorize("archive-os", PlatformRole.AUTHENTICATED_READ, request))
                .isInstanceOf(AtlasSsoService.AccessDeniedException.class)
                .hasMessage("Managed ArchiveOS account required.");
        assertThatThrownBy(() -> service.authorize("archive-service", PlatformRole.ARCHIVE_INTERNAL_SERVICE, request))
                .isInstanceOf(AtlasSsoService.AccessDeniedException.class);
    }
}
