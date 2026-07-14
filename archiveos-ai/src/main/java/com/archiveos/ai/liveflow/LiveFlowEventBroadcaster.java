package com.archiveos.ai.liveflow;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.http.MediaType;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Small in-process SSE fan-out for normalized flow events.  Events are already
 * persisted by {@link LiveFlowRepository}; this component only delivers the
 * persisted representation to connected read-only dashboards.
 */
@Component
public class LiveFlowEventBroadcaster {
    private static final Logger log = LoggerFactory.getLogger(LiveFlowEventBroadcaster.class);
    private static final long TIMEOUT_MS = 15 * 60 * 1000L;
    private static final int HISTORY_LIMIT = 250;
    private static final ScheduledExecutorService INITIAL_DISPATCHER = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "live-flow-sse-initial-dispatch");
        thread.setDaemon(true);
        return thread;
    });
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<Map<String, Object>> history = new CopyOnWriteArrayList<>();
    private final LiveFlowRepository repository;

    public LiveFlowEventBroadcaster(@Lazy LiveFlowRepository repository) {
        this.repository = repository;
    }

    public SseEmitter connect(String lastEventId, Map<String, Object> snapshot) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        String id = "emitter-" + System.nanoTime();
        emitters.put(id, emitter);
        emitter.onCompletion(() -> emitters.remove(id));
        emitter.onTimeout(() -> {
            emitters.remove(id);
            emitter.complete();
        });
        emitter.onError(error -> emitters.remove(id));
        // The MVC async response is established only after this method returns. Dispatching the
        // initial snapshot on the next task prevents the first SSE frame from being lost.
        INITIAL_DISPATCHER.schedule(() -> {
            try {
                send(emitter, "snapshot-" + Instant.now().toEpochMilli(), "snapshot", snapshot);
                replayAfter(emitter, lastEventId);
            } catch (IOException error) {
                emitters.remove(id);
                emitter.completeWithError(error);
            }
        }, 500, TimeUnit.MILLISECONDS);
        return emitter;
    }

    public void publish(Map<String, Object> event) {
        if (event == null || event.isEmpty()) return;
        Map<String, Object> safe = new LinkedHashMap<>(event);
        String eventId = String.valueOf(safe.getOrDefault("event_id", "flow-" + System.nanoTime()));
        history.removeIf(previous -> eventId.equals(String.valueOf(previous.get("event_id"))));
        history.add(safe);
        while (history.size() > HISTORY_LIMIT) history.remove(0);
        for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
            try {
                send(entry.getValue(), eventId, "runtime-event", safe);
            } catch (IOException error) {
                emitters.remove(entry.getKey());
                entry.getValue().completeWithError(error);
            }
        }
    }

    public void publishStatus(Map<String, Object> status) {
        broadcast("service-status-" + Instant.now().toEpochMilli(), "service-status", status);
    }

    @Scheduled(fixedDelay = 20_000L)
    public void heartbeat() {
        broadcast("heartbeat-" + Instant.now().toEpochMilli(), "heartbeat", Map.of("at", Instant.now().toString()));
    }

    void replayAfter(SseEmitter emitter, String lastEventId) throws IOException {
        for (Map<String, Object> event : replayCandidates(lastEventId)) {
            send(emitter, String.valueOf(event.get("event_id")), "runtime-event", event);
        }
    }

    List<Map<String, Object>> replayCandidates(String lastEventId) {
        if (lastEventId == null || lastEventId.isBlank()) return List.of();
        int start = -1;
        for (int index = 0; index < history.size(); index++) {
            if (lastEventId.equals(String.valueOf(history.get(index).get("event_id")))) {
                start = index;
                break;
            }
        }
        List<Map<String, Object>> candidates;
        if (start >= 0) {
            candidates = history.subList(start + 1, history.size());
        } else {
            if (!repository.existsEventId(lastEventId)) log.warn("Live Flow Last-Event-ID was not found; sending snapshot only. eventId={}", lastEventId);
            candidates = repository.findAfterEventId(lastEventId, HISTORY_LIMIT);
        }
        Map<String, Map<String, Object>> unique = new LinkedHashMap<>();
        for (Map<String, Object> event : candidates) {
            String eventId = String.valueOf(event.get("event_id"));
            if (!lastEventId.equals(eventId)) unique.putIfAbsent(eventId, event);
        }
        return List.copyOf(unique.values());
    }

    private void broadcast(String id, String type, Map<String, Object> payload) {
        for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
            try {
                send(entry.getValue(), id, type, payload);
            } catch (IOException error) {
                emitters.remove(entry.getKey());
                entry.getValue().completeWithError(error);
            }
        }
    }

    private void send(SseEmitter emitter, String id, String type, Object payload) throws IOException {
        emitter.send(SseEmitter.event().id(id).name(type).data(payload, MediaType.APPLICATION_JSON));
    }
}
