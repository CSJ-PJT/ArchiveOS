package com.archiveos.ai.security;

import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos.atlas-sso")
public record AtlasSsoProperties(boolean enabled, String gatewayUrl, Set<String> allowedRedirects,
                                 long codeTtlSeconds) {
    public AtlasSsoProperties {
        gatewayUrl = gatewayUrl == null ? "" : gatewayUrl.trim().replaceAll("/+$", "");
        allowedRedirects = allowedRedirects == null ? Set.of() : Set.copyOf(allowedRedirects);
        codeTtlSeconds = Math.max(30, Math.min(codeTtlSeconds, 180));
    }
}
