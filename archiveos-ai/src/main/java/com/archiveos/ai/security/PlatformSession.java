package com.archiveos.ai.security;

import java.time.Instant;

public record PlatformSession(String id, String actor, PlatformRole role, Instant createdAt, Instant expiresAt) {
    public boolean expired(Instant now) {
        return !expiresAt.isAfter(now);
    }
}
