# Archive Platform Integration Contracts

All contracts use synthetic portfolio data only. Do not send real card numbers, account numbers, resident registration numbers, phone numbers, API keys, tokens, webhooks, or private keys.

## Nexus

- Read:
  - `GET /api/outbox/summary`
  - `GET /api/outbox/events`
- Guarded write:
  - `POST /api/outbox/events/generate?count=100`
  - `POST /api/outbox/events/publish`
- ArchiveOS returns `DRY_RUN` or `SAFE_MODE_BLOCKED` unless `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=true`.

## Market

- Repository: `https://github.com/CSJ-PJT/Archive-Market`
- Role: synthetic customer demand, order, payment, revenue, return, and claim event source.
- Read:
  - `GET /actuator/health`
  - `GET /api/operations/summary`
  - `GET /api/market-economy/summary`
  - `GET /api/outbox/summary`
  - `GET /api/orders`
  - `GET /api/claims`
  - `GET /api/returns`
- ArchiveOS config:
  - `ARCHIVE_ECOSYSTEM_SERVICES_MARKET_BASE_URL=http://localhost:8094`
  - Docker host example: `http://host.docker.internal:8094`

Archive-Market must not receive real customer, payment, address, or finance data. All contract examples are Synthetic Data / Demo Data.

## Logistics

- Read:
  - `GET /actuator/health`
  - `GET /api/operations/summary`
  - `GET /api/outbox/summary`
  - `GET /api/routes/summary`
- Guarded write:
  - `POST /api/outbox/publish`

Note: integration keys in ArchiveOS configuration remain `logitics` internally for backward compatibility:
`ARCHIVE_ECOSYSTEM_SERVICES_LOGITICS_*`.

## Ledger

- Read:
  - `GET /actuator/health`
  - `GET /api/operations/summary`
  - `GET /api/transactions?status=APPROVAL_REQUIRED`
  - `GET /api/reconciliation/summary`
- Logistics native ingest endpoints:
  - `POST /api/events/logistics`
  - `POST /api/events/logistics/bulk`
- Callback:
  - `POST /api/approvals/callback`

Notes:
- ArchiveOS reads `Logistics` data from `http://localhost:8092` APIs:
  - `/api/operations/summary`
  - `/api/outbox/summary`
  - `/api/routes/summary`
- `/api/routes/summary` 500 was resolved in the current Archive-Logistics implementation. The root cause was JPQL nullable parameter and PostgreSQL JDBC type inference. Archive-Logistics now handles default, `factoryId`, `date`, and `factoryId + date` paths through explicit Repository/Service branches.
- Archive-Ledger supports native logistics bulk endpoint:
  - `POST /api/events/logistics/bulk`

Note: GitHub repository and public display name are Archive-Logistics. Some internal keys and source names may remain `logitics` or `LOGITICS` for backward compatibility with existing events and API contracts.

## Status mapping

- 2xx: `HEALTHY`
- 4xx/5xx: `DEGRADED`
- timeout/connection refused: `UNAVAILABLE`
- disabled config: `DISABLED`
- no snapshot: `UNKNOWN`
