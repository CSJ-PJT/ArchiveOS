package com.archiveos.ai.security;

import java.util.Map;
import java.util.Set;

/** Canonical Archive service identity and scope contract. Values are deliberately shared verbatim by every service. */
public final class ArchiveScopeRegistry {
    public static final String AUTHORIZATION = "Authorization";
    public static final String SOURCE_HEADER = "X-Archive-Source-System";
    public static final String SCOPE_HEADER = "X-Archive-Service-Scope";
    public static final String LEGACY_SOURCE_HEADER = "X-ArchiveOS-Source-System";
    public static final String LEGACY_SCOPE_HEADER = "X-ArchiveOS-Service-Scope";

    public static final String RUNTIME_INGEST = "runtime:ingest";
    public static final String PRODUCTION_INGEST = "production:ingest";
    public static final String LOGISTICS_INGEST = "logistics:ingest";
    public static final String LEDGER_INGEST = "ledger:ingest";
    public static final String LEDGER_APPROVAL_CALLBACK = "ledger:approval-callback";
    public static final String AUTHENTICATED_READ = "authenticated:read";
    public static final String ADMIN_OPERATE = "admin:operate";

    public static final Set<String> CANONICAL_SERVICES = Set.of(
            "archive-os", "archive-market", "archive-nexus", "archive-logistics", "archive-ledger");
    public static final Map<String, String> LEGACY_SCOPE_ALIASES = Map.of(
            "ledger:read", AUTHENTICATED_READ, "runtime:read", AUTHENTICATED_READ);

    private ArchiveScopeRegistry() { }

    public static String canonicalService(String source) {
        return source == null ? "" : source.trim().toLowerCase();
    }

    public static boolean isRuntimeIngestSource(String source) {
        return Set.of("archive-market", "archive-nexus", "archive-logistics", "archive-ledger").contains(canonicalService(source));
    }
}
