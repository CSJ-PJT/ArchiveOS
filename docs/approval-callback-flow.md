# Approval Callback Flow

## Flow

1. Archive-Ledger, Archive-Logistics, or Archive-Nexus sends `POST /api/approvals/external`.
2. ArchiveOS applies idempotency by `correlationId` or `transactionId`.
3. ArchiveOS creates RAG evidence when available.
4. If RAG/OpenAI is unavailable, ArchiveOS stores fallback policy evidence.
5. PM/Admin approves, rejects, or holds the request.
6. Approve/reject creates an `approval_callback_outbox` item.
7. If external writes are disabled, the callback is marked `SKIPPED`.
8. If enabled, ArchiveOS calls Ledger `POST /api/approvals/callback`.
9. Success marks callback `SENT`.
10. Failure marks callback `RETRY` or `FAILED`.

## Retry API

- `GET /api/approvals/callbacks`
- `GET /api/approvals/callbacks/{callbackId}`
- `POST /api/approvals/callbacks/{callbackId}/retry`
- `POST /api/approvals/callbacks/retry-failed`

## Operator rule

Public mode is read-only. PM/Admin can make approval decisions. Admin is required for dangerous integration actions through the Node/Spring guard.
