# Obsidian Integration Strategy

## Role Split

ArchiveOS and Obsidian should not compete.

ArchiveOS is the live operations cockpit:

- Runtime state
- Queue state
- Agent operations
- Decisions
- Reviews
- Incidents
- Warnings
- Short-term command history

Obsidian is the long-term organizational memory:

- Design history
- Architecture notes
- Decision records
- Lessons learned
- Incident retrospectives
- Review archives
- Daily project journals

## Recommended Vault Structure

```text
Vault/
  Projects/
    ArchiveOS/
    DeepStake/
  Decisions/
    2026/
  Architecture/
    ArchiveOS/
    DeepStake/
  Incidents/
    2026/
  Reviews/
    Builder/
    Reviewer/
  Agents/
    Implementer/
    Reviewer/
    Architect/
    Historian/
  Tasks/
    ArchiveOS/
    DeepStake/
  Commits/
  Daily/
```

## Export Strategy

Start with manual or backend-triggered Markdown export. Do not add automatic execution control in the UI yet.

Export candidates:

- PM approvals
- PM rejections
- Reviewer verdicts
- Builder summaries
- Architecture decisions
- Incident reports
- Lessons learned
- Major task state transitions

## Markdown Frontmatter

Each exported note should include structured metadata.

```yaml
---
archiveos_id: "decision-uuid"
source: "archiveos"
source_type: "decision"
project: "ArchiveOS"
task_id: "task-uuid"
agents:
  - "Reviewer"
  - "PM"
status: "approved"
created_at: "2026-05-29T00:00:00Z"
related:
  review: "review-artifact-id"
  builder_result: "builder-artifact-id"
tags:
  - archiveos
  - decision
---
```

## Note Templates

### Decision Record

```markdown
# Decision: <title>

## Summary

<short decision summary>

## Context

<why this decision was needed>

## Decision

<approved, rejected, deferred, reassigned, changed scope>

## Rationale

<reasoning>

## Linked Work

- Task: [[...]]
- Review: [[...]]
- Builder Result: [[...]]
- Commit: [[...]]

## Follow-up

<next safe action>
```

### Incident Note

```markdown
# Incident: <title>

## Signal

<what ArchiveOS detected>

## Impact

<what work was affected>

## Cause

<known or suspected cause>

## Recovery

<recommended action>

## Prevention

<future guardrail>
```

### Architecture Note

```markdown
# Architecture: <title>

## Problem

<system problem>

## Constraints

<technical and operational constraints>

## Proposal

<recommended structure>

## Tradeoffs

<costs and risks>

## Decision Links

- [[Decision ...]]
```

## Link Policy

ArchiveOS should export stable links where possible:

- `[[Tasks/<project>/<task-id>]]`
- `[[Decisions/2026/<decision-title>]]`
- `[[Reviews/Reviewer/<review-id>]]`
- `[[Incidents/2026/<incident-title>]]`

Obsidian links should be deterministic enough to regenerate without creating duplicates.

## ArchiveOS UI Integration

Recommended future UI:

- Settings: Obsidian vault path configured locally, not exposed to frontend secrets
- Decisions: export selected decision
- Timeline: export selected event group
- Knowledge: open/export linked note bundle

Initial version should show export readiness only. Actual file write automation should be added after a review of local file permissions and duplicate handling.

## Safety Rules

- Do not export secrets.
- Do not export service role keys.
- Do not export full raw logs by default.
- Mark exported notes as generated from ArchiveOS.
- Preserve source IDs for traceability.
- Treat Obsidian as memory, not as the runtime source of truth.

