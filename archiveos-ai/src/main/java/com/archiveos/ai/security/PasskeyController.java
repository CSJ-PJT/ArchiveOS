package com.archiveos.ai.security;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/passkeys")
public class PasskeyController {
    private final JdbcTemplate jdbc;
    private final PasskeyProperties properties;

    public PasskeyController(JdbcTemplate jdbc, PasskeyProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || !authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin session required."));
        }
        List<Map<String, Object>> items = jdbc.queryForList("""
                select uc.credential_id as id, uc.label, uc.created, uc.last_used,
                       coalesce(uc.authenticator_transports, '') as transports,
                       uc.backup_eligible, uc.backup_state
                  from public.user_credentials uc
                  join public.user_entities ue on ue.id = uc.user_entity_user_id
                 where lower(ue.name) = lower(?)
                 order by coalesce(uc.last_used, uc.created) desc nulls last
                """, authentication.getName());
        return ResponseEntity.ok(Map.of("data", Map.of(
                "enabled", properties.enabled(),
                "rpId", properties.rpId(),
                "supported", true,
                "items", items)));
    }
}
