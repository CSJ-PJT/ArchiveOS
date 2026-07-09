# Synthetic Finance Settlement Policies

This is a synthetic policy document for ArchiveOS portfolio demonstration. It does not represent real financial policy, card policy, accounting policy, legal advice, or production approval rules.

## Approval gate

- Synthetic maintenance or emergency purchase expenses of 3,000,000 KRW or more require human approval.
- `APPROVAL_REQUIRED` transactions are excluded from settlement batch processing.
- `REJECTED` transactions are not settlement targets.
- Approved transactions can be moved to `SETTLEMENT_READY` by Archive-Ledger after callback.

## Responsibility boundary

Archive-Ledger owns transaction, ledger entry, settlement, and reconciliation state.
ArchiveOS owns approval gate, policy evidence, human decision, audit log, Slack notification, and callback outbox.
