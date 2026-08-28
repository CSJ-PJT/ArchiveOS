package com.archiveos.ai.operations;

import com.archiveos.ai.security.ArchiveScopeRegistry;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class NodeRuntimeClient {
    private final RestClient client;

    public NodeRuntimeClient(
            @Value("${archiveos.node-base-url:http://localhost:4000}") String baseUrl,
            @Value("${archiveos.security.admin-operator-token:}") String adminToken) {
        RestClient.Builder builder = RestClient.builder().baseUrl(baseUrl);
        if (adminToken != null && !adminToken.isBlank()) {
            builder.defaultHeader(ArchiveScopeRegistry.AUTHORIZATION, "Bearer " + adminToken.trim())
                    .defaultHeader(ArchiveScopeRegistry.SOURCE_HEADER, "archive-os")
                    .defaultHeader(ArchiveScopeRegistry.SCOPE_HEADER, ArchiveScopeRegistry.ADMIN_OPERATE);
        }
        this.client = builder.build();
    }

    public Map<String, Object> runtime() {
        Map<String, Object> envelope = client.get().uri("/api/local-runtime/status").retrieve()
                .body(new ParameterizedTypeReference<>() {});
        Object data = envelope == null ? null : envelope.get("data");
        if (data instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked") Map<String, Object> typed = (Map<String, Object>) map;
            return typed;
        }
        throw new IllegalStateException("Node runtime API returned no data.");
    }
}
