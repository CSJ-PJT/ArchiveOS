# Portfolio Bullets

## ArchiveOS · Archive Platform Control Tower

Archive-Nexus, Archive-Logistics, and Archive-Ledger are observed as external operating targets and orchestrated from ArchiveOS as a single control tower.  
ArchiveOS aggregates cross-system health/operations summaries, renders topology, and records Ledger-related external approvals with policy evidence (RAG or synthetic fallback), audit trails, and callback outbox/retry handling.

- Nexus manufacturing/event outbox, Logistics route/cost calculation, and Ledger transaction/settlement/reconciliation are observed without collapsing runtime ownership.
- Outbox-driven flow is maintained with idempotency, retry, and SAFE_MODE_BLOCKED guard behavior.
- Approval requirements are surfaced as PM-inbox items and can be acted on in ArchiveOS; callback retries are tracked with status transitions (`PENDING`/`RETRY`/`FAILED`/`SENT`).
- ArchiveOS isolates external failures using `HEALTHY`, `DEGRADED`, and `UNAVAILABLE` states so one service failure does not terminate the control plane.
