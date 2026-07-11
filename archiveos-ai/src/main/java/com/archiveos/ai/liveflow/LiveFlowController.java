package com.archiveos.ai.liveflow;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class LiveFlowController {
    private final LiveFlowService service;
    private final LiveFlowEventBroadcaster broadcaster;

    public LiveFlowController(LiveFlowService service, LiveFlowEventBroadcaster broadcaster) {
        this.service = service;
        this.broadcaster = broadcaster;
    }

    @GetMapping("/api/live-flow/summary")
    public Map<String, Object> summary() { return envelope(service.summary()); }

    @GetMapping("/api/live-flow/topology")
    public Map<String, Object> topology() { return envelope(service.topology()); }

    @GetMapping("/api/live-flow/events/recent")
    public Map<String, Object> recent(@RequestParam(defaultValue = "100") int limit) { return envelope(service.recent(limit)); }

    @GetMapping("/api/live-flow/replay")
    public Map<String, Object> replay(@RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to,
                                      @RequestParam(defaultValue = "200") int limit) {
        return envelope(service.replay(from, to, limit));
    }

    @GetMapping("/api/live-flow/correlation/{correlationId}")
    public Map<String, Object> correlation(@PathVariable String correlationId) { return envelope(service.correlation(correlationId)); }

    @GetMapping("/api/live-flow/entity/{entityId}")
    public Map<String, Object> entity(@PathVariable String entityId) { return envelope(service.entity(entityId)); }

    @PostMapping("/api/live-flow/refresh")
    public Map<String, Object> refresh() { return envelope(service.refresh()); }

    @GetMapping(value = "/api/live-flow/stream", produces = "text/event-stream")
    public SseEmitter stream(@org.springframework.web.bind.annotation.RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        return broadcaster.connect(lastEventId, service.summary());
    }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
