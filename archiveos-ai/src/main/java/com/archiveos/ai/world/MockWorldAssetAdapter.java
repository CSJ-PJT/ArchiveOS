package com.archiveos.ai.world;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Development-only adapter. It deliberately creates no runtime events or GLB references. */
@Component
public class MockWorldAssetAdapter implements WorldAssetAdapter {
    @Override public String mode() { return "MOCK"; }
    @Override public Map<String, Object> assets() {
        return Map.of("mode", mode(), "source", "development-mock", "manifestStatus", "NOT_REQUESTED",
                "assets", List.of(), "message", "Mock adapter is enabled; Archive-World manifest is not being read.");
    }
}
