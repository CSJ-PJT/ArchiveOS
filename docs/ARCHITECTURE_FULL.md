# ArchiveOS Architecture

ArchiveOS is an operations console for the Archive service family. Product-specific implementation and private project data are kept in their owning private repositories; ArchiveOS consumes only sanitized, generic operational contracts.

## Execution Policy (Mandatory)

- Read operations may aggregate health, queue, approval, and audit summaries.
- Mutating operations require explicit authorization and must emit an audit record.
- Secrets and private product payloads are never stored in public source or client bundles.

## Phase 1 - Spring AI Foundation

The Java service provides authenticated API boundaries, operational summaries, and human-reviewed recommendations.

## Phase 2 - Obsidian Knowledge Platform

Knowledge indexing is limited to approved operational documentation and excludes private product source, assets, build evidence, and telemetry.

## Phase 3 - Database Schema

PostgreSQL stores ArchiveOS workflow, approval, health, and audit records. External products integrate through sanitized identifiers and generic read-only status contracts.
