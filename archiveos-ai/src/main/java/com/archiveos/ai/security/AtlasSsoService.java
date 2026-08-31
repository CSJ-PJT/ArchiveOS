package com.archiveos.ai.security;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AtlasSsoService {
    public static final List<String> APPS = List.of("management", "travel", "learn", "health", "jobs", "sketchfy", "backend");
    private static final Pattern PKCE = Pattern.compile("^[A-Za-z0-9_-]{43,128}$");
    private static final Pattern STATE = Pattern.compile("^[A-Za-z0-9._~-]{16,256}$");
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AtlasSsoGrantRepository repository;
    private final AtlasSsoProperties properties;

    public AtlasSsoService(AtlasSsoGrantRepository repository, AtlasSsoProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public Map<String, Object> status(String username) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enabled", properties.enabled());
        result.put("gatewayUrl", properties.gatewayUrl());
        result.put("apps", APPS);
        result.put("grants", repository.grantsFor(normalizeUsername(username)));
        result.put("direction", "ARCHIVEOS_TO_ATLAS_ONLY");
        return result;
    }

    public Map<String, Set<String>> allGrants() {
        return repository.allGrants();
    }

    @Transactional
    public Set<String> replaceGrants(String username, Set<String> apps, String adminActor) {
        String target = normalizeUsername(username);
        if (!repository.credentialExists(target)) throw new IllegalArgumentException("Managed account does not exist.");
        Set<String> normalized = new LinkedHashSet<>();
        if (apps != null) {
            for (String app : apps) {
                String value = app == null ? "" : app.trim().toLowerCase();
                if (!APPS.contains(value)) throw new IllegalArgumentException("Unknown Atlas application.");
                normalized.add(value);
            }
        }
        repository.replace(target, normalized, normalizeUsername(adminActor));
        return repository.grantsFor(target);
    }

    @Transactional
    public AuthorizationResult authorize(String username, PlatformRole role, AuthorizationRequest request) {
        if (!properties.enabled()) throw new IllegalStateException("Atlas SSO is disabled.");
        validateRequest(request);
        if (role != PlatformRole.OPERATOR && role != PlatformRole.PM && role != PlatformRole.ADMIN) {
            throw new AccessDeniedException("Managed ArchiveOS account required.");
        }
        String actor = normalizeUsername(username);
        if (!repository.credentialExists(actor)) throw new IllegalArgumentException("Managed account does not exist.");
        String app = normalizeApp(request.app());
        Set<String> grants = repository.grantsFor(actor);
        if (!"portal".equals(app) && !grants.contains(app)) {
            throw new AccessDeniedException("Atlas application permission is not granted.");
        }
        String code = randomToken(32);
        Instant expiresAt = Instant.now().plusSeconds(properties.codeTtlSeconds());
        repository.pruneCodes();
        repository.createCode(sha256Hex(code), actor, role, request.clientId(),
                request.redirectUri(), request.codeChallenge(), app, expiresAt);
        String redirect = request.redirectUri() + "?code=" + encode(code) + "&state=" + encode(request.state());
        return new AuthorizationResult(redirect, expiresAt);
    }

    @Transactional
    public ExchangeResult exchange(ExchangeRequest request) {
        if (!properties.enabled()) throw new IllegalStateException("Atlas SSO is disabled.");
        if (request == null || !"atlas".equals(request.clientId()) || request.code() == null
                || request.verifier() == null || !PKCE.matcher(request.verifier()).matches()
                || !properties.allowedRedirects().contains(request.redirectUri())) {
            throw new IllegalArgumentException("Invalid SSO exchange request.");
        }
        AtlasSsoGrantRepository.AuthorizationCode stored = repository.lockCode(sha256Hex(request.code()))
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired authorization code."));
        if (stored.usedAt() != null || !stored.expiresAt().isAfter(Instant.now())
                || !stored.clientId().equals(request.clientId())
                || !stored.redirectUri().equals(request.redirectUri())
                || !MessageDigest.isEqual(stored.challenge().getBytes(StandardCharsets.US_ASCII),
                    pkceChallenge(request.verifier()).getBytes(StandardCharsets.US_ASCII))) {
            throw new IllegalArgumentException("Invalid or expired authorization code.");
        }
        if (repository.markUsed(stored.id()) != 1) {
            throw new IllegalArgumentException("Authorization code was already used.");
        }
        if (!repository.credentialExists(stored.username())) {
            throw new AccessDeniedException("ArchiveOS account is disabled.");
        }
        Set<String> grants = repository.grantsFor(stored.username());
        if (!"portal".equals(stored.app()) && !grants.contains(stored.app())) {
            throw new AccessDeniedException("Atlas application permission was revoked.");
        }
        Instant issuedAt = Instant.now();
        return new ExchangeResult(stored.username(), stored.role(), grants, stored.app(), issuedAt,
                issuedAt.plusSeconds(8 * 60 * 60L), "https://archiveos.kr");
    }

    private void validateRequest(AuthorizationRequest request) {
        if (request == null || !"atlas".equals(request.clientId())
                || !properties.allowedRedirects().contains(request.redirectUri())
                || request.codeChallenge() == null || !PKCE.matcher(request.codeChallenge()).matches()
                || request.state() == null || !STATE.matcher(request.state()).matches()) {
            throw new IllegalArgumentException("Invalid Atlas SSO authorization request.");
        }
        normalizeApp(request.app());
    }

    private String normalizeApp(String app) {
        String value = app == null ? "portal" : app.trim().toLowerCase();
        if (!"portal".equals(value) && !APPS.contains(value)) throw new IllegalArgumentException("Unknown Atlas application.");
        return value;
    }

    private String normalizeUsername(String username) {
        String value = username == null ? "" : username.trim().toLowerCase();
        if (!value.matches("[a-z0-9][a-z0-9._-]{2,63}")) throw new IllegalArgumentException("Invalid account.");
        return value;
    }

    private static String randomToken(int bytes) {
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    static String pkceChallenge(String verifier) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sha256(verifier));
    }

    static String sha256Hex(String value) {
        byte[] digest = sha256(value);
        StringBuilder result = new StringBuilder(64);
        for (byte item : digest) result.append(String.format("%02x", item));
        return result.toString();
    }

    private static byte[] sha256(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception error) { throw new IllegalStateException("SHA-256 unavailable.", error); }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record AuthorizationRequest(String clientId, String redirectUri, String codeChallenge,
                                       String state, String app) {}
    public record AuthorizationResult(String redirectUrl, Instant expiresAt) {}
    public record ExchangeRequest(String clientId, String redirectUri, String code,
                                  String verifier) {}
    public record ExchangeResult(String subject, PlatformRole role, Set<String> apps, String requestedApp,
                                 Instant issuedAt, Instant expiresAt, String issuer) {}
    public static class AccessDeniedException extends RuntimeException {
        public AccessDeniedException(String message) { super(message); }
    }
}
