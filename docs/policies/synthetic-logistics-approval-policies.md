# Synthetic Logistics Approval Policies

This is a synthetic policy document for ArchiveOS portfolio demonstration. It does not represent real logistics, financial, legal, accounting, or compliance policy.

## High logistics cost

- A synthetic logistics cost of 300,000 KRW or more requires human review.
- CRITICAL priority shipment cost must not be automatically settled.
- Delayed shipments with additional penalty cost require reason review.

## Cold-chain risk

- If `requiresColdChain=true` and `delayed=true`, automatic approval is blocked.
- Quality owner and operations owner review is required before the cost can move to a settlement-ready state.

## ArchiveOS responsibility

ArchiveOS stores policy evidence, approval decision, callback status, and audit trail only.
Archive-Logistics owns route, ETA, delay, and logistics cost calculation.
