package com.archiveos.ai.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
    private static final Pattern EMAIL = Pattern.compile("^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\\.[A-Z]{2,63}$", Pattern.CASE_INSENSITIVE);
    public static final String COOKIE_NAME = "ARCHIVEOS_SESSION";
    private final SecurityProperties properties;
    private final AdminCredentialRepository credentials;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    private final String passwordHash;
    private final Map<String, PlatformSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, AttemptWindow> attempts = new ConcurrentHashMap<>();

    @Autowired
    public SessionService(SecurityProperties properties, AdminCredentialRepository credentials) {
        this.properties = properties;
        this.credentials = credentials;
        this.passwordHash = properties.configured() ? normalizePasswordHash(properties.adminPassword()) : "";
    }

    SessionService(SecurityProperties properties) {
        this(properties, null);
    }

    public PlatformSession login(String remoteAddress, String username, String password, PlatformRole requestedRole) {
        String key = remoteAddress == null || remoteAddress.isBlank() ? "unknown" : remoteAddress;
        Instant now = Instant.now();
        AttemptWindow current = attempts.get(key);
        if (current != null && current.lockedUntil() != null && current.lockedUntil().isAfter(now)) {
            throw new LoginRejectedException("Too many login attempts. Try again later.", true);
        }
        String actor = normalizeUsername(username);
        AdminCredentialRepository.Credential stored = credentials == null ? null : credentials.find(actor).orElse(null);
        boolean storedMatch = stored != null && stored.enabled() && password != null && encoder.matches(password, stored.passwordHash());
        boolean bootstrapMatch = stored == null && "admin".equals(actor) && properties.configured()
                && password != null && encoder.matches(password, passwordHash);
        if (!storedMatch && !bootstrapMatch) {
            boolean rateLimited = recordFailure(key, now, current);
            String message = rateLimited ? "Too many login attempts. Try again later."
                    : properties.configured() || credentials != null ? "Invalid credentials." : "Admin login is not configured.";
            throw new LoginRejectedException(message, rateLimited);
        }
        attempts.remove(key);
        if (stored != null) credentials.recordLogin(actor);
        PlatformRole role = stored == null
                ? (requestedRole == null || requestedRole == PlatformRole.PUBLIC ? PlatformRole.ADMIN : requestedRole)
                : stored.role();
        Instant expiresAt = now.plus(Duration.ofMinutes(properties.sessionTimeoutMinutes()));
        PlatformSession session = new PlatformSession(UUID.randomUUID().toString(), actor, role, now, expiresAt);
        sessions.put(session.id(), session);
        return session;
    }

    public PlatformSession login(String remoteAddress, String password, PlatformRole requestedRole) {
        return login(remoteAddress, "admin", password, requestedRole);
    }

    public Optional<PlatformSession> find(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        PlatformSession session = sessions.get(id);
        if (session == null) return Optional.empty();
        if (session.expired(Instant.now())) {
            sessions.remove(id);
            return Optional.empty();
        }
        return Optional.of(session);
    }

    public void logout(String id) {
        if (id != null) sessions.remove(id);
    }

    public SecurityProperties properties() {
        return properties;
    }

    public CredentialSummary createCredential(String username, String password, String email, PlatformRole role, String updatedBy) {
        if (credentials == null) throw new IllegalStateException("Persistent credential storage is unavailable.");
        String actor = normalizeUsername(username);
        if (!actor.matches("[a-z0-9][a-z0-9._-]{2,63}")) {
            throw new IllegalArgumentException("username must be 3-64 lowercase letters, numbers, dot, underscore, or hyphen.");
        }
        if (password == null || password.length() < 16 || password.length() > 256) {
            throw new IllegalArgumentException("password must be 16-256 characters.");
        }
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (!EMAIL.matcher(normalizedEmail).matches() || normalizedEmail.length() > 254) {
            throw new IllegalArgumentException("valid recovery email is required.");
        }
        if (role == null || !List.of(PlatformRole.OPERATOR, PlatformRole.PM, PlatformRole.ADMIN).contains(role)) {
            throw new IllegalArgumentException("role must be OPERATOR, PM, or ADMIN.");
        }
        credentials.upsert(actor, encoder.encode(password), normalizedEmail, role, updatedBy == null ? "archiveos-admin" : updatedBy);
        return new CredentialSummary(actor, normalizedEmail, role, true);
    }

    private boolean recordFailure(String key, Instant now, AttemptWindow current) {
        int count = current == null || current.windowStarted().plus(Duration.ofMinutes(properties.lockoutMinutes())).isBefore(now)
                ? 1 : current.count() + 1;
        Instant started = count == 1 ? now : current.windowStarted();
        Instant lockedUntil = count >= properties.maxLoginAttempts()
                ? now.plus(Duration.ofMinutes(properties.lockoutMinutes())) : null;
        attempts.put(key, new AttemptWindow(count, started, lockedUntil));
        return lockedUntil != null;
    }

    private String normalizePasswordHash(String value) {
        String password = value == null ? "" : value.trim();
        if (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$")) {
            return password;
        }
        return encoder.encode(password);
    }

    private String normalizeUsername(String username) {
        String value = username == null || username.isBlank() ? "admin" : username.trim();
        return value.toLowerCase();
    }

    private record AttemptWindow(int count, Instant windowStarted, Instant lockedUntil) {}

    public record CredentialSummary(String username, String email, PlatformRole role, boolean enabled) {}

    public static class LoginRejectedException extends RuntimeException {
        private final boolean rateLimited;
        public LoginRejectedException(String message, boolean rateLimited) {
            super(message);
            this.rateLimited = rateLimited;
        }
        public boolean rateLimited() { return rateLimited; }
    }
}
