# ArchiveOS Operations Runbook

## Start

```powershell
docker compose up -d --build
docker compose ps
curl.exe http://localhost:5173/
curl.exe http://localhost:5173/api/ecosystem/summary
```

## Health Triage

1. Check ArchiveOS frontend, backend, archiveos-ai, and postgres health.
2. Check `/api/ecosystem/summary`.
3. If a service is `UNAVAILABLE`, verify the service base URL and host/container network boundary.
4. If a service is `DEGRADED`, inspect the integration summary payload.
5. If callbacks are failing, inspect `/api/approvals/callbacks`.

## Approval Triage

```powershell
curl.exe http://localhost:5173/api/approvals/external/summary
curl.exe http://localhost:5173/api/approvals/external?status=PENDING
curl.exe http://localhost:5173/api/approvals/callbacks
```

Public mode is read-only. PM/Admin sessions can decide approvals. Dangerous write paths remain guarded by backend authorization and safe-mode.

## Callback Triage

- `SENT`: callback delivered.
- `PENDING`: callback queued.
- `RETRY`: callback failed and is retryable.
- `FAILED`: callback exhausted retry policy.
- `SKIPPED`: external write was disabled or callback target was not configured.

## Safe-mode

Do not disable safe-mode for normal read-only verification. Enable external writes only for a bounded demo or smoke test:

```env
ARCHIVE_INTEGRATION_SAFE_MODE=true
ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=false
```

## Rollback

ArchiveOS is loosely coupled from Nexus, Logistics, Ledger, and Atlas. If a registry or healthcheck entry causes confusion, remove or disable the managed service row in ArchiveOS only. Do not modify the external service unless the issue is confirmed outside ArchiveOS.
