package com.archiveos.ai.liveflow;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletRequest;

@RestController
public class LiveFlowController {
    private final LiveFlowService service;
    private final LiveFlowEventBroadcaster broadcaster;
    private final InternalRuntimeIngestService ingest;

    public LiveFlowController(LiveFlowService service, LiveFlowEventBroadcaster broadcaster, InternalRuntimeIngestService ingest) {
        this.service = service;
        this.broadcaster = broadcaster;
        this.ingest = ingest;
    }

    @GetMapping("/api/live-flow/summary")
    public Map<String, Object> summary() { return envelope(service.summary()); }

    @GetMapping("/api/live-flow/topology")
    public Map<String, Object> topology() { return envelope(service.topology()); }

    @GetMapping({"/api/live-flow/events/recent", "/api/live-flow/recent"})
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

    @PostMapping("/api/live-flow/events/ingest")
    public Map<String, Object> ingest(@RequestBody Map<String,Object> payload, HttpServletRequest request, org.springframework.security.core.Authentication authentication) {
        if (request.getContentLengthLong() > 65_536) throw new IllegalArgumentException("Runtime ingest payload exceeds the 64 KiB limit.");
        String source = authentication != null && authentication.getPrincipal() instanceof com.archiveos.ai.security.PlatformSession session ? session.actor() : "";
        return envelope(ingest.ingest(payload, source));
    }

    @GetMapping(value = "/api/live-flow/stream", produces = "text/event-stream")
    public SseEmitter stream(@org.springframework.web.bind.annotation.RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        return broadcaster.connect(lastEventId, service.streamSnapshot());
    }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String,Object>> forbidden(SecurityException error) { return ResponseEntity.status(403).body(Map.of("error", "Internal service source is not permitted.")); }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> invalid(IllegalArgumentException error) { return ResponseEntity.badRequest().body(Map.of("error", error.getMessage())); }
}
