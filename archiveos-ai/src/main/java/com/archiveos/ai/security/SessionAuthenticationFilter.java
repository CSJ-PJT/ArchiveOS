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
        authenticateIntegration(request);
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

    private void authenticateIntegration(HttpServletRequest request) {
        String token = request.getHeader("X-ArchiveOS-Integration-Token");
        if (!sessions.properties().integrationConfigured() || token == null || token.isBlank()) return;
        if (!sessions.properties().integrationToken().equals(token)) return;
        String source = integrationSource(request);
        PlatformSession session = new PlatformSession("integration:" + source, source, PlatformRole.ADMIN,
                java.time.Instant.now(), java.time.Instant.now().plus(java.time.Duration.ofMinutes(5)));
        var authority = new SimpleGrantedAuthority(session.role().authority());
        var authentication = new UsernamePasswordAuthenticationToken(session, "integration-token", java.util.List.of(authority));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private String integrationSource(HttpServletRequest request) {
        String header = request.getHeader("X-ArchiveOS-Integration-Source");
        if (header != null && !header.isBlank()) return header.trim().toLowerCase();
        String path = request.getRequestURI();
        if (path != null && path.contains("/approvals/external")) return "archive-ledger";
        return "archive-nexus";
    }
}
