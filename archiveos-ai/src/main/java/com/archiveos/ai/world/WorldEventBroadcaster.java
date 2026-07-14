package com.archiveos.ai.world;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** SSE boundary for a separate viewer. Frames contain viewer DTOs, never GLB bytes or renderer commands. */
@Component
public class WorldEventBroadcaster {
    private static final long TIMEOUT_MS = 15 * 60 * 1000L;
    private static final ScheduledExecutorService INITIAL_DISPATCHER = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "world-sse-initial-dispatch"); thread.setDaemon(true); return thread;
    });
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final WorldEventMapper mapper;
    private final WorldProperties properties;
    public WorldEventBroadcaster(WorldEventMapper mapper, WorldProperties properties) { this.mapper = mapper; this.properties = properties; }

    public SseEmitter connect(Map<String, Object> snapshot) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS); String id = "world-" + System.nanoTime();
        emitters.put(id, emitter);
        emitter.onCompletion(() -> emitters.remove(id));
        emitter.onTimeout(() -> { emitters.remove(id); emitter.complete(); });
        emitter.onError(error -> emitters.remove(id));
        // Send after the MVC async response is established so the snapshot is not lost.
        INITIAL_DISPATCHER.schedule(() -> {
            try { send(emitter, "world-state-" + Instant.now().toEpochMilli(), "world-state", snapshot); }
            catch (IOException error) { emitters.remove(id); emitter.completeWithError(error); }
        }, 250, TimeUnit.MILLISECONDS);
        return emitter;
    }

    public void publishRuntimeEvent(Map<String, Object> runtimeEvent) {
        if (!properties.live()) return;
        mapper.map(runtimeEvent).ifPresent(event -> broadcast(String.valueOf(event.get("eventId")), "world-event", event));
    }

    @Scheduled(fixedDelay = 20_000L)
    public void heartbeat() { broadcast("world-heartbeat-" + Instant.now().toEpochMilli(), "heartbeat", Map.of("at", Instant.now().toString())); }

    private void broadcast(String id, String type, Object payload) {
        for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) try { send(entry.getValue(), id, type, payload); }
        catch (IOException error) { emitters.remove(entry.getKey()); entry.getValue().completeWithError(error); }
    }
    private void send(SseEmitter emitter, String id, String type, Object data) throws IOException {
        emitter.send(SseEmitter.event().id(id).name(type).data(data, MediaType.APPLICATION_JSON));
    }
}
