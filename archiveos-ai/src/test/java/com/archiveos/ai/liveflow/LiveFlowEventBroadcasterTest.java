package com.archiveos.ai.liveflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class LiveFlowEventBroadcasterTest {
    @Test void replaysInMemoryHistoryAfterLastEventIdWithoutDuplicates() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        LiveFlowEventBroadcaster broadcaster = new LiveFlowEventBroadcaster(repository);
        broadcaster.publish(event("one"));
        broadcaster.publish(event("two"));
        broadcaster.publish(event("two"));
        broadcaster.publish(event("three"));

        assertThat(broadcaster.replayCandidates("one")).extracting(value -> value.get("event_id")).containsExactly("two", "three");
        verify(repository, never()).findAfterEventId(Mockito.anyString(), Mockito.anyInt());
    }

    @Test void restoresReplayFromDatabaseWhenHistoryIsEmpty() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        when(repository.existsEventId("checkpoint")).thenReturn(true);
        when(repository.findAfterEventId("checkpoint", 250)).thenReturn(List.of(event("two"), event("three")));

        LiveFlowEventBroadcaster broadcaster = new LiveFlowEventBroadcaster(repository);

        assertThat(broadcaster.replayCandidates("checkpoint")).extracting(value -> value.get("event_id")).containsExactly("two", "three");
        verify(repository).findAfterEventId("checkpoint", 250);
    }

    @Test void ignoresMissingOrInvalidLastEventId() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        when(repository.existsEventId("missing")).thenReturn(false);
        when(repository.findAfterEventId("missing", 250)).thenReturn(List.of());
        LiveFlowEventBroadcaster broadcaster = new LiveFlowEventBroadcaster(repository);

        assertThat(broadcaster.replayCandidates(null)).isEmpty();
        assertThat(broadcaster.replayCandidates("missing")).isEmpty();
        verify(repository).existsEventId("missing");
    }

    @Test void publishEvictsRuntimeFailedClientAndContinuesOtherClients() throws IOException {
        LiveFlowEventBroadcaster broadcaster = new LiveFlowEventBroadcaster(Mockito.mock(LiveFlowRepository.class));
        SseEmitter failed = Mockito.mock(SseEmitter.class);
        SseEmitter healthy = Mockito.mock(SseEmitter.class);
        broadcaster.registerEmitter("failed", failed);
        broadcaster.registerEmitter("healthy", healthy);
        doThrow(new IllegalStateException("AsyncContext has already completed"))
                .when(failed).send(any(SseEmitter.SseEventBuilder.class));

        assertThatCode(() -> {
            broadcaster.publish(event("one"));
            broadcaster.publish(event("two"));
        }).doesNotThrowAnyException();

        verify(failed, times(1)).send(any(SseEmitter.SseEventBuilder.class));
        verify(failed, never()).completeWithError(any());
        verify(healthy, times(2)).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test void heartbeatEvictsBrokenPipeClientAndContinuesOtherClients() throws IOException {
        LiveFlowEventBroadcaster broadcaster = new LiveFlowEventBroadcaster(Mockito.mock(LiveFlowRepository.class));
        SseEmitter failed = Mockito.mock(SseEmitter.class);
        SseEmitter healthy = Mockito.mock(SseEmitter.class);
        broadcaster.registerEmitter("failed", failed);
        broadcaster.registerEmitter("healthy", healthy);
        doThrow(new IOException("Broken pipe"))
                .when(failed).send(any(SseEmitter.SseEventBuilder.class));

        assertThatCode(() -> {
            broadcaster.heartbeat();
            broadcaster.heartbeat();
        }).doesNotThrowAnyException();

        verify(failed, times(1)).send(any(SseEmitter.SseEventBuilder.class));
        verify(failed, never()).completeWithError(any());
        verify(healthy, times(2)).send(any(SseEmitter.SseEventBuilder.class));
    }

    private Map<String, Object> event(String id) {
        return Map.of("event_id", id, "received_at", Instant.now().toString());
    }
}
