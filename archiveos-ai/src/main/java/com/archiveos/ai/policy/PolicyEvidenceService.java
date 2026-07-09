package com.archiveos.ai.policy;

import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PolicyEvidenceService {
    private final JdbcTemplate jdbc;

    public PolicyEvidenceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String snapshot(String approvalRequestId, String sourceService, String question, String evidenceText,
                           String evidenceSource, String ragStatus, String relatedPolicy) {
        String evidenceId = "EV-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        jdbc.update("""
                insert into public.policy_evidence_snapshot(
                  evidence_id, approval_request_id, source_service, question, evidence_text, evidence_source, rag_status, related_policy)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, evidenceId, approvalRequestId, sourceService, question == null ? "No policy question provided." : question,
                evidenceText, evidenceSource, ragStatus, relatedPolicy);
        return evidenceId;
    }

    public Map<String, Object> fallbackEvidence(Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = request.get("metadata") instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        String source = String.valueOf(request.getOrDefault("source_service", request.getOrDefault("source", "Archive-Ledger")));
        String eventType = String.valueOf(metadata.getOrDefault("eventType", "UNKNOWN_EVENT"));
        String severity = String.valueOf(metadata.getOrDefault("severity", "UNKNOWN"));
        String amount = String.valueOf(request.getOrDefault("amount", "n/a"));
        String currency = String.valueOf(request.getOrDefault("currency", "KRW"));
        String policy = "Archive-Ledger".equalsIgnoreCase(source)
                ? "docs/policies/synthetic-finance-settlement-policies.md"
                : source.toLowerCase().contains("logitics")
                    ? "docs/policies/synthetic-logistics-approval-policies.md"
                    : "docs/policies/synthetic-cross-service-operations-policies.md";
        String text = "Synthetic policy fallback evidence: source=" + source
                + ", eventType=" + eventType
                + ", amount=" + amount + " " + currency
                + ", severity=" + severity
                + ". High-value, delayed, cold-chain, critical, or APPROVAL_REQUIRED synthetic events must pass a human approval gate before settlement/reconciliation can proceed.";
        return Map.of("text", text, "policy", policy);
    }
}
