package com.archiveos.ai.security;

import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Fails closed whenever the RC profile starts without the security contract. */
@Component
class RcSecurityConfigurationValidator {
    private final Environment environment;
    private final SecurityProperties properties;

    RcSecurityConfigurationValidator(Environment environment, SecurityProperties properties) {
        this.environment = environment;
        this.properties = properties;
    }

    @PostConstruct
    void validate() {
        if (!java.util.Arrays.asList(environment.getActiveProfiles()).contains("rc")) return;
        if (!properties.rcConfigured()) {
            throw new IllegalStateException("ArchiveOS RC profile requires all Archive token variables and ARCHIVEOS_ADMIN_PASSWORD");
        }
    }
}
