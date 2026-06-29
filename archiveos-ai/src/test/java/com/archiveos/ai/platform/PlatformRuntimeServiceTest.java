package com.archiveos.ai.platform;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class PlatformRuntimeServiceTest {
    @Test void preservesLegacyRuntimeVersionFields() {
        Map<String, Object> version = new PlatformRuntimeService("", "", "abc123", "feat/java", "0.1.0").version();
        assertThat(version).containsEntry("commitSha", "abc123").containsEntry("branch", "feat/java")
                .containsEntry("backendVersion", "0.1.0").containsKeys("startedAt", "checkedAt");
    }
    @Test void usesForwardedOriginWhenBackendUrlIsNotConfigured() {
        PlatformRuntimeService service = new PlatformRuntimeService("https://console.example", "", "", "", "0.1.0");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-forwarded-proto", "https");
        request.addHeader("x-forwarded-host", "api.example");
        assertThat(service.publicAccess(request)).containsEntry("backendUrlSource", "request")
                .containsEntry("backendPublicUrl", "https://api.example")
                .containsEntry("frontendPublicUrl", "https://console.example");
    }
}
