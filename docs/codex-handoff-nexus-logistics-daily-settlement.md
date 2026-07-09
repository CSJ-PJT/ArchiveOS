# Codex Handoff · Nexus / Logistics Daily Settlement Link

Audience: ArchiveOS Codex thread

Archive-Nexus has been prepared locally to receive synthetic daily manufacturing settlement callbacks from Archive-Logistics. ArchiveOS should know about this because it is the Control Tower that will eventually summarize and connect the Nexus ↔ Logistics settlement state.

Important naming:

- Public/external service name: `Archive-Logistics`
- Legacy compatibility names may remain in existing repos as `Archive-Logitics`, `logitics`, or `LOGITICS`.
- All examples are Synthetic Data / Demo Data.

## New Nexus inbox contract

Nexus endpoint:

```http
POST http://localhost:8080/api/logistics/settlements/daily
POST http://localhost:8080/api/logistics/settlements/daily/bulk
GET  http://localhost:8080/api/logistics/settlements/daily
GET  http://localhost:8080/api/logistics/settlements/daily?factoryId=FAC-A
GET  http://localhost:8080/api/logistics/settlements/daily/{settlementId}
GET  http://localhost:8080/api/logistics/settlements/summary
```

## Callback payload

```json
{
  "settlementId": "LGS-SETTLE-20260709-FAC-A",
  "idempotencyKey": "LOGISTICS:DAILY:2026-07-09:FAC-A",
  "source": "Archive-Logistics",
  "schemaVersion": 1,
  "settlementDate": "2026-07-09",
  "factoryId": "FAC-A",
  "currency": "KRW",
  "totalShipments": 12,
  "delayedShipments": 2,
  "heldShipments": 1,
  "totalQuantity": 1440,
  "totalLogisticsCost": 3800000,
  "manufacturingImpactCost": 720000,
  "onTimeRate": 0.8333,
  "evidence": {
    "basis": "synthetic daily route cost summary"
  },
  "payload": {
    "demoData": true
  },
  "occurredAt": "2026-07-09T10:00:00Z"
}
```

## Nexus behavior

- Stores callbacks in `nexus_logistics_daily_settlement`.
- Uses `settlementId` and `idempotencyKey` for duplicate-safe receiving.
- Duplicate callback returns `duplicate=true`.
- No second settlement row is created.
- `duplicate_count` is incremented.
- Audit log records receive/duplicate events.
- Nexus does not mutate production, quality, maintenance, inventory, or simulator source data from this callback.

## ArchiveOS connection points

ArchiveOS should later add this settlement inbox to ecosystem summary/topology/managed systems views.

Read-only URLs ArchiveOS can poll:

```http
GET http://localhost:8080/api/logistics/settlements/summary
GET http://localhost:8080/api/logistics/settlements/daily?limit=50
GET http://localhost:8080/api/integrations/summary
GET http://localhost:8080/api/outbox/summary
```

Recommended Control Tower interpretation:

- Nexus status remains `HEALTHY` even if settlement count is zero.
- Recent settlement received means Logistics → Nexus feedback loop is connected.
- Duplicate count > 0 is not necessarily a failure; it can indicate safe retry/idempotency behavior.
- Missing recent settlement after Logistics has published routes should be shown as `DEGRADED` or `ATTENTION`, not Nexus process failure.

## Files in Nexus to inspect

Repository:

```text
C:\Users\dan18\Documents\ArchivePJT\Archive-Nexus
```

Files:

- `backend/src/main/resources/db/migration/V9__add_logistics_daily_settlement_inbox.sql`
- `backend/src/main/java/com/archivenexus/backend/logisticssettlement/`
- `backend/src/main/java/com/archivenexus/backend/web/LogisticsSettlementController.java`
- `backend/src/test/java/com/archivenexus/backend/LogisticsSettlementApiTest.java`
- `docs/logistics-daily-settlement-inbox.md`
- `docs/nexus-logitics-contract.md`
- `docs/api-reference.md`
- `docs/api-examples.http`

## Files in Logistics handoff

Repository:

```text
C:\Users\dan18\Documents\ArchivePJT\Archive-Logitics
```

Files:

- `CODEX_HANDOFF.md`
- `docs/codex-handoff-nexus-daily-settlement.md`

## Validation already run on Nexus

Passed:

```powershell
cd C:\Users\dan18\Documents\ArchivePJT\Archive-Nexus\backend
.\gradlew.bat test --tests com.archivenexus.backend.LogisticsSettlementApiTest --no-daemon --console=plain
.\gradlew.bat bootJar --no-daemon --console=plain

cd ..
docker compose config --quiet
```

Known caveat:

- Full `.\gradlew.bat test` in Nexus hit a Windows file-lock issue on Gradle test result output (`build/test-results/test/binary/output.bin`).
- This was not a functional test assertion failure.

## ArchiveOS TODO

When ArchiveOS thread is available, implement read-only visibility first:

1. Add Nexus logistics settlement summary polling.
2. Add ecosystem card field:
   - last settlement received time
   - total logistics cost
   - manufacturing impact cost
   - duplicate count
3. Add topology edge status:
   - Archive-Logistics → Archive-Nexus settlement callback
4. Keep write operations disabled by safe mode unless explicitly enabled.
5. Do not introduce real user, financial, shipment, map, card, account, or personal data.

## Commit note

Nexus and Logistics have local pending changes. This handoff is a notification document only and should not be treated as the final integration implementation.
