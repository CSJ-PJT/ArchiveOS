# Policy Evidence

ArchiveOS stores policy evidence for synthetic approval requests. These documents are portfolio demonstration assets and do not represent real financial, logistics, legal, accounting, or production policy.

## Policy documents

- `docs/policies/synthetic-logistics-approval-policies.md`
- `docs/policies/synthetic-finance-settlement-policies.md`
- `docs/policies/synthetic-cross-service-operations-policies.md`
- `docs/policies/archive-ledger/*`

## RAG and fallback

- If RAG is available, ArchiveOS can store RAG evidence.
- If OpenAI/RAG is unavailable, ArchiveOS stores rule-based fallback evidence.
- Approval ingestion must not fail because AI is degraded.

## Snapshot

`policy_evidence_snapshot` records:

- approval request id
- source service
- policy question
- evidence text
- evidence source
- RAG status
- related policy document

This snapshot makes approval decisions auditable even when external services are later unavailable.
