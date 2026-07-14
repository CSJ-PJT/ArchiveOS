package com.archiveos.ai.world;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "archiveos.world")
public class WorldProperties {
    private String adapterMode = "mock";
    private String manifestPath = "";
    private int eventLimit = 100;

    public String getAdapterMode() { return adapterMode; }
    public void setAdapterMode(String adapterMode) { this.adapterMode = adapterMode == null ? "mock" : adapterMode.trim(); }
    public String getManifestPath() { return manifestPath; }
    public void setManifestPath(String manifestPath) { this.manifestPath = manifestPath == null ? "" : manifestPath.trim(); }
    public int getEventLimit() { return eventLimit; }
    public void setEventLimit(int eventLimit) { this.eventLimit = Math.min(Math.max(eventLimit, 1), 200); }
    public boolean live() { return "live".equalsIgnoreCase(adapterMode); }
}
