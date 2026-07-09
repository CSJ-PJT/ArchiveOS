package com.archiveos.ai.ecosystem;

import com.archiveos.ai.obsidian.Json;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Component;

@Component
public class EcosystemServiceClient {
    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    public IntegrationResult get(String baseUrl, String path, int timeoutMs) {
        return exchange("GET", baseUrl, path, null, timeoutMs);
    }

    public IntegrationResult post(String baseUrl, String path, Object body, int timeoutMs) {
        return exchange("POST", baseUrl, path, body, timeoutMs);
    }

    private IntegrationResult exchange(String method, String baseUrl, String path, Object body, int timeoutMs) {
        Instant started = Instant.now();
        if (baseUrl == null || baseUrl.isBlank()) {
            return new IntegrationResult(EcosystemServiceStatus.DISABLED, null, Map.of(), "Base URL is not configured.", 0);
        }
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri(baseUrl, path))
                    .timeout(Duration.ofMillis(Math.max(timeoutMs, 500)))
                    .header("accept", "application/json");
            if ("POST".equals(method)) {
                builder.header("content-type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body == null ? "{}" : Json.write(body)));
            } else {
                builder.GET();
            }
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            Map<String, Object> parsed = Json.readObject(response.body());
            EcosystemServiceStatus status = response.statusCode() >= 200 && response.statusCode() < 300
                    ? EcosystemServiceStatus.HEALTHY
                    : EcosystemServiceStatus.DEGRADED;
            String error = status == EcosystemServiceStatus.HEALTHY ? null : "HTTP " + response.statusCode();
            return new IntegrationResult(status, response.statusCode(), parsed, error, latency(started));
        } catch (Exception error) {
            String message = error.getClass().getSimpleName();
            Throwable cause = error.getCause();
            if (error instanceof ConnectException || cause instanceof ConnectException) message = "Connection refused";
            if (error instanceof TimeoutException) message = "Timeout";
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
}
