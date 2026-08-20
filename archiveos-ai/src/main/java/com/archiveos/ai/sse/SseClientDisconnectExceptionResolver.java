package com.archiveos.ai.sse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.handler.AbstractHandlerExceptionResolver;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.DisconnectedClientHelper;

/** Resolves only expected client aborts from ArchiveOS SSE streams after the emitter is evicted. */
@Component
public final class SseClientDisconnectExceptionResolver extends AbstractHandlerExceptionResolver {
    private static final Set<String> SSE_PATHS = Set.of("/api/live-flow/stream", "/api/world/stream");

    public SseClientDisconnectExceptionResolver() {
        setOrder(Ordered.HIGHEST_PRECEDENCE);
    }

    @Override
    protected ModelAndView doResolveException(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception error) {
        if (!SSE_PATHS.contains(pathWithinApplication(request))) return null;
        if (!(handler instanceof HandlerMethod handlerMethod)) return null;
        if (!SseEmitter.class.isAssignableFrom(handlerMethod.getMethod().getReturnType())) return null;
        if (!DisconnectedClientHelper.isClientDisconnectedException(error)) return null;

        // The response is already unusable. An empty ModelAndView marks the exception resolved
        // without trying to write an error payload back to the disconnected client.
        return new ModelAndView();
    }

    private String pathWithinApplication(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String contextPath = request.getContextPath();
        return contextPath.isEmpty() ? requestUri : requestUri.substring(contextPath.length());
    }
}
