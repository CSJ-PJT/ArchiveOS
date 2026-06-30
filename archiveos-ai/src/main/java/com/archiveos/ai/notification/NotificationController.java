package com.archiveos.ai.notification;

import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class NotificationController {
    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @PostMapping("/api/notifications")
    public ResponseEntity<Map<String, Object>> send(@Valid @RequestBody NotificationRequest request) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("results", notifications.send(request.message()));
        return ResponseEntity.ok(Map.of("data", data));
    }
}
