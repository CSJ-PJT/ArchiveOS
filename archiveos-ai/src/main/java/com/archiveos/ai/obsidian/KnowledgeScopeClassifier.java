package com.archiveos.ai.obsidian;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Assigns a document to a collection before it is embedded or searched.
 * Public is an explicit allow-list decision and every ambiguous document is
 * kept internal. Content rules are a second fail-closed guard, not masking.
 */
@Component
public class KnowledgeScopeClassifier {
    private static final List<String> BLOCKED_PATH_PARTS = List.of(
            "runbook", "recovery", "incident", "operations", "security",
            "internal", "private", "secret", ".codex", "task/settings");
    private static final Pattern OPERATIONAL_CONTENT = Pattern.compile(
            "(?i)(curl\\s+(-[a-z]+\\s+)*https?://|(?:export|set)\\s+[A-Z][A-Z0-9_]{3,}|"
                    + "(?:password|token|secret|api[_-]?key|webhook)[A-Z0-9_-]*\\s*[=:]|"
                    + "localhost(?::\\d+)?|host\\.docker\\.internal|wsl\\s+--shutdown|"
                    + "docker\\s+(?:exec|compose|run|inspect)|ssh\\s+-[LRD]|/api/(?:auth|security|runtime)/)");

    private final ArchiveOsAiProperties properties;

    public KnowledgeScopeClassifier(ArchiveOsAiProperties properties) {
        this.properties = properties;
    }

    public KnowledgeScope classify(MarkdownDocument document) {
        String path = normalize(document.relativePath());
        boolean explicitlyApproved = properties.ragPublicPathPrefixes().stream()
                .map(KnowledgeScopeClassifier::normalizePrefix)
                .anyMatch(path::startsWith);
        if (!explicitlyApproved) return KnowledgeScope.INTERNAL;
        if (BLOCKED_PATH_PARTS.stream().anyMatch(path::contains)) return KnowledgeScope.INTERNAL;
        if (OPERATIONAL_CONTENT.matcher(document.content()).find()) return KnowledgeScope.INTERNAL;
        return KnowledgeScope.PUBLIC;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.replace('\\', '/').toLowerCase(Locale.ROOT);
    }

    private static String normalizePrefix(String value) {
        String normalized = normalize(value);
        return normalized.endsWith("/") ? normalized : normalized + "/";
    }
}
