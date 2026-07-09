# High Value Maintenance Expense Policy

This is a synthetic policy document for ArchiveOS portfolio demonstration. It does not represent real financial policy.

High-value maintenance expenses are approval-gated when a completed maintenance event produces a synthetic transaction whose amount exceeds the configured approval threshold.

Fallback rule:

- Amount threshold: 3,000,000 KRW
- Severity threshold: HIGH or CRITICAL
- Approval action: PM/Admin review required
- Evidence: RAG evidence when available, otherwise deterministic fallback evidence

ArchiveOS must not mutate the ledger. It only returns the human decision to Archive-Ledger through callback.
