package com.archiveos.ai.activity;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityService {
    private static final Set<String> LOG_TYPES = Set.of("summary", "decision", "error", "review");
    private static final Set<String> COMMAND_STATUSES = Set.of("pending", "running", "succeeded", "failed");
    private final ActivityRepository repository;
    public ActivityService(ActivityRepository repository) { this.repository = repository; }

    public List<Map<String, Object>> recentWorkLogs() { return repository.recentWorkLogs(20); }
    public List<Map<String, Object>> recentCommands() { return repository.recentCommands(20); }

    @Transactional
    public Map<String, Object> createWorkLog(JsonNode body) {
        requireObject(body);
        String taskId = optionalString(body, "task_id", "task_id must be a string or null.");
        String agentId = optionalString(body, "agent_id", "agent_id must be a string or null.");
        String logType = text(body, "log_type", "log_type must be one of summary, decision, error, review.");
        if (!LOG_TYPES.contains(logType)) fail("log_type must be one of summary, decision, error, review.");
        String content = text(body, "content", "content must not be empty.").trim();
        if (content.isEmpty()) fail("content must not be empty.");
        return repository.createWorkLog(taskId, agentId, logType, content);
    }

    @Transactional
    public Map<String, Object> createCommand(JsonNode body) {
        requireObject(body);
        String command = text(body, "command", "command must not be empty.").trim();
        if (command.isEmpty()) fail("command must not be empty.");
        String commandType = optionalString(body, "command_type", "command_type must be a string or null.");
        String requested = body.has("status") ? text(body, "status", "status must be one of pending, running, succeeded, failed.") : "pending";
        if (!COMMAND_STATUSES.contains(requested)) fail("status must be one of pending, running, succeeded, failed.");
        String status = "succeeded".equals(requested) ? "succeeded" : "pending";
        String result = optionalString(body, "result", "result must be a string or null.");
        if (result == null) result = "succeeded".equals(status)
                ? "Command intent recorded as succeeded. Real execution is not enabled yet."
                : "Command recorded as pending. Real execution is not enabled yet.";
        return repository.createCommand(command, commandType, status, result);
    }

    private void requireObject(JsonNode body) {
        if (body == null || !body.isObject()) fail("Request body must be a JSON object.");
    }
    private String text(JsonNode body, String name, String error) {
        JsonNode value = body.get(name);
        if (value == null || !value.isTextual()) fail(error);
        return value.textValue();
    }
    private String optionalString(JsonNode body, String name, String error) {
        JsonNode value = body.get(name);
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) fail(error);
        return value.textValue();
    }
    private static void fail(String message) { throw new ActivityValidationException(message); }
}
