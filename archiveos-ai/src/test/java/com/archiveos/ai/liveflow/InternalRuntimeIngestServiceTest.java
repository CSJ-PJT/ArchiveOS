package com.archiveos.ai.liveflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.archiveos.ai.audit.AuditLogService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class InternalRuntimeIngestServiceTest {
    @Test void acceptsAllowlistedServiceAndPreservesContractFieldsWithoutRawSecrets() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        AuditLogService audit = Mockito.mock(AuditLogService.class);
        when(repository.existsEventId("evt-1")).thenReturn(false);
        when(repository.upsert(any())).thenReturn(Map.of("event_id", "evt-1"));
        InternalRuntimeIngestService service = new InternalRuntimeIngestService(repository, audit);

        Map<String, Object> result = service.ingest(payload("archive-market"), "archive-market");

        assertThat(result).containsEntry("accepted", true).containsEntry("duplicate", false);
        ArgumentCaptor<LiveFlowEvent> event = ArgumentCaptor.forClass(LiveFlowEvent.class);
        verify(repository).upsert(event.capture());
        assertThat(event.getValue().correlationId()).isEqualTo("corr-1");
        assertThat(event.getValue().entityId()).isEqualTo("ord-1");
        assertThat(event.getValue().metadata()).containsEntry("orderId", "ord-1").containsEntry("causationId", "evt-root").containsEntry("simulationRunId", "SIM-1");
        assertThat(event.getValue().metadata()).doesNotContainKey("apiKey");
    }

    @Test void rejectsSourceMismatchAndMissingRequiredContractFields() {
        InternalRuntimeIngestService service = new InternalRuntimeIngestService(Mockito.mock(LiveFlowRepository.class), Mockito.mock(AuditLogService.class));

        assertThatThrownBy(() -> service.ingest(payload("archive-market"), "archive-ledger"))
                .isInstanceOf(SecurityException.class);
        Map<String, Object> missingTarget = payload("archive-market");
        missingTarget.remove("targetSystem");
        assertThatThrownBy(() -> service.ingest(missingTarget, "archive-market"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("targetSystem");
    }

    @Test void marksKnownEventAsDuplicateWithoutCreatingASecondContract() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        when(repository.existsEventId("evt-1")).thenReturn(true);
        when(repository.upsert(any())).thenReturn(Map.of("event_id", "evt-1"));

        Map<String, Object> result = new InternalRuntimeIngestService(repository, Mockito.mock(AuditLogService.class))
                .ingest(payload("archive-market"), "archive-market");

        assertThat(result).containsEntry("duplicate", true);
        verify(repository).upsert(any(LiveFlowEvent.class));
    }

    @Test void preservesSuppliedSimulationRunIdForEveryAllowedRuntimeSource() {
        for (String source : java.util.List.of("archive-market", "archive-nexus", "archive-logistics", "archive-ledger")) {
            LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
            when(repository.existsEventId("evt-1")).thenReturn(false);
            when(repository.upsert(any())).thenReturn(Map.of("event_id", "evt-1"));

            new InternalRuntimeIngestService(repository, Mockito.mock(AuditLogService.class)).ingest(payload(source), source);

            ArgumentCaptor<LiveFlowEvent> event = ArgumentCaptor.forClass(LiveFlowEvent.class);
            verify(repository).upsert(event.capture());
            assertThat(event.getValue().metadata()).containsEntry("simulationRunId", "SIM-1");
        }
    }

    @Test void acceptsIndependentRuntimeEventWithoutOrderOrCausation() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        AuditLogService audit = Mockito.mock(AuditLogService.class);
        when(repository.existsEventId("evt-1")).thenReturn(false);
        when(repository.upsert(any())).thenReturn(Map.of("event_id", "evt-1"));

        Map<String, Object> payload = payload("archive-ledger");
        payload.remove("orderId");
        payload.remove("causationId");
        payload.remove("simulationRunId");
        Map<String, Object> result = new InternalRuntimeIngestService(repository, audit).ingest(payload, "archive-ledger");

        ArgumentCaptor<LiveFlowEvent> event = ArgumentCaptor.forClass(LiveFlowEvent.class);
        verify(repository).upsert(event.capture());
        assertThat(result).containsEntry("accepted", true);
        assertThat(event.getValue().metadata()).doesNotContainKeys("orderId", "causationId", "simulationRunId");
        verify(audit).recordEvent(org.mockito.ArgumentMatchers.eq("internal_runtime_ingest"),
                org.mockito.ArgumentMatchers.eq("archive-ledger"), org.mockito.ArgumentMatchers.eq("corr-1"),
                org.mockito.ArgumentMatchers.eq("evt-1"), org.mockito.ArgumentMatchers.argThat(value ->
                                Boolean.FALSE.equals(value.get("orderIdPresent"))
                                && Boolean.FALSE.equals(value.get("causationIdPresent"))
                                && Boolean.FALSE.equals(value.get("simulationRunIdPresent"))
                                && Boolean.TRUE.equals(value.get("rootEvent"))));
    }

    @Test void normalizesBlankOptionalLineageFieldsToAbsentMetadata() {
        LiveFlowRepository repository = Mockito.mock(LiveFlowRepository.class);
        when(repository.existsEventId("evt-1")).thenReturn(false);
        when(repository.upsert(any())).thenReturn(Map.of("event_id", "evt-1"));
        Map<String, Object> payload = payload("archive-logistics");
        payload.put("orderId", "   ");
        payload.put("causationId", "");
        payload.put("simulationRunId", "  ");

        new InternalRuntimeIngestService(repository, Mockito.mock(AuditLogService.class)).ingest(payload, "archive-logistics");

        ArgumentCaptor<LiveFlowEvent> event = ArgumentCaptor.forClass(LiveFlowEvent.class);
        verify(repository).upsert(event.capture());
        assertThat(event.getValue().metadata()).doesNotContainKeys("orderId", "causationId", "simulationRunId");
    }

    private Map<String, Object> payload(String source) {
        return new LinkedHashMap<>(Map.ofEntries(
                Map.entry("eventId", "evt-1"), Map.entry("correlationId", "corr-1"), Map.entry("causationId", "evt-root"),
                Map.entry("orderId", "ord-1"), Map.entry("simulationRunId", "SIM-1"), Map.entry("entityId", "ord-1"), Map.entry("sourceSystem", source),
                Map.entry("targetSystem", "archiveos"), Map.entry("eventType", "MARKET_ORDER_PLACED"),
                Map.entry("occurredAt", "2026-07-12T00:00:00Z"), Map.entry("apiKey", "must-not-be-persisted")));
    }
}
