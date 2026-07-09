# Archive-Ledger Synthetic Policy Pack

This directory contains synthetic policy documents for ArchiveOS portfolio demonstration.

These documents do not represent real financial policy, card policy, accounting policy, legal advice, or production approval rules. They exist only to demonstrate how ArchiveOS records policy evidence for synthetic Archive-Ledger approval requests.

ArchiveOS responsibility:

- receive approval requests from Archive-Ledger
- generate RAG or fallback policy evidence
- record human PM/Admin decisions
- audit the request, evidence, decision, and callback status

Archive-Ledger responsibility:

- synthetic transaction event processing
- ledger mutation
- settlement readiness
- reconciliation
- callback endpoint ownership

Required environment variable names only:

- `ARCHIVE_LEDGER_BASE_URL`
- `ARCHIVE_LEDGER_CALLBACK_TOKEN`
- `ARCHIVE_LEDGER_ENABLED`
