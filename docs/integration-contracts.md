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

## Logitics

- Read:
  - `GET /actuator/health`
  - `GET /api/operations/summary`
  - `GET /api/outbox/summary`
  - `GET /api/routes/summary`
- Guarded write:
  - `POST /api/outbox/publish`

## Ledger

- Read:
  - `GET /actuator/health`
  - `GET /api/operations/summary`
  - `GET /api/transactions?status=APPROVAL_REQUIRED`
  - `GET /api/reconciliation/summary`
- Callback:
  - `POST /api/approvals/callback`

## Status mapping

- 2xx: `HEALTHY`
- 4xx/5xx: `DEGRADED`
- timeout/connection refused: `UNAVAILABLE`
- disabled config: `DISABLED`
- no snapshot: `UNKNOWN`
