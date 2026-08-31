package com.archiveos.ai.security;

import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AtlasSsoController {
    private final AtlasSsoService sso;

    public AtlasSsoController(AtlasSsoService sso) {
        this.sso = sso;
    }

    @GetMapping("/sso/apps")
    public ResponseEntity<Map<String, Object>> apps(Authentication authentication) {
        Principal principal = principal(authentication);
        if (principal == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required."));
        return ResponseEntity.ok(Map.of("data", sso.status(principal.username())));
    }

    @PostMapping("/sso/authorize")
    public ResponseEntity<Map<String, Object>> authorize(@RequestBody(required = false) AtlasSsoService.AuthorizationRequest body,
                                                          Authentication authentication) {
        Principal principal = principal(authentication);
        if (principal == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required."));
        try { return ResponseEntity.ok(Map.of("data", sso.authorize(principal.username(), principal.role(), body))); }
        catch (AtlasSsoService.AccessDeniedException error) { return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage())); }
        catch (IllegalArgumentException | IllegalStateException error) { return ResponseEntity.badRequest().body(Map.of("error", error.getMessage())); }
    }

    @PostMapping("/sso/exchange")
    public ResponseEntity<Map<String, Object>> exchange(@RequestBody(required = false) AtlasSsoService.ExchangeRequest body) {
        try { return ResponseEntity.ok(Map.of("data", sso.exchange(body))); }
        catch (AtlasSsoService.AccessDeniedException error) { return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage())); }
        catch (IllegalArgumentException | IllegalStateException error) { return ResponseEntity.badRequest().body(Map.of("error", error.getMessage())); }
    }

    @GetMapping("/admin/atlas-grants")
    public ResponseEntity<Map<String, Object>> grants(Authentication authentication) {
        if (!isAdmin(authentication)) return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin session required."));
        return ResponseEntity.ok(Map.of("data", Map.of("items", sso.allGrants(), "apps", AtlasSsoService.APPS)));
    }

    @PutMapping("/admin/users/{username}/atlas-grants")
    public ResponseEntity<Map<String, Object>> updateGrants(@PathVariable String username,
                                                             @RequestBody(required = false) GrantRequest body,
                                                             Authentication authentication) {
        Principal principal = principal(authentication);
        if (principal == null || principal.role() != PlatformRole.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin session required."));
        }
        try {
            Set<String> grants = sso.replaceGrants(username, body == null ? Set.of() : body.apps(), principal.username());
            return ResponseEntity.ok(Map.of("data", Map.of("username", username.toLowerCase(), "apps", grants)));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(value -> "ROLE_ADMIN".equals(value.getAuthority()));
    }

    private Principal principal(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return null;
        PlatformRole role = authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .filter(value -> value.startsWith("ROLE_")).map(value -> value.substring(5))
                .map(value -> { try { return PlatformRole.valueOf(value); } catch (IllegalArgumentException ignored) { return null; } })
                .filter(java.util.Objects::nonNull).findFirst().orElse(PlatformRole.PUBLIC);
        if (authentication.getPrincipal() instanceof PlatformSession session) return new Principal(session.actor(), role);
        if (authentication.getPrincipal() instanceof UserDetails user) return new Principal(user.getUsername(), role);
        return null;
    }

    public record GrantRequest(Set<String> apps) {}
    private record Principal(String username, PlatformRole role) {}
}
