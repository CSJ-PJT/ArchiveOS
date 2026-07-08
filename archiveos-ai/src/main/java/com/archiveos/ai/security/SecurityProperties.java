package com.archiveos.ai.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos.security")
public record SecurityProperties(
        String adminPassword,
        String integrationToken,
        long sessionTimeoutMinutes,
        int maxLoginAttempts,
        long lockoutMinutes,
        boolean secureCookie) {
    public SecurityProperties {
        adminPassword = adminPassword == null ? "" : adminPassword;
        integrationToken = integrationToken == null ? "" : integrationToken;
        if (sessionTimeoutMinutes <= 0) sessionTimeoutMinutes = 30;
        if (maxLoginAttempts <= 0) maxLoginAttempts = 5;
        if (lockoutMinutes <= 0) lockoutMinutes = 15;
    }

    public boolean configured() {
        return !adminPassword.isBlank();
    }

    public boolean integrationConfigured() {
        return !integrationToken.isBlank();
    }
}
