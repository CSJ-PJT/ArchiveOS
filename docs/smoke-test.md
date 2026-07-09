# ArchiveOS Smoke Test

## Read-only Smoke

```powershell
curl.exe http://localhost:5173/api/ecosystem/summary
curl.exe http://localhost:5173/api/ecosystem/topology
curl.exe http://localhost:5173/api/integrations/nexus/outbox
curl.exe http://localhost:5173/api/integrations/logitics/summary
curl.exe http://localhost:5173/api/integrations/logitics/outbox
curl.exe http://localhost:5173/api/integrations/logitics/routes
curl.exe http://localhost:5173/api/integrations/ledger/summary
curl.exe http://localhost:5173/api/integrations/ledger/approval-required
```

Expected result:

- ArchiveOS API responds with HTTP 200.
- External service failures are represented as `DEGRADED`, `UNAVAILABLE`, `DISABLED`, or `UNKNOWN`.
- The topology contains the Nexus -> Logistics -> Ledger -> ArchiveOS flow.

## Script

```powershell
.\scripts\smoke-ecosystem.ps1
.\scripts\smoke-ecosystem.ps1 -OsApiUrl "http://localhost:5173"
```

## Write Smoke

Write smoke requires explicit operator intent and may change external service data.

```powershell
.\scripts\smoke-ecosystem.ps1 -WriteSmoke
```

If safe-mode is enabled, write attempts should return `SAFE_MODE_BLOCKED`, `DRY_RUN`, or a clearly classified skipped result.

## Atlas Healthcheck

ArchiveOS can also record Atlas public endpoint healthchecks:

- `http://161.33.17.84/`
- `http://161.33.17.84/travel/`
- `http://161.33.17.84/learn/`
- `http://161.33.17.84/health/`
- `http://161.33.17.84/jobs/`
- `http://161.33.17.84/api/health`

Latest recorded result is documented in `docs/atlas-v0.1-healthcheck-result.md`.
