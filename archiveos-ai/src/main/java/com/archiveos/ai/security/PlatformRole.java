package com.archiveos.ai.security;

public enum PlatformRole {
    PUBLIC,
    OPERATOR,
    PM,
    ADMIN;

    public String authority() {
        return "ROLE_" + name();
    }
}
