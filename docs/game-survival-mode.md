# Ecosystem Finance Control

`/api/game/survival/*` remains as a backward-compatible API namespace, but the current operating model is a synthetic settlement and finance control flow rather than a game-only feature.

## Purpose

ArchiveOS monitors cash, revenue, cost, profit, burn rate, bankruptcy risk, approval backlog, and settlement health across:

- Archive-Market
- Archive-Nexus
- Archive-Logistics
- Archive-Ledger
- ArchiveOS

All amounts and events are Synthetic Data / Demo Data. Do not use real customer, payment, address, finance, shipping, or user data.

## Market Role

Archive-Market is the external revenue and demand source. It generates synthetic order, payment, revenue, return, refund, and claim events. ArchiveOS reads Market economy state from:

- `GET /api/market-economy/summary`
- `GET /api/operations/summary`
- `GET /api/outbox/summary`

When Market is unavailable, ArchiveOS continues the finance control flow with fallback synthetic values and marks Market data as unavailable.

## Flow

```text
Archive-Market -> Archive-Nexus -> Archive-Logistics -> Archive-Ledger -> ArchiveOS
Archive-Market -> Archive-Ledger
Archive-Nexus -> Archive-Ledger
ArchiveOS -> Archive-Ledger callback
```

## Safety

- Agents propose actions only.
- External writes are blocked by default.
- `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=true` is required before write smoke actions can run.
- Every cross-service event should carry `idempotencyKey`, `correlationId`, `causationId`, `simulationRunId`, `settlementCycleId`, `hopCount`, and `maxHop`.
- Duplicate guard and max-hop guard prevent replay loops.

## API

- `GET /api/game/survival/summary`
- `POST /api/game/survival/simulate?dryRun=true`
- `GET /api/game/survival/finance`
- `GET /api/game/survival/finance/{systemId}`

The Node compatibility layer maps these routes to the Spring settlement finance simulation engine.
