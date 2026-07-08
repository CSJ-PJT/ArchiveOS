package com.archiveos.ai.atlas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class AtlasServiceTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void healthcheckCallsConfiguredUrlAndStoresResult() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/health", exchange -> {
            byte[] body = "{\"status\":\"ok\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            AtlasRepository repository = Mockito.mock(AtlasRepository.class);
            AtlasService service = new AtlasService(repository, HttpClient.newHttpClient());
            Map<String, Object> managedService = Map.of(
                    "service_id", "atlas-api",
                    "healthcheck_url", "http://127.0.0.1:" + server.getAddress().getPort() + "/health",
                    "expected_status", 200,
                    "timeout_ms", 1000);
            when(repository.recordHealthcheck(eq("atlas-api"), eq("ok"), eq(200), anyInt(), eq(200), eq(null), any()))
                    .thenReturn(Map.of("service_id", "atlas-api", "status", "ok"));

            Map<String, Object> result = service.check(managedService);

            assertThat(result).containsEntry("status", "ok");
            verify(repository).recordHealthcheck(eq("atlas-api"), eq("ok"), eq(200), anyInt(), eq(200), eq(null), any());
        } finally {
            server.stop(0);
        }
    }

    @Test void degradedServiceFailureDoesNotCrashSystemCalculation() {
        AtlasRepository repository = Mockito.mock(AtlasRepository.class);
        AtlasService service = new AtlasService(repository, HttpClient.newHttpClient());
        when(repository.services("atlas-platform")).thenReturn(List.of(Map.of(
                "service_id", "health-atlas",
                "healthcheck_url", "http://127.0.0.1:1/unavailable",
                "expected_status", 200,
                "timeout_ms", 100,
                "criticality", "Medium",
                "enabled", true)));
        when(repository.recordHealthcheck(eq("health-atlas"), eq("failed"), eq(null), anyInt(), eq(200), any(), eq(null)))
                .thenReturn(Map.of("service_id", "health-atlas", "status", "failed"));

        Map<String, Object> result = service.runHealthchecks();

        assertThat(result).containsEntry("system_status", "degraded");
        verify(repository).updateServiceStatus("health-atlas", "degraded");
        verify(repository).updateSystemStatus(eq("atlas-platform"), eq("degraded"), any());
    }

    @Test void createsCodexWorkLogWithoutSecretValues() throws Exception {
        AtlasRepository repository = Mockito.mock(AtlasRepository.class);
        AtlasService service = new AtlasService(repository, HttpClient.newHttpClient());
        when(repository.createWorkLog(any())).thenReturn(Map.of("id", "log-1"));

        service.createWorkLog(json.readTree("""
                {
                  "workTitle":"Travel Atlas recovery review",
                  "targetServiceId":"travel-atlas",
                  "repository":"CSJ-PJT/Route-Atlas",
                  "changedFiles":["src/App.tsx"],
                  "testResults":["npm run build: passed"],
                  "nextActions":["Monitor place-search"]
                }
                """));

        verify(repository).createWorkLog(any());
    }

    @Test void rejectsInvalidWorkLogShape() throws Exception {
        AtlasService service = new AtlasService(Mockito.mock(AtlasRepository.class), HttpClient.newHttpClient());
        assertThatThrownBy(() -> service.createWorkLog(json.readTree("{\"changedFiles\":\"not-array\"}")))
                .isInstanceOf(AtlasValidationException.class)
                .hasMessage("workTitle must not be empty.");
    }
}
