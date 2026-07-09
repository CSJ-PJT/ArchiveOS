# ArchiveOS Ecosystem Control Tower

ArchiveOS is the control tower for the Archive Platform ecosystem. It does not own manufacturing, logistics, ledger, settlement, or reconciliation domain mutations. It observes external systems, records approval evidence, manages human decisions, and isolates external failures.

## Responsibility split

- Archive-Nexus: synthetic manufacturing, shipment, maintenance, quality event outbox.
- Archive-Logistics: synthetic route, ETA, delay, logistics cost, and logistics outbox.
- Archive-Ledger: synthetic transaction, ledger entry, settlement, reconciliation, and approval callback application.
- ArchiveOS: ecosystem status, approval gate, policy evidence, audit log, Slack notification, callback outbox, retry, and PM console.

## Control Tower capabilities

- `/api/ecosystem/summary` aggregates Nexus, Logistics, and Ledger status.
- `/api/ecosystem/topology` returns nodes/edges for the operating console.
- `/api/ecosystem/timeline` returns MVP cross-service timeline events.
- External services can be unavailable without terminating ArchiveOS.
- Safe mode blocks external write actions unless explicitly enabled.

## Failure isolation

Connection refused, timeout, and 5xx responses are converted to `UNAVAILABLE` or `DEGRADED`. The ArchiveOS API still returns 200 for ecosystem summary so operators can inspect degraded state.
