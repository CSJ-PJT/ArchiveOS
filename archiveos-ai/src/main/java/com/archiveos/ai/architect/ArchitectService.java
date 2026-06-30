package com.archiveos.ai.architect;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class ArchitectService {
    private final ArchitectRepository repository;
    private final ArchitectRuleEvaluator evaluator;
    public ArchitectService(ArchitectRepository repository, ArchitectRuleEvaluator evaluator) { this.repository = repository; this.evaluator = evaluator; }

    public Map<String, Object> review(JsonNode body) {
        if (body == null || !body.isObject()) throw new ArchitectValidationException("Request body must be a JSON object.");
        String targetType = required(body, "targetType"), targetRef = required(body, "targetRef"), title = required(body, "title"), description = required(body, "description");
        JsonNode metadataNode = body.get("metadata");
        if (metadataNode != null && !metadataNode.isObject()) throw new ArchitectValidationException("metadata must be a JSON object when provided.");
        @SuppressWarnings("unchecked") Map<String, Object> metadata = metadataNode == null ? Map.of() : new com.fasterxml.jackson.databind.ObjectMapper().convertValue(metadataNode, Map.class);
        var evaluation = evaluator.evaluate(title, description, metadata);
        String status = evaluation.findings().stream().anyMatch(item -> "blocked".equals(item.get("severity"))) ? "blocked" : evaluation.findings().stream().anyMatch(item -> "warning".equals(item.get("severity"))) ? "warning" : "reviewed";
        String summary = "blocked".equals(status) ? "Architect blocked this target with " + evaluation.findings().size() + " finding(s)." : "warning".equals(status) ? "Architect found " + evaluation.findings().size() + " design risk(s)." : "Architect review passed with no rule-based findings.";
        List<Map<String, Object>> related;
        try { related = repository.related(targetRef, title); } catch (Exception ignored) { related = List.of(); }
        return repository.insert(targetType, targetRef, status, summary, evaluation.findings(), evaluation.recommendations(), related);
    }
    public List<Map<String, Object>> recent(int limit) { return repository.recent(limit); }
    public Map<String, Object> latest() { return repository.latest(); }
    private String required(JsonNode body, String field) { JsonNode value = body.get(field); if (value == null || !value.isTextual() || value.textValue().trim().isEmpty()) throw new ArchitectValidationException(field + " is required."); return value.textValue().trim(); }
}
