package com.archiveos.ai.security;

import com.archiveos.ai.notification.NotificationService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SecurityThreatNotificationService {
    private static final Duration COOLDOWN = Duration.ofMinutes(5);
    private final NotificationService notifications;
    private final Clock clock;
    private final Map<String, Instant> lastSent = new ConcurrentHashMap<>();

    @Autowired
    public SecurityThreatNotificationService(NotificationService notifications) {
        this(notifications, Clock.systemUTC());
    }

    SecurityThreatNotificationService(NotificationService notifications, Clock clock) {
        this.notifications = notifications;
        this.clock = clock;
    }

    public synchronized boolean notifyLoginLockout(String clientIp) {
        String safeIp = safeIp(clientIp);
        Instant now = clock.instant();
        String key = "login-lockout:" + safeIp;
        Instant previous = lastSent.get(key);
        if (previous != null && previous.plus(COOLDOWN).isAfter(now)) return false;
        lastSent.put(key, now);

        String message = String.join("\n",
                "[ArchiveOS Security Threat]",
                "심각도: HIGH",
                "이벤트: 반복 로그인 실패로 접근 잠금",
                "식별 IP: " + safeIp,
                "경로: POST /api/auth/login",
                "차단 상태: HTTP 429",
                "탐지 시각: " + now,
                "비밀번호, 토큰 및 요청 본문은 수집하거나 전송하지 않았습니다.");
        return notifications.send(message).stream()
                .anyMatch(result -> "slack".equals(result.channel()) && result.sent());
    }

    private String safeIp(String value) {
        if (value == null || value.isBlank() || value.length() > 64
                || !value.matches("[0-9a-fA-F:.%]+")) return "0.0.0.0";
        return value;
    }
}
