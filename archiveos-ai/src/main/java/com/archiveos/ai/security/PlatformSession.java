package com.archiveos.ai.security;

import java.security.Principal;
import java.time.Instant;

public record PlatformSession(String id, String actor, PlatformRole role, Instant createdAt, Instant expiresAt)
        implements Principal {
    @Override
    public String getName() {
        return actor;
    }

    public boolean expired(Instant now) {
        return !expiresAt.isAfter(now);
    }
}
