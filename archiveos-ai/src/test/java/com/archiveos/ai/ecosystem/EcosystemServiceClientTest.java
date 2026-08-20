package com.archiveos.ai.ecosystem;

import com.archiveos.ai.security.ArchiveScopeRegistry;
import com.archiveos.ai.security.SecurityProperties;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EcosystemServiceClientTest {
    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> source = new AtomicReference<>();
    private final AtomicReference<String> scope = new AtomicReference<>();
    private final AtomicReference<String> method = new AtomicReference<>();
    private final AtomicInteger requests = new AtomicInteger();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/probe", this::handle);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void getUsesAuthenticatedReadIdentityWithoutLeakingToken() {
        EcosystemServiceClient client = new EcosystemServiceClient(properties("read-secret", "admin-secret"));

        IntegrationResult result = client.get(baseUrl, "/probe", 2_000);

        assertThat(result.ok()).isTrue();
        assertThat(method.get()).isEqualTo("GET");
        assertThat(authorization.get()).isEqualTo("Bearer read-secret");
        assertThat(source.get()).isEqualTo("archive-os");
        assertThat(scope.get()).isEqualTo(ArchiveScopeRegistry.AUTHENTICATED_READ);
        assertThat(result.toString()).doesNotContain("read-secret");
    }

    @Test
    void genericPostUsesAdminOperatorIdentity() {
        EcosystemServiceClient client = new EcosystemServiceClient(properties("read-secret", "admin-secret"));

        IntegrationResult result = client.post(baseUrl, "/probe", Map.of("dryRun", true), 2_000);

        assertThat(result.ok()).isTrue();
        assertThat(method.get()).isEqualTo("POST");
        assertThat(authorization.get()).isEqualTo("Bearer admin-secret");
        assertThat(source.get()).isEqualTo("archive-os");
        assertThat(scope.get()).isEqualTo(ArchiveScopeRegistry.ADMIN_OPERATE);
        assertThat(result.toString()).doesNotContain("admin-secret");
    }

    @Test
    void explicitlyAuthorizedPostUsesLedgerCallbackContract() {
        EcosystemServiceClient client = new EcosystemServiceClient(properties("read-secret", "admin-secret"));

        IntegrationResult result = client.postAuthorized(baseUrl, "/probe", Map.of(), 2_000,
                "callback-secret", ArchiveScopeRegistry.LEDGER_APPROVAL_CALLBACK);

        assertThat(result.ok()).isTrue();
        assertThat(authorization.get()).isEqualTo("Bearer callback-secret");
        assertThat(source.get()).isEqualTo("archive-os");
        assertThat(scope.get()).isEqualTo(ArchiveScopeRegistry.LEDGER_APPROVAL_CALLBACK);
        assertThat(result.toString()).doesNotContain("callback-secret");
    }

    @Test
    void missingOutboundCredentialsFailClosedWithoutSendingRequest() {
        EcosystemServiceClient client = new EcosystemServiceClient(properties("", ""));

        IntegrationResult result = client.get(baseUrl, "/probe", 2_000);

        assertThat(result.status()).isEqualTo(EcosystemServiceStatus.DEGRADED);
        assertThat(result.errorMessage()).isEqualTo("Outbound service credentials are not configured.");
        assertThat(requests.get()).isZero();
    }

    private void handle(HttpExchange exchange) throws IOException {
        requests.incrementAndGet();
        method.set(exchange.getRequestMethod());
        authorization.set(exchange.getRequestHeaders().getFirst(ArchiveScopeRegistry.AUTHORIZATION));
        source.set(exchange.getRequestHeaders().getFirst(ArchiveScopeRegistry.SOURCE_HEADER));
        scope.set(exchange.getRequestHeaders().getFirst(ArchiveScopeRegistry.SCOPE_HEADER));
        exchange.getRequestBody().readAllBytes();
        byte[] response = "{\"data\":{\"ok\":true}}".getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("content-type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }

    private SecurityProperties properties(String readToken, String adminToken) {
        return new SecurityProperties("", "", "", false,
                "", "", "", "", readToken, adminToken,
                30, 5, 15, false);
    }
}
