package com.archiveos.ai.world;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/world")
public class WorldAdapterController {
    private final WorldAdapterService world; private final WorldEventBroadcaster broadcaster;
    public WorldAdapterController(WorldAdapterService world, WorldEventBroadcaster broadcaster) { this.world = world; this.broadcaster = broadcaster; }
    @GetMapping("/assets") public Map<String, Object> assets() { return Map.of("data", world.assets()); }
    @GetMapping("/layout") public Map<String, Object> layout() { return Map.of("data", world.layout()); }
    @GetMapping("/events") public Map<String, Object> events(@RequestParam(defaultValue = "50") int limit, @RequestParam(required = false) String correlationId) { return Map.of("data", world.events(limit, correlationId)); }
    @GetMapping("/state") public Map<String, Object> state() { return Map.of("data", world.state()); }
    @GetMapping(value = "/stream", produces = "text/event-stream") public SseEmitter stream() { return broadcaster.connect(world.state()); }
}
