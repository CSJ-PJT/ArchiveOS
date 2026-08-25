package com.archiveos.ai.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/security/access")
public class AccessLogController {
    private final AccessLogService access;

    public AccessLogController(AccessLogService access) {
        this.access = access;
    }

    @PostMapping("/visit")
    public Map<String, Object> visit(@RequestBody(required = false) VisitRequest body, HttpServletRequest request) {
        access.recordVisit(
                body == null ? null : body.route(),
                body == null ? null : body.requestPath(),
                clientAddress(request),
                request.getHeader("User-Agent"),
                request.getHeader("Referer"));
        return Map.of("data", Map.of("recorded", true));
    }

    @GetMapping("/logs")
    public Map<String, Object> logs(@RequestParam(defaultValue = "200") int limit,
                                    @RequestParam(required = false) String route) {
        return Map.of("data", access.recent(limit, route));
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        return Map.of("data", access.summary());
    }

    private String clientAddress(HttpServletRequest request) {
        String trustedEdgeAddress = request.getHeader("X-ArchiveOS-Client-IP");
        if (validAddress(trustedEdgeAddress)) return trustedEdgeAddress.trim();

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            List<String> addresses = new ArrayList<>();
            for (String part : forwarded.split(",")) {
                if (validAddress(part)) addresses.add(part.trim());
            }
            if (addresses.size() >= 2) return addresses.get(addresses.size() - 2);
            if (addresses.size() == 1) return addresses.get(0);
        }

        String realIp = request.getHeader("X-Real-IP");
        if (validAddress(realIp)) return realIp.trim();
        String remote = request.getRemoteAddr();
        return validAddress(remote) ? remote.trim() : "unknown";
    }

    private boolean validAddress(String value) {
        if (value == null || value.isBlank()) return false;
        String safe = value.trim();
        if (safe.length() > 64) return false;
        return safe.matches("[0-9a-fA-F:.]+") || safe.matches("[0-9.]+");
    }

    public record VisitRequest(String route, String requestPath) {}
}
