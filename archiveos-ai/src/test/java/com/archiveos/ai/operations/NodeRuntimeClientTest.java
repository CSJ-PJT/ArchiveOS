package com.archiveos.ai.operations;

import static org.assertj.core.api.Assertions.assertThat;

import com.archiveos.ai.security.ArchiveScopeRegistry;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class NodeRuntimeClientTest {
    @Test void authenticatesInternalRuntimeReadWithoutExposingToken() throws Exception {
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> source = new AtomicReference<>();
        AtomicReference<String> scope = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/local-runtime/status", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst(ArchiveScopeRegistry.AUTHORIZATION));
            source.set(exchange.getRequestHeaders().getFirst(ArchiveScopeRegistry.SOURCE_HEADER));
            scope.set(exchange.getRequestHeaders().getFirst(ArchiveScopeRegistry.SCOPE_HEADER));
            byte[] body = "{\"data\":{\"queue\":{\"inbox\":1}}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            NodeRuntimeClient client = new NodeRuntimeClient(
                    "http://127.0.0.1:" + server.getAddress().getPort(), "test-admin-token");

            assertThat(client.runtime()).containsKey("queue");
            assertThat(authorization.get()).isEqualTo("Bearer test-admin-token");
            assertThat(source.get()).isEqualTo("archive-os");
            assertThat(scope.get()).isEqualTo("admin:operate");
        } finally {
            server.stop(0);
        }
    }
}
