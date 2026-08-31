package com.archiveos.ai.security;

import java.util.List;
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;
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
                select credential_key, password_hash, role, enabled, email
                  from public.archiveos_admin_credential
                 where lower(credential_key) = lower(?)
                """, (rs, row) -> new Credential(
                rs.getString("credential_key"),
                rs.getString("password_hash"),
                PlatformRole.valueOf(rs.getString("role")),
                rs.getBoolean("enabled"),
                rs.getString("email")), username);
        return rows.stream().findFirst();
    }

    public List<AccountSummary> list() {
        return jdbc.query("""
                select credential_key, email, role, enabled, created_at, updated_at, last_login_at
                  from public.archiveos_admin_credential
                 order by lower(credential_key)
                """, (rs, row) -> new AccountSummary(
                rs.getString("credential_key"), rs.getString("email"),
                PlatformRole.valueOf(rs.getString("role")), rs.getBoolean("enabled"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                rs.getTimestamp("last_login_at") == null ? null : rs.getTimestamp("last_login_at").toInstant()));
    }

    public List<String> usernamesByEmail(String email) {
        return jdbc.queryForList("""
                select credential_key from public.archiveos_admin_credential
                 where enabled = true and lower(email) = lower(?) order by credential_key
                """, String.class, email);
    }

    public Optional<Credential> findByUsernameOrEmail(String value) {
        List<Credential> rows = jdbc.query("""
                select credential_key, password_hash, role, enabled, email
                  from public.archiveos_admin_credential
                 where enabled = true and (lower(credential_key) = lower(?) or lower(email) = lower(?))
                 limit 1
                """, (rs, row) -> new Credential(rs.getString("credential_key"), rs.getString("password_hash"),
                PlatformRole.valueOf(rs.getString("role")), rs.getBoolean("enabled"), rs.getString("email")), value, value);
        return rows.stream().findFirst();
    }

    public void upsert(String username, String passwordHash, String email, PlatformRole role, String updatedBy) {
        jdbc.update("""
                insert into public.archiveos_admin_credential(
                    credential_key, password_hash, email, role, enabled, updated_at, updated_by)
                values (?, ?, ?, ?, true, now(), ?)
                on conflict (credential_key) do update set
                    password_hash = excluded.password_hash,
                    email = excluded.email,
                    role = excluded.role,
                    enabled = true,
                    updated_at = now(),
                    updated_by = excluded.updated_by
                """, username, passwordHash, email, role.name(), updatedBy);
    }

    public void recordLogin(String username) {
        jdbc.update("update public.archiveos_admin_credential set last_login_at = now() where lower(credential_key) = lower(?)", username);
    }

    public void saveResetToken(String username, String tokenHash, Instant expiresAt) {
        jdbc.update("delete from public.archiveos_password_reset_token where expires_at < now() or used_at is not null");
        jdbc.update("""
                insert into public.archiveos_password_reset_token(id, credential_key, token_hash, expires_at)
                values (?, ?, ?, ?)
                """, UUID.randomUUID(), username, tokenHash, java.sql.Timestamp.from(expiresAt));
    }

    public Optional<String> activeResetUsername(String tokenHash) {
        List<String> rows = jdbc.queryForList("""
                select credential_key from public.archiveos_password_reset_token
                 where token_hash = ? and used_at is null and expires_at > now()
                 limit 1
                """, String.class, tokenHash);
        return rows.stream().findFirst();
    }

    public int updatePassword(String username, String passwordHash, String updatedBy) {
        return jdbc.update("""
                update public.archiveos_admin_credential
                   set password_hash = ?, updated_at = now(), updated_by = ?
                 where credential_key = ? and enabled = true
                """, passwordHash, updatedBy, username);
    }

    public int consumeResetToken(String tokenHash) {
        return jdbc.update("""
                update public.archiveos_password_reset_token set used_at = now()
                 where token_hash = ? and used_at is null and expires_at > now()
                """, tokenHash);
    }

    public record Credential(String username, String passwordHash, PlatformRole role, boolean enabled, String email) {}
    public record AccountSummary(String username, String email, PlatformRole role, boolean enabled,
                                 Instant createdAt, Instant updatedAt, Instant lastLoginAt) {}
}
