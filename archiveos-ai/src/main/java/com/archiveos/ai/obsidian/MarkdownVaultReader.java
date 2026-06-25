package com.archiveos.ai.obsidian;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public class MarkdownVaultReader {
    private final MarkdownChunker chunker;

    public MarkdownVaultReader(MarkdownChunker chunker) {
        this.chunker = chunker;
    }

    public List<MarkdownDocument> readVault(Path vaultRoot) throws IOException {
        Path normalizedRoot = vaultRoot.toAbsolutePath().normalize();
        try (Stream<Path> paths = Files.walk(normalizedRoot)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".md"))
                    .filter(path -> !path.toString().contains(".obsidian"))
                    .filter(path -> !path.toString().contains(".git"))
                    .map(path -> readDocument(normalizedRoot, path))
                    .toList();
        }
    }

    private MarkdownDocument readDocument(Path root, Path path) {
        try {
            String content = Files.readString(path, StandardCharsets.UTF_8);
            String relative = root.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
            String hash = sha256(content);
            String title = chunker.extractTitle(content, relative);
            Instant modifiedAt = Files.getLastModifiedTime(path).toInstant();
            return new MarkdownDocument(relative, title, content, hash, modifiedAt);
        } catch (IOException error) {
            throw new IllegalStateException("Failed to read markdown file: " + path, error);
        }
    }

    private String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 not available", error);
        }
    }
}
