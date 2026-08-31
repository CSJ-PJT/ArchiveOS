package com.archiveos.ai.security;

import com.archiveos.ai.audit.AdminAccessAuditService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final SessionService sessions;
    private final SecurityThreatNotificationService threatNotifications;
    private final AdminAccessAuditService adminAccessAudit;

    public AuthController(SessionService sessions, SecurityThreatNotificationService threatNotifications,
                          AdminAccessAuditService adminAccessAudit) {
        this.sessions = sessions;
        this.threatNotifications = threatNotifications;
        this.adminAccessAudit = adminAccessAudit;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody(required = false) LoginRequest body,
                                                      HttpServletRequest request, HttpServletResponse response) {
        String clientIp = ClientAddressResolver.resolve(request);
        try {
            PlatformRole requested = body == null || body.role() == null ? PlatformRole.ADMIN
                    : PlatformRole.valueOf(body.role().trim().toUpperCase());
            PlatformSession session = sessions.login(clientIp, body == null ? null : body.username(), body == null ? null : body.password(), requested);
            adminAccessAudit.recordSuccessfulLogin(session, clientIp, request.getHeader("User-Agent"));
            response.addCookie(cookie(session.id(), (int) Duration.between(session.createdAt(), session.expiresAt()).toSeconds()));
            return ResponseEntity.ok(Map.of("data", describe(session)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", "role must be operator, pm, or admin."));
        } catch (SessionService.LoginRejectedException error) {
            HttpStatus status = error.rateLimited() ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.UNAUTHORIZED;
            if (error.rateLimited()) threatNotifications.notifyLoginLockout(clientIp);
            return ResponseEntity.status(status).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/session")
    public Map<String, Object> session(Authentication authentication, HttpServletRequest request) {
        if (authentication != null && authentication.getPrincipal() instanceof PlatformSession session) {
            return Map.of("data", describe(session));
        }
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserDetails user) {
            PlatformRole role = resolveRole(authentication);
            HttpSession httpSession = request.getSession(false);
            Instant createdAt = httpSession == null ? Instant.now()
                    : Instant.ofEpochMilli(httpSession.getCreationTime());
            Instant expiresAt = httpSession == null ? createdAt.plus(Duration.ofMinutes(sessions.properties().sessionTimeoutMinutes()))
                    : Instant.ofEpochMilli(httpSession.getLastAccessedTime())
                        .plusSeconds(httpSession.getMaxInactiveInterval());
            if (role == PlatformRole.ADMIN && httpSession != null
                    && httpSession.getAttribute("ARCHIVEOS_PASSKEY_AUDITED") == null) {
                adminAccessAudit.recordSuccessfulPasskeyLogin(user.getUsername(), ClientAddressResolver.resolve(request),
                        request.getHeader("User-Agent"), httpSession.getId());
                httpSession.setAttribute("ARCHIVEOS_PASSKEY_AUDITED", Boolean.TRUE);
            }
            return Map.of("data", describe(user.getUsername(), role, createdAt, expiresAt));
        }
        return Map.of("data", Map.of("actor", "anonymous", "role", PlatformRole.PUBLIC.name(), "authenticated", false));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.logout(readCookie(request));
        response.addCookie(cookie("", 0));
        HttpSession httpSession = request.getSession(false);
        if (httpSession != null) httpSession.invalidate();
        SecurityContextHolder.clearContext();
        response.addCookie(expiredCookie("JSESSIONID"));
        return Map.of("data", Map.of("loggedOut", true));
    }

    @PostMapping("/admin/users")
    public ResponseEntity<Map<String, Object>> createAdmin(@RequestBody CreateCredentialRequest body,
                                                            Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof PlatformSession principal)
                || principal.role() != PlatformRole.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin session required."));
        }
        try {
            PlatformRole role = body == null || body.role() == null
                    ? PlatformRole.ADMIN : PlatformRole.valueOf(body.role().trim().toUpperCase());
            SessionService.CredentialSummary created = sessions.createCredential(
                    body == null ? null : body.username(), body == null ? null : body.password(), role, principal.actor());
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", Map.of(
                    "username", created.username(), "role", created.role().name(), "enabled", created.enabled())));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    private Map<String, Object> describe(PlatformSession session) {
        return describe(session.actor(), session.role(), session.createdAt(), session.expiresAt());
    }

    private Map<String, Object> describe(String actor, PlatformRole role, Instant createdAt, Instant expiresAt) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("actor", actor);
        data.put("role", role.name());
        data.put("authenticated", true);
        data.put("createdAt", createdAt);
        data.put("expiresAt", expiresAt);
        return data;
    }

    private PlatformRole resolveRole(Authentication authentication) {
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .filter(value -> value.startsWith("ROLE_"))
                .map(value -> value.substring(5))
                .map(value -> {
                    try { return PlatformRole.valueOf(value); }
                    catch (IllegalArgumentException ignored) { return null; }
                })
                .filter(java.util.Objects::nonNull).findFirst().orElse(PlatformRole.PUBLIC);
    }

    private Cookie cookie(String value, int maxAge) {
        Cookie cookie = new Cookie(SessionService.COOKIE_NAME, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(sessions.properties().secureCookie());
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        cookie.setAttribute("SameSite", "Strict");
        return cookie;
    }

    private Cookie expiredCookie(String name) {
        Cookie cookie = new Cookie(name, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(sessions.properties().secureCookie());
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Strict");
        return cookie;
    }

    private String readCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies()).filter(c -> SessionService.COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue).findFirst().orElse(null);
    }

    public record LoginRequest(String username, String password, String role) {}
    public record CreateCredentialRequest(String username, String password, String role) {}
}
