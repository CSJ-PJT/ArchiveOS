package com.archiveos.ai.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientAddressResolverTest {
    @Test
    void prefersTrustedRealIpHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Real-IP", "203.0.113.15");
        request.addHeader("X-Forwarded-For", "198.51.100.3, 10.0.0.1");

        assertThat(ClientAddressResolver.resolve(request)).isEqualTo("203.0.113.15");
    }

    @Test
    void fallsBackToFirstForwardedLiteralAndRejectsHostnames() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Real-IP", "not-an-ip.example");
        request.addHeader("X-Forwarded-For", "198.51.100.8, 10.0.0.1");

        assertThat(ClientAddressResolver.resolve(request)).isEqualTo("198.51.100.8");
    }

    @Test
    void usesRemoteAddressWhenProxyHeadersAreMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("2001:db8::7");

        assertThat(ClientAddressResolver.resolve(request)).isEqualTo("2001:db8:0:0:0:0:0:7");
    }
}
