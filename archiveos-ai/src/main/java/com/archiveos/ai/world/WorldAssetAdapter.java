package com.archiveos.ai.world;

import java.util.Map;

/** Read-only boundary to Archive-World's generated manifest. */
public interface WorldAssetAdapter {
    Map<String, Object> assets();
    String mode();
}
