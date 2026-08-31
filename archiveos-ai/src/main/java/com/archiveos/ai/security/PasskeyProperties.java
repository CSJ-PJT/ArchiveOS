package com.archiveos.ai.security;

import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos.passkeys")
public record PasskeyProperties(boolean enabled, String rpId, String rpName, Set<String> allowedOrigins) {
    public PasskeyProperties {
        rpId = rpId == null || rpId.isBlank() ? "archiveos.kr" : rpId.trim();
        rpName = rpName == null || rpName.isBlank() ? "ArchiveOS" : rpName.trim();
        allowedOrigins = allowedOrigins == null || allowedOrigins.isEmpty()
                ? Set.of("https://archiveos.kr", "https://www.archiveos.kr")
                : Set.copyOf(allowedOrigins);
    }
}
