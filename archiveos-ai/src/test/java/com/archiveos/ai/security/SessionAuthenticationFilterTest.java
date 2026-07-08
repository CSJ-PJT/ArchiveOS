package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

class SessionAuthenticationFilterTest {
    @Test
    void authenticatesArchiveNexusIntegrationTokenAsAdmin() throws Exception {
        SessionService sessions = new SessionService(new SecurityProperties("admin", "shared-token", 30, 5, 15, false));
        SessionAuthenticationFilter filter = new SessionAuthenticationFilter(sessions);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks");
        request.addHeader("X-ArchiveOS-Integration-Token", "shared-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        final Object[] principal = new Object[1];
        FilterChain chain = (servletRequest, servletResponse) ->
                principal[0] = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        filter.doFilter(request, response, chain);

        assertThat(principal[0]).isInstanceOf(PlatformSession.class);
        PlatformSession session = (PlatformSession) principal[0];
        assertThat(session.actor()).isEqualTo("archive-nexus");
        assertThat(session.role()).isEqualTo(PlatformRole.ADMIN);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
