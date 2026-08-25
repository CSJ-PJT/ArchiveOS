package com.archiveos.ai.security;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;

public final class ClientAddressResolver {
    private ClientAddressResolver() { }

    public static String resolve(HttpServletRequest request) {
        String realIp = normalize(request.getHeader("X-Real-IP"));
        if (realIp != null) return realIp;

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null) {
            for (String candidate : forwarded.split(",")) {
                String normalized = normalize(candidate);
                if (normalized != null) return normalized;
            }
        }

        String remote = normalize(request.getRemoteAddr());
        return remote == null ? "0.0.0.0" : remote;
    }

    private static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (value.startsWith("[") && value.contains("]")) {
            value = value.substring(1, value.indexOf(']'));
        } else if (value.indexOf(':') == value.lastIndexOf(':') && value.contains(":")) {
            String possiblePort = value.substring(value.lastIndexOf(':') + 1);
            if (possiblePort.chars().allMatch(Character::isDigit)) value = value.substring(0, value.lastIndexOf(':'));
        }
        boolean ipv6Literal = value.contains(":") && value.matches("[0-9a-fA-F:.%]+");
        boolean ipv4Literal = value.matches("[0-9.]+");
        if (!ipv4Literal && !ipv6Literal) return null;
        try {
            return InetAddress.getByName(value).getHostAddress();
        } catch (Exception ignored) {
            return null;
        }
    }
}
