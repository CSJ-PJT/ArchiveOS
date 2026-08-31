package com.archiveos.ai.security;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AtlasSsoGrantRepository {
    private final JdbcTemplate jdbc;

    public AtlasSsoGrantRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Set<String> grantsFor(String username) {
        return new LinkedHashSet<>(jdbc.queryForList("""
                select app_key from archiveos_atlas_sso_grant
                 where credential_key = ? and enabled = true order by app_key
                """, String.class, username));
    }

    public Map<String, Set<String>> allGrants() {
        Map<String, Set<String>> result = new LinkedHashMap<>();
        jdbc.query("""
                select credential_key, app_key from archiveos_atlas_sso_grant
                 where enabled = true order by credential_key, app_key
                """, (rs, row) -> Map.entry(rs.getString("credential_key"), rs.getString("app_key")))
                .forEach(entry -> result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).add(entry.getValue()));
        return result;
    }

    public boolean credentialExists(String username) {
        Integer count = jdbc.queryForObject("select count(*) from archiveos_admin_credential where credential_key = ? and enabled = true",
                Integer.class, username);
        return count != null && count == 1;
    }

    public void replace(String username, Set<String> apps, String grantedBy) {
        jdbc.update("delete from archiveos_atlas_sso_grant where credential_key = ?", username);
        for (String app : apps) {
            jdbc.update("""
                    insert into archiveos_atlas_sso_grant
                        (credential_key, app_key, enabled, granted_by, granted_at)
                    values (?, ?, true, ?, now())
                    """, username, app, grantedBy);
        }
    }

    public void createCode(String codeHash, String username, PlatformRole role, String clientId,
                           String redirectUri, String challenge, String app, Instant expiresAt) {
        jdbc.update("""
                insert into archiveos_sso_authorization_code
                    (code_hash, credential_key, platform_role, client_id, redirect_uri,
                     code_challenge, requested_app, expires_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, codeHash, username, role.name(), clientId, redirectUri, challenge, app, expiresAt);
    }

    public Optional<AuthorizationCode> lockCode(String codeHash) {
        return jdbc.query("""
                select id, credential_key, platform_role, client_id, redirect_uri,
                       code_challenge, requested_app, expires_at, used_at
                  from archiveos_sso_authorization_code
                 where code_hash = ? for update
                """, (rs, row) -> new AuthorizationCode(
                rs.getLong("id"), rs.getString("credential_key"),
                PlatformRole.valueOf(rs.getString("platform_role")), rs.getString("client_id"),
                rs.getString("redirect_uri"), rs.getString("code_challenge"),
                rs.getString("requested_app"), rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("used_at") == null ? null : rs.getTimestamp("used_at").toInstant()), codeHash)
                .stream().findFirst();
    }

    public int markUsed(long id) {
        return jdbc.update("""
                update archiveos_sso_authorization_code set used_at = now()
                 where id = ? and used_at is null
                """, id);
    }

    public int pruneCodes() {
        return jdbc.update("""
                delete from archiveos_sso_authorization_code
                 where expires_at < now() - interval '1 day'
                    or used_at < now() - interval '1 day'
                """);
    }

    public record AuthorizationCode(long id, String username, PlatformRole role, String clientId,
                                    String redirectUri, String challenge, String app,
                                    Instant expiresAt, Instant usedAt) {}
}
