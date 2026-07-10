package com.archiveos.ai.approval;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ExternalApprovalController {
    private final ExternalApprovalService service;

    public ExternalApprovalController(ExternalApprovalService service) {
        this.service = service;
    }

    @PostMapping("/api/approvals/external")
    public ResponseEntity<Map<String, Object>> request(@RequestBody(required = false) JsonNode body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(service.request(body)));
    }

    @PostMapping("/api/integrations/market/events/review")
    public ResponseEntity<Map<String, Object>> marketReviewEvent(@RequestBody(required = false) JsonNode body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(service.marketReviewEvent(body)));
    }

    @GetMapping("/api/approvals/external")
    public Map<String, Object> list(@RequestParam(defaultValue = "50") int limit,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String source) {
        return envelope(service.list(status, source, limit));
    }

    @GetMapping("/api/approvals/external/summary")
    public Map<String, Object> summary() {
        return envelope(service.summary());
    }

    @GetMapping("/api/approvals/external/{approvalRequestId}")
    public Map<String, Object> detail(@PathVariable String approvalRequestId) {
        return envelope(service.detail(approvalRequestId));
    }

    @PostMapping("/api/approvals/external/{approvalRequestId}/approve")
    public Map<String, Object> approve(@PathVariable String approvalRequestId, @RequestBody(required = false) JsonNode body) {
        return envelope(service.decide(approvalRequestId, "APPROVED", body));
    }

    @PostMapping("/api/approvals/external/{approvalRequestId}/reject")
    public Map<String, Object> reject(@PathVariable String approvalRequestId, @RequestBody(required = false) JsonNode body) {
        return envelope(service.decide(approvalRequestId, "REJECTED", body));
    }

    @PostMapping("/api/approvals/external/{approvalRequestId}/hold")
    public Map<String, Object> hold(@PathVariable String approvalRequestId, @RequestBody(required = false) JsonNode body) {
        return envelope(service.decide(approvalRequestId, "HOLD", body));
    }

    @ExceptionHandler(ExternalApprovalValidationException.class)
    public ResponseEntity<Map<String, Object>> validation(ExternalApprovalValidationException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
