package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

class SessionAuthenticationFilterTest {
    @Test
    void authenticatesArchiveNexusRuntimeIngestTokenWithNarrowServiceRole() throws Exception {
        SessionService sessions = new SessionService(properties());
        SessionAuthenticationFilter filter = new SessionAuthenticationFilter(sessions);
        MockHttpServletRequest request = runtimeIngestRequest("archive-nexus", "nexus-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        final Object[] principal = new Object[1];
        FilterChain chain = (servletRequest, servletResponse) ->
                principal[0] = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        filter.doFilter(request, response, chain);

        assertThat(principal[0]).isInstanceOf(PlatformSession.class);
        PlatformSession session = (PlatformSession) principal[0];
        assertThat(session.actor()).isEqualTo("archive-nexus");
        assertThat(session.role()).isEqualTo(PlatformRole.ARCHIVE_INTERNAL_SERVICE);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void mapsEachAllowedRuntimeSourceToItsOwnCredential() throws Exception {
        for (String[] value : new String[][]{
                {"archive-market", "market-token"},
                {"archive-nexus", "nexus-token"},
                {"archive-logistics", "logistics-token"},
                {"archive-ledger", "ledger-token"}}) {
            SessionAuthenticationFilter filter = new SessionAuthenticationFilter(new SessionService(properties()));
            final Object[] principal = new Object[1];
            filter.doFilter(runtimeIngestRequest(value[0], value[1]), new MockHttpServletResponse(),
                    (servletRequest, servletResponse) -> principal[0] = SecurityContextHolder.getContext().getAuthentication().getPrincipal());
            PlatformSession session = (PlatformSession) principal[0];
            assertThat(session.actor()).isEqualTo(value[0]);
            assertThat(session.role()).isEqualTo(PlatformRole.ARCHIVE_INTERNAL_SERVICE);
        }
    }

    @Test
    void rejectsCredentialPresentedForAnotherRuntimeSource() throws Exception {
        SessionAuthenticationFilter filter = new SessionAuthenticationFilter(new SessionService(properties()));
        final Object[] authentication = new Object[1];
        filter.doFilter(runtimeIngestRequest("archive-ledger", "market-token"), new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> authentication[0] = SecurityContextHolder.getContext().getAuthentication());
        assertThat(authentication[0]).isNull();
    }

    @Test
    void serviceTokenCannotAuthenticateOutsideItsRuntimeIngestBoundary() throws Exception {
        SessionService sessions = new SessionService(properties());
        SessionAuthenticationFilter filter = new SessionAuthenticationFilter(sessions);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/ai/decisions/example/approve");
        request.addHeader("Authorization", "Bearer ledger-token");
        request.addHeader("X-Archive-Source-System", "archive-ledger");
        request.addHeader("X-Archive-Service-Scope", "runtime:ingest");
        MockHttpServletResponse response = new MockHttpServletResponse();

        final Object[] authentication = new Object[1];
        FilterChain chain = (servletRequest, servletResponse) ->
                authentication[0] = SecurityContextHolder.getContext().getAuthentication();

        filter.doFilter(request, response, chain);

        assertThat(authentication[0]).isNull();
    }

    @Test
    void authenticatesOnlyScopedInternalRuntimeIngestService() throws Exception {
        SessionService sessions = new SessionService(properties());
        SessionAuthenticationFilter filter = new SessionAuthenticationFilter(sessions);
        MockHttpServletRequest request = runtimeIngestRequest("archive-market", "market-token");

        final Object[] principal = new Object[1];
        filter.doFilter(request, new MockHttpServletResponse(), (servletRequest, servletResponse) ->
                principal[0] = SecurityContextHolder.getContext().getAuthentication().getPrincipal());

        PlatformSession session = (PlatformSession) principal[0];
        assertThat(session.actor()).isEqualTo("archive-market");
        assertThat(session.role()).isEqualTo(PlatformRole.ARCHIVE_INTERNAL_SERVICE);
    }

    @Test
    void rejectsInternalIngestTokenWithoutRuntimeScope() throws Exception {
        SessionService sessions = new SessionService(properties());
        SessionAuthenticationFilter filter = new SessionAuthenticationFilter(sessions);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/live-flow/events/ingest");
        request.addHeader("Authorization", "Bearer market-token");
        request.addHeader("X-Archive-Source-System", "archive-market");

        final Object[] authentication = new Object[1];
        filter.doFilter(request, new MockHttpServletResponse(), (servletRequest, servletResponse) ->
                authentication[0] = SecurityContextHolder.getContext().getAuthentication());

        assertThat(authentication[0]).isNull();
    }

    private static SecurityProperties properties() {
        return new SecurityProperties("admin", "", "", false,
                "market-token", "nexus-token", "logistics-token", "ledger-token",
                "read-token", "admin-token", 30, 5, 15, false);
    }

    private static MockHttpServletRequest runtimeIngestRequest(String source, String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/live-flow/events/ingest");
        request.addHeader("Authorization", "Bearer " + token);
        request.addHeader("X-Archive-Source-System", source);
        request.addHeader("X-Archive-Service-Scope", "runtime:ingest");
        return request;
    }
}
