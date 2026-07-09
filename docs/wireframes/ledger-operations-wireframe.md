# Ledger Operations Wireframe / 화면설계도

This is a Wireframe / 화면설계도, not an actual screenshot.

## Sections

- Transaction List: transaction id, source, type, status, amount
- Approval Required List: threshold reason, policy evidence, callback state
- Ledger Summary: debit/credit totals, account code totals, settlement readiness
- Settlement Batch Detail: batch id, settlement date, status, detail rows
- Reconciliation Summary: received, duplicate, created, failed, mismatch count

## Operator Flow

1. Filter transactions by status or source.
2. Inspect approval-required items.
3. Confirm ledger entries are balanced.
4. Run or inspect settlement batch.
5. Compare reconciliation mismatch count.

