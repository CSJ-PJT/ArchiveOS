package com.archiveos.ai.notification;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {
    private final List<NotificationPort> ports;

    public NotificationService(List<NotificationPort> ports) {
        this.ports = ports;
    }

    public List<NotificationResult> send(String message) {
        return ports.stream().map(port -> port.send(message)).toList();
    }

    public boolean configured(String channel) {
        return ports.stream().anyMatch(port -> port.channel().equals(channel) && port.configured());
    }

    public Map<String, Boolean> configuration() {
        return ports.stream().collect(Collectors.toMap(NotificationPort::channel, NotificationPort::configured));
    }
}
