package com.archiveos.ai.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final SessionService sessions;

    public AuthController(SessionService sessions) {
        this.sessions = sessions;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody(required = false) LoginRequest body,
                                                      HttpServletRequest request, HttpServletResponse response) {
        try {
            PlatformRole requested = body == null || body.role() == null ? PlatformRole.ADMIN
                    : PlatformRole.valueOf(body.role().trim().toUpperCase());
            PlatformSession session = sessions.login(clientAddress(request), body == null ? null : body.password(), requested);
            response.addCookie(cookie(session.id(), (int) Duration.between(session.createdAt(), session.expiresAt()).toSeconds()));
            return ResponseEntity.ok(Map.of("data", describe(session)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", "role must be operator, pm, or admin."));
        } catch (SessionService.LoginRejectedException error) {
            HttpStatus status = error.rateLimited() ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.UNAUTHORIZED;
            return ResponseEntity.status(status).body(Map.of("error", error.getMessage()));
        }
    }

    @GetMapping("/session")
    public Map<String, Object> session(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof PlatformSession session) {
            return Map.of("data", describe(session));
        }
        return Map.of("data", Map.of("actor", "anonymous", "role", PlatformRole.PUBLIC.name(), "authenticated", false));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.logout(readCookie(request));
        response.addCookie(cookie("", 0));
        return Map.of("data", Map.of("loggedOut", true));
    }

    private Map<String, Object> describe(PlatformSession session) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("actor", session.actor());
        data.put("role", session.role().name());
        data.put("authenticated", true);
        data.put("createdAt", session.createdAt());
        data.put("expiresAt", session.expiresAt());
        return data;
    }

    private Cookie cookie(String value, int maxAge) {
        Cookie cookie = new Cookie(SessionService.COOKIE_NAME, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(sessions.properties().secureCookie());
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        cookie.setAttribute("SameSite", "Lax");
        return cookie;
    }

    private String readCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies()).filter(c -> SessionService.COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue).findFirst().orElse(null);
    }

    private String clientAddress(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    public record LoginRequest(String password, String role) {}
}
