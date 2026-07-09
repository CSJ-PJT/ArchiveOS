# Demo Ecosystem Scenario

## ArchiveOS only

ArchiveOS can run without Nexus, Logistics, or Ledger. In that mode:

- `/api/ecosystem/summary` returns 200.
- external services are `UNAVAILABLE`, `UNKNOWN`, or `DEGRADED`.
- ArchiveOS remains available for approvals, audit, dashboard, and policy evidence.

## Full local order

1. Start Archive-Ledger on `http://localhost:18080`.
2. Start Archive-Logistics on `http://localhost:8092`.
3. Start Archive-Nexus on `http://localhost:8080`.
4. Start ArchiveOS.
5. Check:
   - `curl.exe http://localhost:5173/api/ecosystem/summary`
   - `curl.exe http://localhost:5173/api/ecosystem/topology`
   - `curl.exe -X POST http://localhost:5173/api/ecosystem/refresh` (admin session required)
   - `curl.exe -X POST http://localhost:5173/api/ecosystem/demo/dry-run`

6. Write-mode smoke (optional, typically safe-mode blocked):
   - `curl.exe -X POST "http://localhost:8080/api/outbox/events/generate?count=10&type=logistics"`
   - `curl.exe -X POST "http://localhost:8080/api/outbox/events/publish?target=logitics"`
   - `curl.exe -X POST "http://localhost:8092/api/outbox/publish"`
   - `curl.exe -X POST "http://localhost:8080/api/outbox/events/generate?count=10&type=ledger"`
   - `curl.exe -X POST "http://localhost:8080/api/outbox/events/publish?target=ledger"`
   - `curl.exe http://localhost:18080/api/transactions?status=APPROVAL_REQUIRED`

## Docker Compose host URLs

When ArchiveOS runs in Docker and external services run on the Windows host:

```env
ARCHIVE_ECOSYSTEM_SERVICES_LEDGER_BASE_URL=http://host.docker.internal:18080
ARCHIVE_ECOSYSTEM_SERVICES_LOGITICS_BASE_URL=http://host.docker.internal:8092
ARCHIVE_ECOSYSTEM_SERVICES_NEXUS_BASE_URL=http://host.docker.internal:8080
```

## Approval flow smoke

1. Create synthetic external approval.
2. Confirm fallback evidence if RAG is unavailable.
3. Approve or reject from ArchiveOS.
4. Check callback outbox status.
5. Retry failed callback if Ledger was unavailable.

Notes:
- Base URL defaults: Nexus `http://localhost:8080`, Logistics `http://localhost:8092`, Ledger `http://localhost:18080`, ArchiveOS API `http://localhost:5173`.
- ArchiveOS safe mode defaults: `ARCHIVE_INTEGRATION_SAFE_MODE=true`, `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=false`.
- External write API endpoints are still guarded by ArchiveOS safe-mode policies.
