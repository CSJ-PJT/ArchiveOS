package com.archiveos.ai.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
    public static final String COOKIE_NAME = "ARCHIVEOS_SESSION";
    private final SecurityProperties properties;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    private final String passwordHash;
    private final Map<String, PlatformSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, AttemptWindow> attempts = new ConcurrentHashMap<>();

    public SessionService(SecurityProperties properties) {
        this.properties = properties;
        this.passwordHash = properties.configured() ? normalizePasswordHash(properties.adminPassword()) : "";
    }

    public PlatformSession login(String remoteAddress, String password, PlatformRole requestedRole) {
        String key = remoteAddress == null || remoteAddress.isBlank() ? "unknown" : remoteAddress;
        Instant now = Instant.now();
        AttemptWindow current = attempts.get(key);
        if (current != null && current.lockedUntil() != null && current.lockedUntil().isAfter(now)) {
            throw new LoginRejectedException("Too many login attempts. Try again later.", true);
        }
        if (!properties.configured() || password == null || !encoder.matches(password, passwordHash)) {
            recordFailure(key, now, current);
            throw new LoginRejectedException(properties.configured() ? "Invalid credentials." : "Admin login is not configured.", false);
        }
        attempts.remove(key);
        PlatformRole role = requestedRole == null || requestedRole == PlatformRole.PUBLIC ? PlatformRole.ADMIN : requestedRole;
        Instant expiresAt = now.plus(Duration.ofMinutes(properties.sessionTimeoutMinutes()));
        PlatformSession session = new PlatformSession(UUID.randomUUID().toString(), "archiveos-admin", role, now, expiresAt);
        sessions.put(session.id(), session);
        return session;
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

    private void recordFailure(String key, Instant now, AttemptWindow current) {
        int count = current == null || current.windowStarted().plus(Duration.ofMinutes(properties.lockoutMinutes())).isBefore(now)
                ? 1 : current.count() + 1;
        Instant started = count == 1 ? now : current.windowStarted();
        Instant lockedUntil = count >= properties.maxLoginAttempts()
                ? now.plus(Duration.ofMinutes(properties.lockoutMinutes())) : null;
        attempts.put(key, new AttemptWindow(count, started, lockedUntil));
    }

    private String normalizePasswordHash(String value) {
        String password = value == null ? "" : value.trim();
        if (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$")) {
            return password;
        }
        return encoder.encode(password);
    }

    private record AttemptWindow(int count, Instant windowStarted, Instant lockedUntil) {}

    public static class LoginRejectedException extends RuntimeException {
        private final boolean rateLimited;
        public LoginRejectedException(String message, boolean rateLimited) {
            super(message);
            this.rateLimited = rateLimited;
        }
        public boolean rateLimited() { return rateLimited; }
    }
}
