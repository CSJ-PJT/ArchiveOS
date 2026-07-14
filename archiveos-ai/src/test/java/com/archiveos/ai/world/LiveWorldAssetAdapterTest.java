package com.archiveos.ai.world;

import static org.assertj.core.api.Assertions.assertThat;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LiveWorldAssetAdapterTest {
    @TempDir Path temp;

    @Test void readsOnlyRelativeManifestPaths() throws Exception {
        Path manifest = temp.resolve("archive-world-assets.json");
        Files.writeString(manifest, """
                {"schema":"archive-world.local-manifest/v1","generatedAt":"2026-07-14T00:00:00Z","assets":[
                  {"assetId":"market-1","category":"buildings","master":"assets/optimized/master.glb","preview":"assets/previews/a.png","thumbnail":"assets/thumbnails/a.webp","lods":[{"level":0,"path":"assets/optimized/lod0.glb","bytes":10}]},
                  {"assetId":"unsafe-1","master":"../outside.glb","preview":"https://example.invalid/x.png"}
                ]}
                """);
        WorldProperties properties = new WorldProperties(); properties.setManifestPath(manifest.toString());
        Map<String, Object> result = new LiveWorldAssetAdapter(properties).assets();
        assertThat(result).containsEntry("manifestStatus", "READY");
        @SuppressWarnings("unchecked") List<Map<String, Object>> assets = (List<Map<String, Object>>) result.get("assets");
        assertThat(assets).hasSize(2);
        assertThat(assets.get(0)).containsEntry("master", "assets/optimized/master.glb");
        assertThat(assets.get(1)).doesNotContainKeys("master", "preview");
    }

    @Test void reportsUnavailableWithoutLeakingConfiguredPath() {
        WorldProperties properties = new WorldProperties(); properties.setManifestPath(temp.resolve("missing.json").toString());
        Map<String, Object> result = new LiveWorldAssetAdapter(properties).assets();
        assertThat(result).containsEntry("manifestStatus", "MANIFEST_UNAVAILABLE");
        assertThat(result.toString()).doesNotContain(temp.toString());
    }
}
