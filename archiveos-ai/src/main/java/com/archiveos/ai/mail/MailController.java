package com.archiveos.ai.mail;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mail")
public class MailController {
    private final MailService mail;

    public MailController(MailService mail) {
        this.mail = mail;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("data", mail.status());
    }

    @GetMapping("/messages")
    public Map<String, Object> messages(@RequestParam(defaultValue = "inbox") String folder,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return Map.of("data", mail.list(folder, page, size));
    }

    @GetMapping("/messages/{id}")
    public ResponseEntity<Map<String, Object>> message(@PathVariable UUID id) {
        try { return ResponseEntity.ok(Map.of("data", mail.get(id))); }
        catch (MailService.MailNotFoundException missing) { return ResponseEntity.notFound().build(); }
    }

    @PatchMapping("/messages/{id}/read")
    public ResponseEntity<Map<String, Object>> markRead(@PathVariable UUID id, @RequestBody(required = false) ReadRequest request) {
        try { return ResponseEntity.ok(Map.of("data", mail.markRead(id, request == null || request.read()))); }
        catch (MailService.MailNotFoundException missing) { return ResponseEntity.notFound().build(); }
    }

    @DeleteMapping("/messages")
    public Map<String, Object> deleteMessages(@RequestBody DeleteMessagesRequest request) {
        return Map.of("data", mail.deleteSelected(request.ids()));
    }

    @DeleteMapping("/messages/folder")
    public Map<String, Object> deleteFolder(@RequestParam String folder) {
        return Map.of("data", mail.deleteFolder(folder));
    }

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> send(@Valid @RequestBody SendRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", mail.send(
                request.to(), request.cc() == null ? List.of() : request.cc(), request.subject(), request.text(), request.html())));
    }

    @PostMapping(value = "/webhooks/resend", consumes = "application/json")
    public ResponseEntity<Map<String, Object>> webhook(
            @RequestHeader(value = "svix-id", required = false) String svixId,
            @RequestHeader(value = "svix-timestamp", required = false) String svixTimestamp,
            @RequestHeader(value = "svix-signature", required = false) String svixSignature,
            @RequestBody String rawBody) {
        try {
            return ResponseEntity.ok(Map.of("data", mail.receiveWebhook(rawBody, svixId, svixTimestamp, svixSignature)));
        } catch (MailService.InvalidWebhookException invalid) {
            return ResponseEntity.badRequest().body(Map.of("error", invalid.getMessage()));
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }

    @ExceptionHandler(ResendMailGateway.MailConfigurationException.class)
    public ResponseEntity<Map<String, Object>> notConfigured(ResendMailGateway.MailConfigurationException error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", error.getMessage()));
    }

    @ExceptionHandler(ResendMailGateway.MailProviderException.class)
    public ResponseEntity<Map<String, Object>> providerFailure(ResendMailGateway.MailProviderException error) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", error.getMessage()));
    }

    public record SendRequest(List<String> to, List<String> cc, @NotBlank String subject, String text, String html) {}
    public record ReadRequest(boolean read) {}
    public record DeleteMessagesRequest(List<UUID> ids) {}
}
