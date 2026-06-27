package com.archiveos.ai.notification;

public interface NotificationPort {
    String channel();
    boolean configured();
    NotificationResult send(String message);
}
