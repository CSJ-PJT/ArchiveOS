# ArchiveOS Ecosystem Control Tower

ArchiveOS is the control tower for the Archive Platform ecosystem. It does not own manufacturing, logistics, ledger, settlement, or reconciliation domain mutations. It observes external systems, records approval evidence, manages human decisions, and isolates external failures.

## Responsibility split

- Archive-Market: synthetic customer demand, order, payment, revenue, return, and claim event source.
- Archive-Nexus: synthetic manufacturing, shipment, maintenance, quality event outbox.
- Archive-Logistics: synthetic route, ETA, delay, logistics cost, and logistics outbox.
- Archive-Ledger: synthetic transaction, ledger entry, settlement, reconciliation, and approval callback application.
- ArchiveOS: ecosystem status, approval gate, policy evidence, audit log, Slack notification, callback outbox, retry, and PM console.

## Control Tower capabilities

- `/api/ecosystem/summary` aggregates Market, Nexus, Logistics, and Ledger status.
- `/api/ecosystem/topology` returns nodes/edges for the operating console.
- `/api/ecosystem/timeline` returns MVP cross-service timeline events.
- External services can be unavailable without terminating ArchiveOS.
- Safe mode blocks external write actions unless explicitly enabled.
- `/api/ecosystem/demo/dry-run` is allowed in safe-mode and returns planned execution intent.
- `/api/ecosystem/demo/run` requires `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=true`.

## Failure isolation

- Connection refused, timeout, and 5xx responses are converted to `UNAVAILABLE` or `DEGRADED`. The ArchiveOS API still returns 200 for ecosystem summary so operators can inspect degraded state.
- `DEGRADED` is used when service health is partial, while `UNAVAILABLE` is used for unreachable/disabled critical checks.
- Safe mode / write guard failures are surfaced as `SAFE_MODE_BLOCKED` or `DRY_RUN` metadata in integration payloads.

## Naming note

GitHub repository and public display name are **Archive-Logistics**.  
Internal keys/sources may remain `logitics` for backward compatibility with existing events, dashboards, and API contracts.

## Archive-Market integration

Archive-Market is the synthetic commerce entry point for the ecosystem. It provides read-only demand, order, revenue, return, claim, outbox, and bankruptcy-risk summaries to ArchiveOS.

ArchiveOS reads:

- `GET /actuator/health`
- `GET /api/operations/summary`
- `GET /api/market-economy/summary`
- `GET /api/outbox/summary`
- `GET /api/orders`
- `GET /api/claims`
- `GET /api/returns`

If Archive-Market is down or an optional capability is not implemented, ArchiveOS keeps returning HTTP 200 for Control Tower summary and marks the Market service as `UNAVAILABLE` or `DEGRADED`.
