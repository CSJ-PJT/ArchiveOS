# Archive Platform Final Architecture

ArchiveOS is the Control Tower for a five-service synthetic business ecosystem.

## Services

- Archive-Market: synthetic demand, orders, payments, revenue, returns, refunds, and claims.
- Archive-Nexus: synthetic manufacturing, inventory, production cost, quality, maintenance, and shipment events.
- Archive-Logistics: route, ETA, delivery cost, delay, deviation, and logistics settlement events.
- Archive-Ledger: transaction normalization, double-entry ledger, settlement, reconciliation, approval callback, and settlement-agency revenue.
- ArchiveOS: registry, health summary, topology, approval gateway, policy evidence, callback outbox, audit log, Slack notification, safe-mode, and degraded-state isolation.

## Topology

```text
Archive-Market
  |-> Archive-Nexus -> Archive-Logistics -> Archive-Ledger -> ArchiveOS
  |-> Archive-Ledger

Archive-Nexus -> Archive-Ledger
Archive-Ledger -> ArchiveOS approval request
ArchiveOS -> Archive-Ledger approval callback
```

## Control Tower Guarantees

- ArchiveOS remains available when an external service is down.
- Market/Nexus/Logistics/Ledger failures are surfaced as `DEGRADED`, `UNAVAILABLE`, `DISABLED`, or `UNKNOWN`.
- External writes are blocked unless safe-mode policy is explicitly relaxed.
- Secrets, tokens, webhook URLs, private keys, and real customer/payment data are not stored in repo docs or UI payloads.

## Market Read Contract

ArchiveOS reads Archive-Market from `http://localhost:8094` by default:

- `GET /actuator/health`
- `GET /api/operations/summary`
- `GET /api/market-economy/summary`
- `GET /api/outbox/summary`
- `GET /api/orders`
- `GET /api/claims`
- `GET /api/returns`

Docker host override:

```env
ARCHIVE_ECOSYSTEM_SERVICES_MARKET_BASE_URL=http://host.docker.internal:8094
```

## Synthetic Data Rule

All commerce, logistics, ledger, and approval events are Synthetic Data / Demo Data. The platform must not use real user, customer, address, payment, account, card, or financial data.
