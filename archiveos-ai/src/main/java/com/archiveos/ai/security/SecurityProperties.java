package com.archiveos.ai.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

@ConfigurationProperties(prefix = "archiveos.security")
public record SecurityProperties(
        String adminPassword,
        String integrationToken,
        String internalIngestToken,
        boolean internalIngestEnabled,
        String marketToOsToken,
        String nexusToOsToken,
        String logisticsToOsToken,
        String ledgerToOsToken,
        String authenticatedReadToken,
        String adminOperatorToken,
        long sessionTimeoutMinutes,
        int maxLoginAttempts,
        long lockoutMinutes,
        boolean secureCookie) {
    @ConstructorBinding
    public SecurityProperties {
        adminPassword = adminPassword == null ? "" : adminPassword;
        integrationToken = integrationToken == null ? "" : integrationToken;
        internalIngestToken = internalIngestToken == null ? "" : internalIngestToken;
        marketToOsToken = marketToOsToken == null ? "" : marketToOsToken;
        nexusToOsToken = nexusToOsToken == null ? "" : nexusToOsToken;
        logisticsToOsToken = logisticsToOsToken == null ? "" : logisticsToOsToken;
        ledgerToOsToken = ledgerToOsToken == null ? "" : ledgerToOsToken;
        authenticatedReadToken = authenticatedReadToken == null ? "" : authenticatedReadToken;
        adminOperatorToken = adminOperatorToken == null ? "" : adminOperatorToken;
        if (sessionTimeoutMinutes <= 0) sessionTimeoutMinutes = 30;
        if (maxLoginAttempts <= 0) maxLoginAttempts = 5;
        if (lockoutMinutes <= 0) lockoutMinutes = 15;
    }

    /** Preserves the pre-internal-ingest constructor used by existing callers and tests. */
    public SecurityProperties(String adminPassword, String integrationToken, long sessionTimeoutMinutes,
                              int maxLoginAttempts, long lockoutMinutes, boolean secureCookie) {
        this(adminPassword, integrationToken, "", false, "", "", "", "", "", "", sessionTimeoutMinutes, maxLoginAttempts, lockoutMinutes, secureCookie);
    }

    public boolean configured() {
        return !adminPassword.isBlank();
    }

    public boolean integrationConfigured() {
        return !integrationToken.isBlank();
    }

    public boolean internalIngestConfigured() { return internalIngestEnabled && !internalIngestToken.isBlank(); }

    public String runtimeIngestToken(String source) {
        return switch (ArchiveScopeRegistry.canonicalService(source)) {
            case "archive-market" -> marketToOsToken;
            case "archive-nexus" -> nexusToOsToken;
            case "archive-logistics" -> logisticsToOsToken;
            case "archive-ledger" -> ledgerToOsToken;
            default -> "";
        };
    }

    public boolean rcConfigured() {
        return configured() && !marketToOsToken.isBlank() && !nexusToOsToken.isBlank()
                && !logisticsToOsToken.isBlank() && !ledgerToOsToken.isBlank()
                && !authenticatedReadToken.isBlank() && !adminOperatorToken.isBlank();
    }
}
