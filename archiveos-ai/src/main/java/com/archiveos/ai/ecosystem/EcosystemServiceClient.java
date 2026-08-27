package com.archiveos.ai.ecosystem;

import com.archiveos.ai.obsidian.Json;
import com.archiveos.ai.security.ArchiveScopeRegistry;
import com.archiveos.ai.security.SecurityProperties;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Component;

@Component
public class EcosystemServiceClient {
    private static final String ARCHIVE_OS_SOURCE = "archive-os";

    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final SecurityProperties security;

    public EcosystemServiceClient(SecurityProperties security) {
        this.security = security;
    }

    public IntegrationResult get(String baseUrl, String path, int timeoutMs) {
        return exchange("GET", baseUrl, path, null, timeoutMs,
                security.authenticatedReadToken(), ArchiveScopeRegistry.AUTHENTICATED_READ);
    }

    public IntegrationResult post(String baseUrl, String path, Object body, int timeoutMs) {
        return exchange("POST", baseUrl, path, body, timeoutMs,
                security.adminOperatorToken(), ArchiveScopeRegistry.ADMIN_OPERATE);
    }

    public IntegrationResult postAuthorized(String baseUrl, String path, Object body, int timeoutMs,
                                            String token, String scope) {
        return exchange("POST", baseUrl, path, body, timeoutMs, token, scope);
    }

    private IntegrationResult exchange(String method, String baseUrl, String path, Object body, int timeoutMs,
                                       String token, String scope) {
        Instant started = Instant.now();
        if (baseUrl == null || baseUrl.isBlank()) {
            return new IntegrationResult(EcosystemServiceStatus.DISABLED, null, Map.of(), "Base URL is not configured.", 0);
        }
        if (token == null || token.isBlank() || scope == null || scope.isBlank()) {
            return new IntegrationResult(EcosystemServiceStatus.DEGRADED, null, Map.of(),
                    "Outbound service credentials are not configured.", latency(started));
        }
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri(baseUrl, path))
                    .timeout(Duration.ofMillis(Math.max(timeoutMs, 500)))
                    .header("accept", "application/json")
                    .header(ArchiveScopeRegistry.AUTHORIZATION, "Bearer " + token)
                    .header(ArchiveScopeRegistry.SOURCE_HEADER, ARCHIVE_OS_SOURCE)
                    .header(ArchiveScopeRegistry.SCOPE_HEADER, scope);
            if ("POST".equals(method)) {
                builder.header("content-type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body == null ? "{}" : Json.write(body)));
            } else {
                builder.GET();
            }
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            Map<String, Object> parsed = parseBody(response.body());
            EcosystemServiceStatus status = response.statusCode() >= 200 && response.statusCode() < 300
                    ? EcosystemServiceStatus.HEALTHY
                    : EcosystemServiceStatus.DEGRADED;
            String error = status == EcosystemServiceStatus.HEALTHY ? null : "HTTP " + response.statusCode();
            return new IntegrationResult(status, response.statusCode(), parsed, error, latency(started));
        } catch (Exception error) {
            String message = error.getClass().getSimpleName();
            Throwable cause = error.getCause();
            if (error instanceof ConnectException || cause instanceof ConnectException) message = "Connection refused";
            if (error instanceof TimeoutException || error instanceof HttpTimeoutException
                    || cause instanceof TimeoutException || cause instanceof HttpTimeoutException) {
                message = "Request timed out";
            }
            return new IntegrationResult(EcosystemServiceStatus.UNAVAILABLE, null, Map.of(), message, latency(started));
        }
    }

    private URI uri(String baseUrl, String path) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String suffix = path == null || path.isBlank() ? "" : path.startsWith("/") ? path : "/" + path;
        return URI.create(base + suffix);
    }

    private long latency(Instant started) {
        return Duration.between(started, Instant.now()).toMillis();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseBody(String body) {
        Object parsed = Json.readObjectArrayCompatible(body);
        if (parsed instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        if (parsed instanceof List<?> list) {
            Map<String, Object> wrapped = new LinkedHashMap<>();
            wrapped.put("items", list);
            wrapped.put("count", list.size());
            return wrapped;
        }
        return Map.of();
    }
}
