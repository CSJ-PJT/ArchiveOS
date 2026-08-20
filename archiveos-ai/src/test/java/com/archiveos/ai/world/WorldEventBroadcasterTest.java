package com.archiveos.ai.world;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class WorldEventBroadcasterTest {
    @Test void runtimePublishEvictsDisconnectedClientAndContinuesOtherClients() throws IOException {
        WorldEventMapper mapper = Mockito.mock(WorldEventMapper.class);
        WorldProperties properties = liveProperties();
        Map<String, Object> runtimeEvent = Map.of("event_id", "source-one");
        when(mapper.map(runtimeEvent)).thenReturn(Optional.of(Map.of("eventId", "world-one")));
        WorldEventBroadcaster broadcaster = new WorldEventBroadcaster(mapper, properties);
        SseEmitter failed = Mockito.mock(SseEmitter.class);
        SseEmitter healthy = Mockito.mock(SseEmitter.class);
        broadcaster.registerEmitter("failed", failed);
        broadcaster.registerEmitter("healthy", healthy);
        doThrow(new IllegalStateException("AsyncContext has already completed"))
                .when(failed).send(any(SseEmitter.SseEventBuilder.class));

        assertThatCode(() -> {
            broadcaster.publishRuntimeEvent(runtimeEvent);
            broadcaster.publishRuntimeEvent(runtimeEvent);
        }).doesNotThrowAnyException();

        verify(failed, times(1)).send(any(SseEmitter.SseEventBuilder.class));
        verify(failed, never()).completeWithError(any());
        verify(healthy, times(2)).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test void heartbeatEvictsBrokenPipeClientAndContinuesOtherClients() throws IOException {
        WorldEventBroadcaster broadcaster = new WorldEventBroadcaster(
                Mockito.mock(WorldEventMapper.class), liveProperties());
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

    private WorldProperties liveProperties() {
        WorldProperties properties = new WorldProperties();
        properties.setAdapterMode("live");
        return properties;
    }
}
