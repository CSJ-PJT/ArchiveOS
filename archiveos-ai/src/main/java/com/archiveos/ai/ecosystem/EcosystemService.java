package com.archiveos.ai.ecosystem;

import com.archiveos.ai.integration.ledger.LedgerClient;
import com.archiveos.ai.integration.logitics.LogiticsClient;
import com.archiveos.ai.integration.nexus.NexusClient;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EcosystemService {
    private final EcosystemProperties properties;
    private final EcosystemRepository repository;
    private final NexusClient nexus;
    private final LogiticsClient logitics;
    private final LedgerClient ledger;

    public EcosystemService(EcosystemProperties properties, EcosystemRepository repository,
                            NexusClient nexus, LogiticsClient logitics, LedgerClient ledger) {
        this.properties = properties;
        this.repository = repository;
        this.nexus = nexus;
        this.logitics = logitics;
        this.ledger = ledger;
    }

    public Map<String, Object> services() {
        String traceId = traceId();
        return Map.of("traceId", traceId, "services", List.of(
                service("NEXUS", nexus.config(), latest("NEXUS")),
                service("LOGITICS", logitics.config(), latest("LOGITICS")),
                service("LEDGER", ledger.config(), latest("LEDGER"))));
    }

    @Transactional
    public Map<String, Object> refresh() {
        String traceId = traceId();
        Map<String, Object> services = checkAll(traceId);
        String status = aggregateStatus(services);
        repository.recordTimeline(traceId, null, "archiveos", "ECOSYSTEM_REFRESH", "ecosystem", "archive-platform",
                "Archive Platform ecosystem status refreshed", Map.of("status", status));
        return Map.of("traceId", traceId, "status", status, "checkedAt", Instant.now().toString(), "services", services);
    }

    public Map<String, Object> summary() {
        String traceId = traceId();
        Map<String, Object> services = currentOrCheck(traceId);
        Map<String, Object> approval = new LinkedHashMap<>(repository.approvalSummary());
        approval.putAll(repository.callbackSummary());
        return Map.of("traceId", traceId, "status", aggregateStatus(services), "checkedAt", Instant.now().toString(),
                "services", services, "approval", approval);
    }

    public Map<String, Object> topology() {
        return Map.of(
                "nodes", List.of(
                        node("archive-nexus", "Archive-Nexus", "DOMAIN", latestStatus("NEXUS")),
                        node("archive-logitics", "Archive-Logitics", "LOGISTICS", latestStatus("LOGITICS")),
                        node("archive-ledger", "Archive-Ledger", "FINANCE", latestStatus("LEDGER")),
                        node("archive-os", "ArchiveOS", "CONTROL_TOWER", "HEALTHY")),
                "edges", List.of(
                        edge("archive-nexus", "archive-logitics", "shipment event"),
                        edge("archive-logitics", "archive-ledger", "logistics cost event"),
                        edge("archive-ledger", "archive-os", "approval request"),
                        edge("archive-os", "archive-ledger", "approval callback")));
    }

    public Map<String, Object> timeline(int limit) {
        return Map.of("traceId", traceId(), "events", repository.timeline(limit));
    }

    public Map<String, Object> dryRun() {
        String traceId = traceId();
        return Map.of(
                "traceId", traceId,
                "safeMode", properties.getIntegration().isSafeMode(),
                "allowExternalWrite", properties.getIntegration().isAllowExternalWrite(),
                "status", "DRY_RUN",
                "steps", List.of(
                        step(1, "Archive-Nexus", "Generate synthetic shipment/domain event", "dry-run only"),
                        step(2, "Archive-Logitics", "Calculate route, ETA, delay, and logistics cost", "dry-run only"),
                        step(3, "Archive-Ledger", "Create synthetic transaction and mark high-risk items APPROVAL_REQUIRED", "dry-run only"),
                        step(4, "ArchiveOS", "Generate policy evidence, present approval queue, audit decision", "dry-run only"),
                        step(5, "ArchiveOS → Ledger", "Send approval callback through callback outbox", "blocked unless allow-external-write=true")));
    }

    public Map<String, Object> runDemo() {
        if (!properties.getIntegration().isAllowExternalWrite()) {
            return Map.of("traceId", traceId(), "status", "SAFE_MODE_BLOCKED",
                    "message", "External write demo is disabled. Set ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=true to run it.");
        }
        return Map.of("traceId", traceId(), "status", "NOT_IMPLEMENTED",
                "message", "Write demo orchestration is intentionally deferred; use dry-run for portfolio validation.");
    }

    private Map<String, Object> checkAll(String traceId) {
        Map<String, Object> services = new LinkedHashMap<>();
        services.put("nexus", check("NEXUS", nexus.config(), nexus.health(), nexus.outboxSummary()));
        services.put("logitics", check("LOGITICS", logitics.config(), logitics.health(), logitics.operationsSummary()));
        services.put("ledger", check("LEDGER", ledger.config(), ledger.health(), ledger.operationsSummary()));
        return services;
    }

    private Map<String, Object> currentOrCheck(String traceId) {
        if (repository.recentHealth(3).size() >= 3) {
            Map<String, Object> services = new LinkedHashMap<>();
            services.put("nexus", fromSnapshot("NEXUS"));
            services.put("logitics", fromSnapshot("LOGITICS"));
            services.put("ledger", fromSnapshot("LEDGER"));
            return services;
        }
        return checkAll(traceId);
    }

    private Map<String, Object> check(String type, EcosystemProperties.ServiceConfig config, IntegrationResult health, IntegrationResult summary) {
        if (config == null || !config.isEnabled()) return disabled(config);
        EcosystemServiceStatus status = health.status() == EcosystemServiceStatus.HEALTHY && summary.status() == EcosystemServiceStatus.HEALTHY
                ? EcosystemServiceStatus.HEALTHY
                : health.status() == EcosystemServiceStatus.UNAVAILABLE || summary.status() == EcosystemServiceStatus.UNAVAILABLE
                    ? EcosystemServiceStatus.UNAVAILABLE
                    : EcosystemServiceStatus.DEGRADED;
        Map<String, Object> body = new LinkedHashMap<>(summary.body());
        body.put("health", health.body());
        Map<String, Object> snapshot = repository.recordHealth(type, config.getName(), config.getBaseUrl(), status.name(),
                summary.httpStatus() != null ? summary.httpStatus() : health.httpStatus(), body,
                summary.errorMessage() != null ? summary.errorMessage() : health.errorMessage());
        return serviceMap(config, status.name(), snapshot.get("checked_at"), body,
                summary.errorMessage() != null ? summary.errorMessage() : health.errorMessage());
    }

    private Map<String, Object> fromSnapshot(String type) {
        Map<String, Object> snapshot = repository.latestHealth(type);
        EcosystemProperties.ServiceConfig config = properties.getEcosystem().getServices().get(type.toLowerCase(Locale.ROOT));
        if (snapshot == null) return serviceMap(config, latestStatus(type), null, Map.of(), "No health snapshot yet.");
        return serviceMap(config, String.valueOf(snapshot.get("status")), snapshot.get("checked_at"), map(snapshot.get("summary")), string(snapshot.get("error_message")));
    }

    private Map<String, Object> service(String type, EcosystemProperties.ServiceConfig config, Map<String, Object> latest) {
        return Map.of("type", type, "name", config.getName(), "enabled", config.isEnabled(), "baseUrl", config.getBaseUrl(),
                "status", latest == null ? (config.isEnabled() ? "UNKNOWN" : "DISABLED") : latest.get("status"));
    }

    private String latestStatus(String type) {
        Map<String, Object> latest = latest(type);
        return latest == null ? "UNKNOWN" : String.valueOf(latest.get("status"));
    }

    private Map<String, Object> latest(String type) { return repository.latestHealth(type); }
    private Map<String, Object> disabled(EcosystemProperties.ServiceConfig config) { return serviceMap(config, "DISABLED", null, Map.of(), "Service is disabled."); }
    private Map<String, Object> serviceMap(EcosystemProperties.ServiceConfig config, String status, Object checkedAt, Map<String, Object> summary, String error) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("status", status);
        value.put("name", config == null ? "unknown" : config.getName());
        value.put("baseUrl", config == null ? null : config.getBaseUrl());
        value.put("lastCheckedAt", checkedAt);
        value.put("summary", summary == null ? Map.of() : summary);
        value.put("errorMessage", error);
        return value;
    }

    private String aggregateStatus(Map<String, Object> services) {
        boolean unavailable = services.values().stream().map(this::status).anyMatch("UNAVAILABLE"::equals);
        boolean degraded = services.values().stream().map(this::status).anyMatch(status -> List.of("DEGRADED", "UNKNOWN").contains(status));
        return unavailable || degraded ? "DEGRADED" : "HEALTHY";
    }
    @SuppressWarnings("unchecked") private Map<String, Object> map(Object value) { return value instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of(); }
    private String status(Object value) { return String.valueOf(map(value).getOrDefault("status", "UNKNOWN")); }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private Map<String, Object> node(String id, String label, String type, String status) { return Map.of("id", id, "label", label, "type", type, "status", status); }
    private Map<String, Object> edge(String from, String to, String label) { return Map.of("from", from, "to", to, "label", label); }
    private Map<String, Object> step(int order, String service, String action, String mode) { return Map.of("order", order, "service", service, "action", action, "mode", mode); }
    private String traceId() { return "eco-" + UUID.randomUUID().toString().substring(0, 8); }
}
