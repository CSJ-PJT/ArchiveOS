# Archive-Ledger Approval Contract

This document describes a synthetic portfolio integration contract. It does not describe real financial processing.

## Responsibility Boundary

Archive-Ledger owns synthetic transaction event processing, ledger state, settlement readiness, and reconciliation.

ArchiveOS owns approval gate, policy evidence, human decision, audit log, Slack operation alerting, and Managed Systems observability.

## Archive-Ledger to ArchiveOS

`POST /api/approvals/external`

Required fields:

- `source`
- `correlationId`
- `transactionId`
- `amount`
- `currency`
- `reason`
- `policyQuestion`
- `metadata`
- `callback.targetSystemId`
- `callback.callbackPath`

Idempotency:

- `correlationId` and `transactionId` are idempotency keys.
- A duplicate request returns the existing approval request.
- A duplicate request must not create a new approval row.

## ArchiveOS to Archive-Ledger Callback

`POST {ARCHIVE_LEDGER_BASE_URL}/api/approvals/callback`

Callback body:

- `approvalRequestId`
- `transactionId`
- `decision`
- `decidedBy`
- `comment`
- `decidedAt`
- `correlationId`

`ARCHIVE_LEDGER_CALLBACK_TOKEN` may be used as a header value, but the token value is never stored, rendered, or included in audit metadata.

## Status Model

Approval status:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `HOLD`

Callback status:

- `CALLBACK_PENDING`
- `CALLBACK_SUCCEEDED`
- `CALLBACK_FAILED`

## Fallback Evidence Rule

If RAG/OpenAI is unavailable, ArchiveOS generates deterministic fallback evidence.

The fallback policy rule is:

- amount at or above 3,000,000 KRW requires approval
- severity HIGH or CRITICAL requires approval
- ArchiveOS records why the synthetic request is approval-gated

## Permission Rule

- Public mode can read approval lists and details.
- Public mode cannot approve, reject, hold, or create protected mutations.
- PM/Admin can decide approvals.
- Integration token or Admin session is required for inbound external approval creation.

## Audit Events

- `external_approval_requested`
- `external_approval_duplicate_received`
- `external_approval_evidence_generated`
- `external_approval_fallback_evidence_used`
- `external_approval_approved`
- `external_approval_rejected`
- `external_approval_held`
- `ledger_callback_attempted`
- `ledger_callback_succeeded`
- `ledger_callback_failed`

## Secret Handling

ArchiveOS stores environment variable names and configuration booleans only.

Secret, token, password, webhook, private key, account number, card number, resident registration number, phone number, and real personal data values must not be stored or displayed.
