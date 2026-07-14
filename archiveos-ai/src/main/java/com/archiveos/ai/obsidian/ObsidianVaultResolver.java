package com.archiveos.ai.obsidian;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Resolves only an explicitly configured Vault; it never scans user folders. */
@Component
public class ObsidianVaultResolver {
    private final ArchiveOsAiProperties properties;

    public ObsidianVaultResolver(ArchiveOsAiProperties properties) { this.properties = properties; }

    public Path resolveVaultPath() {
        if (!properties.obsidianConfigured()) throw new IllegalStateException("VAULT_UNAVAILABLE");
        try {
            Path root = Path.of(properties.obsidianVaultPath()).toRealPath();
            if (!Files.isDirectory(root)) throw new IllegalStateException("VAULT_UNAVAILABLE");
            return root;
        } catch (IOException | RuntimeException error) {
            throw new IllegalStateException("VAULT_UNAVAILABLE");
        }
    }

    public Optional<Path> tryResolveVaultPath() {
        try { return Optional.of(resolveVaultPath()); }
        catch (RuntimeException error) { return Optional.empty(); }
    }

    /** Safe diagnostics expose no absolute path. */
    public List<Candidate> findCandidates() {
        return tryResolveVaultPath().map(path -> List.of(new Candidate(path.getFileName(), "configured", Files.isDirectory(path.resolve(".obsidian"))))).orElse(List.of());
    }

    public record Candidate(Path displayName, String reason, boolean hasObsidian) {}
}
