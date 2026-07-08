package com.archiveos.ai.atlas;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AtlasService {
    private static final String SYSTEM_ID = "atlas-platform";
    private final AtlasRepository repository;
    private final HttpClient httpClient;

    public AtlasService(AtlasRepository repository) {
        this(repository, HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build());
    }

    AtlasService(AtlasRepository repository, HttpClient httpClient) {
        this.repository = repository;
        this.httpClient = httpClient;
    }

    public Map<String, Object> overview() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("system", repository.system(SYSTEM_ID));
        value.put("services", repository.services(SYSTEM_ID));
        value.put("environment_requirements", repository.environmentRequirements(SYSTEM_ID));
        value.put("recent_healthchecks", repository.recentHealthcheckResults(SYSTEM_ID, 10));
        value.put("recent_work_logs", repository.workLogs(SYSTEM_ID, 10));
        return value;
    }

    public List<Map<String, Object>> services() { return repository.services(SYSTEM_ID); }
    public List<Map<String, Object>> recentHealthchecks(int limit) { return repository.recentHealthcheckResults(SYSTEM_ID, limit); }
    public List<Map<String, Object>> workLogs(int limit) { return repository.workLogs(SYSTEM_ID, limit); }

    @Transactional
    public Map<String, Object> runHealthchecks() {
        List<Map<String, Object>> services = repository.services(SYSTEM_ID);
        List<Map<String, Object>> results = new ArrayList<>();
        boolean criticalFailure = false;
        boolean nonCriticalFailure = false;

        for (Map<String, Object> service : services) {
            if (!Boolean.TRUE.equals(service.get("enabled"))) continue;
            Map<String, Object> result = check(service);
            results.add(result);
            String status = String.valueOf(result.get("status"));
            String criticality = String.valueOf(service.get("criticality"));
            String serviceStatus = "ok".equals(status) ? "normal" : ("Critical".equalsIgnoreCase(criticality) ? "down" : "degraded");
            repository.updateServiceStatus(String.valueOf(service.get("service_id")), serviceStatus);
            if (!"ok".equals(status) && "Critical".equalsIgnoreCase(criticality)) criticalFailure = true;
            if (!"ok".equals(status) && !"Critical".equalsIgnoreCase(criticality)) nonCriticalFailure = true;
        }

        String systemStatus;
        String reason;
        if (criticalFailure) {
            systemStatus = "down_candidate";
            reason = "One or more Critical Atlas services failed healthcheck.";
        } else if (nonCriticalFailure) {
            systemStatus = "degraded";
            reason = "One or more non-critical Atlas services failed healthcheck.";
        } else {
            systemStatus = "normal";
            reason = "All enabled Atlas healthchecks returned expected status.";
        }
        repository.updateSystemStatus(SYSTEM_ID, systemStatus, reason);

        Map<String, Object> value = new LinkedHashMap<>();
        value.put("system_status", systemStatus);
        value.put("reason", reason);
        value.put("results", results);
        return value;
    }

    public Map<String, Object> check(Map<String, Object> service) {
        String serviceId = String.valueOf(service.get("service_id"));
        String url = String.valueOf(service.get("healthcheck_url"));
        int expectedStatus = number(service.get("expected_status"), 200);
        int timeoutMs = number(service.get("timeout_ms"), 4000);
        Instant started = Instant.now();
        Integer httpStatus = null;
        String status = "failed";
        String errorMessage = null;
        String excerpt = null;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .method("GET", HttpRequest.BodyPublishers.noBody())
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            httpStatus = response.statusCode();
            status = httpStatus == expectedStatus ? "ok" : "failed";
            excerpt = safeExcerpt(response.body());
            if (!"ok".equals(status)) errorMessage = "Expected HTTP " + expectedStatus + " but received " + httpStatus + ".";
        } catch (Exception error) {
            errorMessage = error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage());
        }
        int latencyMs = (int) Duration.between(started, Instant.now()).toMillis();
        return repository.recordHealthcheck(serviceId, status, httpStatus, latencyMs, expectedStatus, errorMessage, excerpt);
    }

    @Transactional
    public Map<String, Object> createWorkLog(JsonNode body) {
        requireObject(body);
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("work_title", requiredText(body, "workTitle", "workTitle must not be empty."));
        values.put("target_system_id", optionalText(body, "targetSystemId", SYSTEM_ID));
        values.put("target_service_id", optionalText(body, "targetServiceId", null));
        values.put("repository", optionalText(body, "repository", null));
        values.put("started_at", optionalText(body, "startedAt", null));
        values.put("finished_at", optionalText(body, "finishedAt", null));
        values.put("actor", optionalText(body, "actor", "Codex"));
        values.put("agent", optionalText(body, "agent", null));
        values.put("model", optionalText(body, "model", null));
        values.put("reasoning_level", optionalText(body, "reasoningLevel", null));
        values.put("task_summary", optionalText(body, "taskSummary", null));
        values.put("changed_files", arrayOrEmpty(body, "changedFiles"));
        values.put("test_results", arrayOrEmpty(body, "testResults"));
        values.put("failure_reason", optionalText(body, "failureReason", null));
        values.put("next_actions", arrayOrEmpty(body, "nextActions"));
        values.put("committed", booleanValue(body, "committed"));
        values.put("pushed", booleanValue(body, "pushed"));
        values.put("deployed", booleanValue(body, "deployed"));
        values.put("rollback_plan", optionalText(body, "rollbackPlan", null));
        return repository.createWorkLog(values);
    }

    private void requireObject(JsonNode body) {
        if (body == null || !body.isObject()) throw new AtlasValidationException("Request body must be a JSON object.");
    }

    private String requiredText(JsonNode body, String name, String error) {
        String value = optionalText(body, name, null);
        if (value == null || value.isBlank()) throw new AtlasValidationException(error);
        return value.trim();
    }

    private String optionalText(JsonNode body, String name, String fallback) {
        JsonNode value = body.get(name);
        if (value == null || value.isNull()) return fallback;
        if (!value.isTextual()) throw new AtlasValidationException(name + " must be a string.");
        return value.textValue();
    }

    private List<Object> arrayOrEmpty(JsonNode body, String name) {
        JsonNode value = body.get(name);
        if (value == null || value.isNull()) return List.of();
        if (!value.isArray()) throw new AtlasValidationException(name + " must be an array.");
        List<Object> rows = new ArrayList<>();
        value.forEach(item -> rows.add(item.isValueNode() ? item.asText() : item.toString()));
        return rows;
    }

    private boolean booleanValue(JsonNode body, String name) {
        JsonNode value = body.get(name);
        if (value == null || value.isNull()) return false;
        if (!value.isBoolean()) throw new AtlasValidationException(name + " must be a boolean.");
        return value.booleanValue();
    }

    private int number(Object value, int fallback) {
        return value instanceof Number number ? number.intValue() : fallback;
    }

    private String safeExcerpt(String body) {
        if (body == null || body.isBlank()) return null;
        String text = body.replaceAll("\\s+", " ").trim();
        return text.length() > 240 ? text.substring(0, 240) : text;
    }
}
