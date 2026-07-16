# ArchiveOS internal synthetic runtime ingest

This endpoint is a service-to-service boundary for synthetic Archive runtime events. It is not a browser or public API.

## Endpoint and authentication

`POST /api/live-flow/events/ingest`

Required headers:

```http
Authorization: Bearer ${ARCHIVE_TOKEN_<SOURCE>_TO_OS}
X-Archive-Source-System: archive-market
X-Archive-Service-Scope: runtime:ingest
```

Allowed source systems are `archive-market`, `archive-nexus`, `archive-logistics`, and `archive-ledger`. The source header must match the payload `sourceSystem`; the scope header must be exactly `runtime:ingest`.

The token is supplied only through local secret configuration:

```text
ARCHIVE_TOKEN_MARKET_TO_OS=
ARCHIVE_TOKEN_NEXUS_TO_OS=
ARCHIVE_TOKEN_LOGISTICS_TO_OS=
ARCHIVE_TOKEN_LEDGER_TO_OS=
ARCHIVE_INTERNAL_INGEST_ENABLED=true
```

The service role is limited to `runtime:ingest`; it cannot approve decisions, write Memory, sync Obsidian, analyze incidents, or access deployment/process controls.

## Payload

Required fields are `eventId`, `correlationId`, `entityId`, `sourceSystem`, `targetSystem`, `eventType`, and `occurredAt`.

`orderId`, `causationId`, and `simulationRunId` are optional. They support non-order runtime events, official root events, and legacy events without weakening the correlated-flow contract:

- a missing, JSON `null`, or blank `orderId` is normalized to absent metadata and means that the event is not part of an order aggregate;
- a missing, JSON `null`, or blank `causationId` is normalized to absent metadata and is projected as `ROOT_EVENT` in the Timeline;
- an event with a supplied `causationId` whose parent is not yet ingested is projected as `EXTERNAL_PARENT_NOT_INGESTED` rather than being fabricated;
- placeholders such as `ROOT`, `N/A`, or `UNKNOWN` are prohibited.
- a missing, JSON `null`, or blank `simulationRunId` is normalized to absent metadata; ArchiveOS never fabricates a run identifier;
- when present, `simulationRunId` is preserved in event metadata and exposed by the Correlation Timeline. The Timeline reports the persisted distinct run count for that correlation.

`correlationId` remains required for every event accepted by this ingest endpoint. An independent runtime event therefore uses its own real correlation identifier; a settlement cycle identifier must not be substituted for it.

Nested `data` or `event` envelopes are accepted. ArchiveOS preserves supplied correlation, order, entity, causation, and simulation run values. These keys are written to event metadata only when they have a real value; secret-like nested payload data is not copied to metadata. This is an ingest-contract change only: no database migration is required.

The request body is limited to 64 KiB. Malformed JSON and contract failures return `400`; missing, invalid, or scope-less credentials return `401`; and a credential source that disagrees with `sourceSystem` returns `403`.

## Retry behavior

- `2xx`: published; the response has `duplicate=true` for an already stored `eventId`.
- `401/403`: credential or source configuration error; do not retry indefinitely.
- `400`: payload contract error; dead-letter for correction.
- `408/429/5xx`: retry with bounded backoff.

`eventId` is the idempotency key. The `ecosystem_flow_event.event_id` unique constraint and the application duplicate response both prevent duplicate rows.
