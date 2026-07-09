package com.archiveos.ai.approval.callback;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApprovalCallbackOutboxController {
    private final ApprovalCallbackOutboxService service;
    public ApprovalCallbackOutboxController(ApprovalCallbackOutboxService service) { this.service = service; }

    @GetMapping("/api/approvals/callbacks")
    public Map<String, Object> list(@RequestParam(defaultValue = "50") int limit) { return envelope(service.list(limit)); }

    @GetMapping("/api/approvals/callbacks/{callbackId}")
    public Map<String, Object> detail(@PathVariable String callbackId) { return envelope(service.detail(callbackId)); }

    @PostMapping("/api/approvals/callbacks/{callbackId}/retry")
    public Map<String, Object> retry(@PathVariable String callbackId) { return envelope(service.retry(callbackId)); }

    @PostMapping("/api/approvals/callbacks/retry-failed")
    public Map<String, Object> retryFailed() { return envelope(service.retryFailed()); }

    private Map<String, Object> envelope(Object data) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("data", data);
        return value;
    }
}
