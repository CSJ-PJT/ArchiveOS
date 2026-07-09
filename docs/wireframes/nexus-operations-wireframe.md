# Nexus Operations Wireframe / 화면설계도

This is a Wireframe / 화면설계도, not an actual screenshot.

## Sections

- Outbox Summary: total, pending, published, pending retry, failed
- Routing Target Breakdown: LOGITICS, LEDGER, NONE, UNKNOWN
- Failed / Retry Events: event id, target, retry count, last error
- Dry-run Publish Result: candidate count, skipped, failed, target breakdown
- Integration Health: Archive-Logistics and Archive-Ledger enabled/disabled/unavailable status

## Operator Flow

1. Check outbox summary.
2. Confirm target split before publish.
3. Run `dryRun=true`.
4. Inspect retry or failed events.
5. Publish only the recovered target after external service recovery.

