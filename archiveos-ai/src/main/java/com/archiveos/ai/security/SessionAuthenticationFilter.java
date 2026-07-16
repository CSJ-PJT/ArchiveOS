package com.archiveos.ai.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    private final SessionService sessions;

    public SessionAuthenticationFilter(SessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (rejectForbiddenServiceSemantics(request, response)) return;
        authenticateServiceToken(request);
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String sessionId = readCookie(request);
            sessions.find(sessionId).ifPresent(session -> {
                var authority = new SimpleGrantedAuthority(session.role().authority());
                var authentication = new UsernamePasswordAuthenticationToken(session, sessionId, java.util.List.of(authority));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private String readCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(cookie -> SessionService.COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst().orElse(null);
    }

    private void authenticateServiceToken(HttpServletRequest request) {
        if (SecurityContextHolder.getContext().getAuthentication() != null) return;
        String authorization = request.getHeader(ArchiveScopeRegistry.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) return;
        String token = authorization.substring("Bearer ".length()).trim();
        String source = compatibleHeader(request, ArchiveScopeRegistry.SOURCE_HEADER, ArchiveScopeRegistry.LEGACY_SOURCE_HEADER);
        String scope = compatibleHeader(request, ArchiveScopeRegistry.SCOPE_HEADER, ArchiveScopeRegistry.LEGACY_SCOPE_HEADER);
        if (source == null || scope == null) return;
        source = ArchiveScopeRegistry.canonicalService(source);
        PlatformRole role;
        String expected;
        if ("/api/live-flow/events/ingest".equals(request.getRequestURI())
                && ArchiveScopeRegistry.RUNTIME_INGEST.equals(scope) && ArchiveScopeRegistry.isRuntimeIngestSource(source)) {
            role = PlatformRole.ARCHIVE_INTERNAL_SERVICE;
            expected = sessions.properties().runtimeIngestToken(source);
        } else if (ArchiveScopeRegistry.AUTHENTICATED_READ.equals(scope) && "archive-os".equals(source)) {
            role = PlatformRole.AUTHENTICATED_READ;
            expected = sessions.properties().authenticatedReadToken();
        } else if (ArchiveScopeRegistry.ADMIN_OPERATE.equals(scope) && "archive-os".equals(source)) {
            role = PlatformRole.ADMIN;
            expected = sessions.properties().adminOperatorToken();
        } else return;
        if (!constantTimeEquals(expected, token)) return;
        PlatformSession session = new PlatformSession("service:" + source, source, role,
                java.time.Instant.now(), java.time.Instant.now().plus(java.time.Duration.ofMinutes(5)));
        var authority = new SimpleGrantedAuthority(session.role().authority());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(session, "internal-service-token", java.util.List.of(authority)));
    }

    /** A presented, validly shaped service credential with a disallowed identity/scope is authorization failure, not authentication failure. */
    private boolean rejectForbiddenServiceSemantics(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (!"/api/live-flow/events/ingest".equals(request.getRequestURI())) return false;
        String authorization = request.getHeader(ArchiveScopeRegistry.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ") || authorization.substring(7).trim().isEmpty()) return false;
        String source = compatibleHeader(request, ArchiveScopeRegistry.SOURCE_HEADER, ArchiveScopeRegistry.LEGACY_SOURCE_HEADER);
        String scope = compatibleHeader(request, ArchiveScopeRegistry.SCOPE_HEADER, ArchiveScopeRegistry.LEGACY_SCOPE_HEADER);
        if (source == null || scope == null || !ArchiveScopeRegistry.RUNTIME_INGEST.equals(scope)
                || !ArchiveScopeRegistry.isRuntimeIngestSource(source)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Service identity or scope is not permitted");
            return true;
        }
        return false;
    }

    private String compatibleHeader(HttpServletRequest request, String standard, String legacy) {
        String value = request.getHeader(standard);
        String legacyValue = request.getHeader(legacy);
        if (value != null && legacyValue != null && !value.trim().equalsIgnoreCase(legacyValue.trim())) return null;
        return value != null ? value.trim() : legacyValue == null ? null : legacyValue.trim();
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return java.security.MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.UTF_8), actual.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

}
