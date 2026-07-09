# ArchiveOS Architecture

ArchiveOS is the Control Tower for the Archive Platform Ecosystem. It keeps the operating console, approval gateway, policy evidence, callback outbox, audit log, and external service status separated from manufacturing, logistics, and ledger domain ownership.

## Runtime

```text
React / TypeScript Operator Console
  -> Node Compatibility Backend
      -> Spring Boot API
          -> PostgreSQL / pgvector
          -> Spring AI / RAG / Fallback Evidence
          -> Spring Batch / Scheduler / Notification
```

## Ecosystem

```text
Archive-Nexus
  -> Archive-Logistics
      -> Archive-Ledger
          -> ArchiveOS

Archive-Nexus
  -> Archive-Ledger
      -> ArchiveOS
```

## Responsibilities

- Archive-Nexus owns manufacturing, shipment, maintenance, and quality event generation.
- Archive-Logistics owns synthetic route, ETA, logistics cost, risk score, and logistics outbox publishing.
- Archive-Ledger owns synthetic transaction normalization, double-entry ledger, settlement, reconciliation, and approval callback application.
- ArchiveOS owns ecosystem observability, approval decisioning, policy evidence, callback outbox tracking, audit logging, and failure isolation.

## Failure Model

- `HEALTHY`: service returned the expected status.
- `DEGRADED`: service is reachable but partially failed or returned a degraded summary.
- `UNAVAILABLE`: service timed out, refused connection, or could not be reached.
- `DISABLED`: service integration is explicitly disabled.
- `UNKNOWN`: no recent snapshot exists.

ArchiveOS returns ecosystem status even when external services fail. External failure must not terminate the ArchiveOS runtime.

## Safe-mode

ArchiveOS defaults to read-only operation:

- `ARCHIVE_INTEGRATION_SAFE_MODE=true`
- `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=false`

External write actions such as Nexus event generation, Nexus publish, Logistics publish, ecosystem demo run, and Ledger callback are blocked or marked as dry-run unless explicitly enabled.

## Naming

External repository and public display name are `Archive-Logistics`. Some internal settings and source values can remain `logitics` or `LOGITICS` to preserve existing event and configuration contracts.
