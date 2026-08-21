package com.archiveos.ai.security;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AdminCredentialRepository {
    private final JdbcTemplate jdbc;

    public AdminCredentialRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Credential> find(String username) {
        List<Credential> rows = jdbc.query("""
                select credential_key, password_hash, role, enabled
                  from public.archiveos_admin_credential
                 where lower(credential_key) = lower(?)
                """, (rs, row) -> new Credential(
                rs.getString("credential_key"),
                rs.getString("password_hash"),
                PlatformRole.valueOf(rs.getString("role")),
                rs.getBoolean("enabled")), username);
        return rows.stream().findFirst();
    }

    public void upsert(String username, String passwordHash, PlatformRole role, String updatedBy) {
        jdbc.update("""
                insert into public.archiveos_admin_credential(
                    credential_key, password_hash, role, enabled, updated_at, updated_by)
                values (?, ?, ?, true, now(), ?)
                on conflict (credential_key) do update set
                    password_hash = excluded.password_hash,
                    role = excluded.role,
                    enabled = true,
                    updated_at = now(),
                    updated_by = excluded.updated_by
                """, username, passwordHash, role.name(), updatedBy);
    }

    public record Credential(String username, String passwordHash, PlatformRole role, boolean enabled) {}
}
