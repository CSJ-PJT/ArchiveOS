package com.archiveos.ai.obsidian;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class MarkdownChunker {
    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s+(.+)$");

    public List<MarkdownChunk> chunk(String content, int requestedChunkSize, int requestedOverlap) {
        int chunkSize = Math.max(requestedChunkSize, 200);
        int overlap = Math.min(Math.max(requestedOverlap, 0), chunkSize / 2);
        List<MarkdownChunk> sections = splitSections(content);
        List<MarkdownChunk> chunks = new ArrayList<>();

        for (MarkdownChunk section : sections) {
            String text = section.text().trim();
            if (text.isBlank()) continue;
            if (text.length() <= chunkSize) {
                chunks.add(new MarkdownChunk(section.heading(), text));
                continue;
            }

            int index = 0;
            while (index < text.length()) {
                int end = Math.min(index + chunkSize, text.length());
                chunks.add(new MarkdownChunk(section.heading(), text.substring(index, end).trim()));
                if (end >= text.length()) break;
                index = Math.max(end - overlap, index + 1);
            }
        }

        return chunks.isEmpty() ? List.of(new MarkdownChunk(null, content.trim())) : chunks;
    }

    public String extractTitle(String content, String fallbackPath) {
        for (String line : content.replace("\r\n", "\n").split("\n")) {
            var matcher = HEADING.matcher(line);
            if (matcher.matches()) return matcher.group(2).trim();
        }
        int slash = Math.max(fallbackPath.lastIndexOf('/'), fallbackPath.lastIndexOf('\\'));
        String fileName = slash >= 0 ? fallbackPath.substring(slash + 1) : fallbackPath;
        return fileName.endsWith(".md") ? fileName.substring(0, fileName.length() - 3) : fileName;
    }

    private List<MarkdownChunk> splitSections(String content) {
        List<MarkdownChunk> sections = new ArrayList<>();
        String normalized = content.replace("\r\n", "\n");
        String[] lines = normalized.split("\n", -1);
        String heading = null;
        StringBuilder buffer = new StringBuilder();
        boolean inCodeBlock = false;

        for (String line : lines) {
            if (line.trim().startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                buffer.append(line).append('\n');
                continue;
            }

            var matcher = !inCodeBlock ? HEADING.matcher(line) : null;
            if (matcher != null && matcher.matches()) {
                flush(sections, heading, buffer);
                heading = matcher.group(2).trim();
                buffer.append(line).append('\n');
                continue;
            }

            buffer.append(line).append('\n');
        }

        flush(sections, heading, buffer);
        return sections;
    }

    private void flush(List<MarkdownChunk> sections, String heading, StringBuilder buffer) {
        String text = buffer.toString().trim();
        if (!text.isBlank()) sections.add(new MarkdownChunk(heading, text));
        buffer.setLength(0);
    }
}
