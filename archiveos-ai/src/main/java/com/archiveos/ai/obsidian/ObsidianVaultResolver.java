package com.archiveos.ai.obsidian;

import com.archiveos.ai.config.ArchiveOsAiProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public class ObsidianVaultResolver {
    private final ArchiveOsAiProperties properties;

    public ObsidianVaultResolver(ArchiveOsAiProperties properties) {
        this.properties = properties;
    }

    public Path resolveVaultPath() {
        List<Candidate> candidates = new ArrayList<>();
        addCandidate(candidates, properties.obsidianVaultPath(), "env");
        addCandidate(candidates, Path.of("docs").toAbsolutePath().normalize().toString(), "project-docs");
        addCandidate(candidates, Path.of("..", "docs").toAbsolutePath().normalize().toString(), "parent-docs");

        String userHome = System.getProperty("user.home", "");
        if (!userHome.isBlank()) {
            for (String name : List.of("Obsidian", "Vault", "Notes", "ArchiveOS", "DeepStake3D", "ETC")) {
                addCandidate(candidates, Path.of(userHome, name).toString(), "home-name");
                addCandidate(candidates, Path.of(userHome, "Documents", name).toString(), "documents-name");
                addCandidate(candidates, Path.of(userHome, "OneDrive", name).toString(), "onedrive-name");
                addCandidate(candidates, Path.of(userHome, "OneDrive", "바탕 화면", name).toString(), "desktop-name");
            }
        }

        return candidates.stream()
                .max(Comparator.comparingInt(Candidate::score)
                        .thenComparing(Candidate::hasObsidian)
                        .thenComparing(Candidate::markdownCount))
                .map(Candidate::path)
                .orElse(Path.of("docs").toAbsolutePath().normalize());
    }

    public List<Candidate> findCandidates() {
        List<Candidate> candidates = new ArrayList<>();
        addCandidate(candidates, properties.obsidianVaultPath(), "env");
        addCandidate(candidates, Path.of("docs").toAbsolutePath().normalize().toString(), "project-docs");
        addCandidate(candidates, Path.of("..", "docs").toAbsolutePath().normalize().toString(), "parent-docs");
        return candidates.stream()
                .sorted(Comparator.comparingInt(Candidate::score).reversed())
                .toList();
    }

    private void addCandidate(List<Candidate> candidates, String rawPath, String reason) {
        if (rawPath == null || rawPath.isBlank()) return;
        Path path = Path.of(rawPath).toAbsolutePath().normalize();
        if (!Files.isDirectory(path)) return;
        if (candidates.stream().anyMatch(candidate -> candidate.path().equals(path))) return;

        boolean hasObsidian = Files.isDirectory(path.resolve(".obsidian"));
        List<Path> markdownFiles = listMarkdownFiles(path);
        int score = score(path, markdownFiles, hasObsidian, reason);
        candidates.add(new Candidate(path, reason, markdownFiles.size(), hasObsidian, score));
    }

    private List<Path> listMarkdownFiles(Path path) {
        try (Stream<Path> stream = Files.walk(path, 8)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(file -> file.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".md"))
                    .limit(200)
                    .toList();
        } catch (IOException error) {
            return List.of();
        }
    }

    private int score(Path path, List<Path> markdownFiles, boolean hasObsidian, String reason) {
        int score = 0;
        String normalized = path.toString().toLowerCase(Locale.ROOT);
        if ("env".equals(reason)) score += 200;
        if (hasObsidian) score += 100;
        if (markdownFiles.size() >= 3) score += 20;
        score += Math.min(markdownFiles.size(), 30);
        if (normalized.contains("obsidian") || normalized.contains("vault") || normalized.contains("notes")) score += 14;
        if (normalized.contains("archiveos") || normalized.contains("deepstake3d") || normalized.contains("docs")) score += 10;

        int relevant = 0;
        for (Path file : markdownFiles.stream().limit(30).toList()) {
            try {
                String text = Files.readString(file);
                if (text.matches("(?s).*(ArchiveOS|DeepStake3D|AX|Spring AI|RAG|Obsidian|Knowledge Graph).*")) {
                    relevant += 1;
                }
            } catch (IOException ignored) {
            }
        }
        return score + relevant * 4;
    }

    public record Candidate(Path path, String reason, int markdownCount, boolean hasObsidian, int score) {}
}
