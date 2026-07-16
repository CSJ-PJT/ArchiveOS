package com.archiveos.ai.security;

public enum PlatformRole {
    PUBLIC,
    OPERATOR,
    PM,
    ADMIN,
    AUTHENTICATED_READ,
    ARCHIVE_INTERNAL_SERVICE;

    public String authority() {
        return "ROLE_" + name();
    }
}
