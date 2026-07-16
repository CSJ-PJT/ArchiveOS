package com.archiveos.ai.world;

import com.archiveos.ai.obsidian.Json;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Reads the Archive-World manifest only. It never reads, serves, or transforms GLB files. */
@Component
public class LiveWorldAssetAdapter implements WorldAssetAdapter {
    private final WorldProperties properties;
    public LiveWorldAssetAdapter(WorldProperties properties) { this.properties = properties; }
    @Override public String mode() { return "LIVE"; }

    @Override public Map<String, Object> assets() {
        if (properties.getManifestPath().isBlank()) return unavailable("MANIFEST_NOT_CONFIGURED");
        try {
            Path manifest = Path.of(properties.getManifestPath()).normalize();
            if (!Files.isRegularFile(manifest)) return unavailable("MANIFEST_UNAVAILABLE");
            Map<String, Object> document = Json.readObject(Files.readString(manifest));
            Object sourceAssets = document.get("assets");
            if (!(sourceAssets instanceof List<?> list)) return unavailable("MANIFEST_INVALID");
            List<Map<String, Object>> assets = new ArrayList<>();
            for (Object item : list) if (item instanceof Map<?, ?> map) {
                Map<String, Object> safe = asset(map);
                if (!safe.isEmpty()) assets.add(safe);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("mode", mode()); result.put("source", "archive-world-manifest"); result.put("manifestStatus", "READY");
            result.put("schema", document.getOrDefault("schema", "unknown")); result.put("generatedAt", document.get("generatedAt")); result.put("assets", assets);
            return result;
        } catch (Exception ignored) {
            return unavailable("MANIFEST_INVALID");
        }
    }

    private Map<String, Object> asset(Map<?, ?> source) {
        String assetId = text(source.get("assetId"));
        if (assetId.isBlank()) return Map.of();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("assetId", assetId);
        for (String key : List.of("category", "subcategory", "validationStatus", "sourceChecksum")) if (source.get(key) != null) result.put(key, source.get(key));
        for (String key : List.of("master", "preview", "thumbnail")) {
            String value = relative(source.get(key));
            if (value != null) result.put(key, value);
        }
        if (source.get("lods") instanceof List<?> lods) {
            List<Map<String, Object>> safeLods = new ArrayList<>();
            for (Object item : lods) if (item instanceof Map<?, ?> lod) {
                String file = relative(lod.get("path"));
                if (file != null) {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("level", lod.get("level")); value.put("path", file);
                    if (lod.get("bytes") != null) value.put("bytes", lod.get("bytes"));
                    if (lod.get("sha256") != null) value.put("sha256", lod.get("sha256"));
                    safeLods.add(value);
                }
            }
            result.put("lods", safeLods);
        }
        return result;
    }

    private Map<String, Object> unavailable(String status) {
        return Map.of("mode", mode(), "source", "archive-world-manifest", "manifestStatus", status, "assets", List.of());
    }
    private String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    /** Viewer receives only local relative paths; host paths, URLs, and traversal are rejected. */
    private String relative(Object value) {
        String path = text(value);
        if (path.isBlank() || path.startsWith("/") || path.contains("://") || path.contains("..") || Path.of(path).isAbsolute()) return null;
        return path.replace('\\', '/');
    }
}
