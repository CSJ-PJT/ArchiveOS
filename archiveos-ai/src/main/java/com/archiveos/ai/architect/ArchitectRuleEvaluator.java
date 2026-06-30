package com.archiveos.ai.architect;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ArchitectRuleEvaluator {
    public Evaluation evaluate(String title, String description, Map<String, Object> metadata) {
        String text = (title + "\n" + description + "\n" + metadata).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        List<Map<String, Object>> findings = new ArrayList<>();
        List<Map<String, Object>> recommendations = new ArrayList<>();

        if (has(text, "dashboard") && hasAny(text, "control", "execute", "start process", "stop process", "start/stop"))
            add(findings, recommendations, "boundary_risk", "warning", "Dashboard should remain read-only. Move control behavior to Operators or Settings.", "dashboard + control/execute/process wording", "Split visibility UI from process-control design. Keep Dashboard as PM overview only.");
        if (hasAny(text, "arbitrary shell", "direct mcp execution", "mcp command execution", "codex control", "codex direct control"))
            add(findings, recommendations, "execution_risk", "blocked", "Execution control must remain disabled or explicitly allowlisted.", "execution-control wording", "Keep this task metadata-only or route future execution through a separately reviewed allowlist.");
        if (hasAny(text, "historian", "knowledge") && hasAny(text, "bidirectional sync", "graph database", "embeddings", "vector search"))
            add(findings, recommendations, "knowledge_scope_risk", "warning", "Out of MVP scope. Keep metadata-only Knowledge Graph.", "knowledge/historian + advanced retrieval/sync wording", "Store conservative metadata links first. Defer embeddings, graph DB, and bidirectional Obsidian sync.");
        if (hasAny(text, "webhook url exposed", "service role frontend", "service_role frontend", "vault path frontend", "secret frontend"))
            add(findings, recommendations, "security_risk", "blocked", "Secret/path exposure risk.", "secret or local path exposure wording", "Keep service role keys, webhook URLs, and absolute vault paths backend-only.");

        List<String> surfaces = List.of("dashboard", "operators", "timeline", "settings").stream().filter(text::contains).toList();
        if (surfaces.size() >= 3)
            add(findings, recommendations, "responsibility_split", "warning", "One task appears to modify multiple PM surfaces. Decompose responsibilities.", String.join(", ", surfaces), "Split into separate Dashboard, Operators, Timeline, and Settings tasks unless a single data contract requires one change.");

        boolean validationRelevant = hasAny(text, "batch", "report", "runtime", "backend", "frontend", "dashboard");
        boolean validationPresent = has(text, "npm run build") && has(text, "typecheck") && has(text, "backend build");
        if (validationRelevant && !validationPresent)
            add(findings, recommendations, "missing_validation", "warning", "Runtime/report/backend task should include frontend build, backend typecheck, and backend build validation.", "validation commands not found in task text", "Add validation: npm run build, cd backend && npm run typecheck, cd backend && npm run build.");

        return new Evaluation(findings, recommendations);
    }

    private void add(List<Map<String, Object>> findings, List<Map<String, Object>> recommendations, String rule, String severity, String message, String evidence, String recommendation) {
        Map<String, Object> finding = new LinkedHashMap<>(); finding.put("rule", rule); finding.put("severity", severity); finding.put("message", message); finding.put("evidence", evidence); findings.add(finding);
        recommendations.add(Map.of("rule", rule, "message", recommendation));
    }
    private boolean has(String value, String needle) { return value.contains(needle); }
    private boolean hasAny(String value, String... needles) { for (String needle : needles) if (value.contains(needle)) return true; return false; }
    public record Evaluation(List<Map<String, Object>> findings, List<Map<String, Object>> recommendations) {}
}
