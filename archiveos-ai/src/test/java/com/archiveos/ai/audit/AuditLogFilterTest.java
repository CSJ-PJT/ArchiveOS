package com.archiveos.ai.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AuditLogFilterTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void recordsMutationWithOldAndNewValues() throws Exception {
        AuditLogService audit = mock(AuditLogService.class);
        JsonNode oldValue = mapper.readTree("{\"status\":\"queued\"}");
        when(audit.snapshot("/api/tasks/11111111-1111-1111-1111-111111111111")).thenReturn(oldValue, (JsonNode) null);
        AuditLogFilter filter = new AuditLogFilter(audit, mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks/11111111-1111-1111-1111-111111111111");
        request.addHeader("X-Correlation-Id", "CORR-1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (servletRequest, servletResponse) -> {
            HttpServletResponse http = (HttpServletResponse) servletResponse;
            http.setStatus(201);
            http.getWriter().write("{\"data\":{\"status\":\"done\"}}");
        };

        filter.doFilter(request, response, chain);

        ArgumentCaptor<JsonNode> newValue = ArgumentCaptor.forClass(JsonNode.class);
        verify(audit).record(eq("POST"), eq("/api/tasks/11111111-1111-1111-1111-111111111111"),
                eq(201), eq("CORR-1"), eq(oldValue), newValue.capture());
        assertThat(newValue.getValue().path("data").path("status").asText()).isEqualTo("done");
        assertThat(response.getHeader("X-Correlation-Id")).isEqualTo("CORR-1");
    }
}
