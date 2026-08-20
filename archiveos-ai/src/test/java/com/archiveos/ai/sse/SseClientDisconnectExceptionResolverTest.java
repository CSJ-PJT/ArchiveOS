package com.archiveos.ai.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.archiveos.ai.liveflow.InternalRuntimeIngestService;
import com.archiveos.ai.liveflow.LiveFlowController;
import com.archiveos.ai.liveflow.LiveFlowEventBroadcaster;
import com.archiveos.ai.liveflow.LiveFlowService;
import com.archiveos.ai.world.WorldAdapterController;
import com.archiveos.ai.world.WorldAdapterService;
import com.archiveos.ai.world.WorldEventBroadcaster;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SseClientDisconnectExceptionResolverTest {
    private final SseClientDisconnectExceptionResolver resolver = new SseClientDisconnectExceptionResolver();

    @Test void resolvesRecognizedDisconnectForBothSseHandlersWithoutWritingAResponse() throws Exception {
        MockHttpServletResponse liveFlowResponse = new MockHttpServletResponse();
        ModelAndView liveFlowResult = resolver.resolveException(
                mockRequest("/api/live-flow/stream"),
                liveFlowResponse,
                liveFlowHandler("stream", String.class),
                new IOException("Broken pipe"));

        MockHttpServletResponse worldResponse = new MockHttpServletResponse();
        ModelAndView worldResult = resolver.resolveException(
                mockRequest("/api/world/stream"),
                worldResponse,
                worldHandler("stream"),
                new IOException("Connection reset by peer"));

        assertThat(liveFlowResult).isNotNull();
        assertThat(liveFlowResult.isEmpty()).isTrue();
        assertThat(liveFlowResponse.getContentAsByteArray()).isEmpty();
        assertThat(worldResult).isNotNull();
        assertThat(worldResult.isEmpty()).isTrue();
        assertThat(worldResponse.getContentAsByteArray()).isEmpty();
    }

    @Test void leavesGenuineIoFailuresUnresolved() throws Exception {
        ModelAndView result = resolver.resolveException(
                mockRequest("/api/live-flow/stream"),
                new MockHttpServletResponse(),
                liveFlowHandler("stream", String.class),
                new IOException("Unable to serialize runtime event"));

        assertThat(result).isNull();
    }

    @Test void leavesDisconnectsOutsideExactSseHandlersUnresolved() throws Exception {
        ModelAndView wrongPath = resolver.resolveException(
                mockRequest("/api/live-flow/summary"),
                new MockHttpServletResponse(),
                liveFlowHandler("summary"),
                new IOException("Broken pipe"));
        ModelAndView wrongReturnType = resolver.resolveException(
                mockRequest("/api/live-flow/stream"),
                new MockHttpServletResponse(),
                liveFlowHandler("summary"),
                new IOException("Broken pipe"));

        assertThat(wrongPath).isNull();
        assertThat(wrongReturnType).isNull();
    }

    @Test void resolvesDisconnectDuringActualMvcAsyncRedispatch() throws Exception {
        LiveFlowService service = mock(LiveFlowService.class);
        LiveFlowEventBroadcaster broadcaster = mock(LiveFlowEventBroadcaster.class);
        SseEmitter emitter = new SseEmitter();
        when(service.streamSnapshot()).thenReturn(java.util.Map.of());
        when(broadcaster.connect(any(), any())).thenReturn(emitter);
        LiveFlowController controller = new LiveFlowController(
                service, broadcaster, mock(InternalRuntimeIngestService.class));
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setHandlerExceptionResolvers(resolver)
                .build();

        MvcResult initial = mockMvc.perform(get("/api/live-flow/stream"))
                .andExpect(request().asyncStarted())
                .andReturn();
        emitter.completeWithError(new IOException("Broken pipe"));

        mockMvc.perform(asyncDispatch(initial)).andExpect(status().isOk());
    }

    private MockHttpServletRequest mockRequest(String path) {
        return new MockHttpServletRequest("GET", path);
    }

    private HandlerMethod liveFlowHandler(String method, Class<?>... parameterTypes) throws Exception {
        LiveFlowController controller = new LiveFlowController(
                mock(LiveFlowService.class),
                mock(LiveFlowEventBroadcaster.class),
                mock(InternalRuntimeIngestService.class));
        return new HandlerMethod(controller, LiveFlowController.class.getMethod(method, parameterTypes));
    }

    private HandlerMethod worldHandler(String method, Class<?>... parameterTypes) throws Exception {
        WorldAdapterController controller = new WorldAdapterController(
                mock(WorldAdapterService.class), mock(WorldEventBroadcaster.class));
        return new HandlerMethod(controller, WorldAdapterController.class.getMethod(method, parameterTypes));
    }
}
