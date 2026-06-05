# Agent Mesh Data Model

## Purpose

The mesh model should extend the current linear pipeline without replacing it.

Current default flow:

```text
Inbox -> Implementer -> Reviewer -> Decision
```

Future mesh flow:

```text
Coordinator/PM
  -> selects participants
  -> records messages
  -> tracks events
  -> links outcomes to tasks, reviews, decisions, and commits
```

The first implementation should be data-first and read-only in the UI. Execution control can remain outside ArchiveOS.

## Agent Roles

| Role | Responsibility | Typical Inputs | Typical Outputs | UI Surface |
| --- | --- | --- | --- | --- |
| Implementer | Builds requested changes | Task, design note, review feedback | Builder result, patch summary | Operators, Mesh, Dashboard |
| Reviewer | Reviews implementation quality and safety | Builder result, diff, tests | Verdict, issues, approve/reject recommendation | Operators, Decisions, Timeline |
| Loop | Moves queue items through the pipeline | Inbox, processing, outbox | Runtime state, queue movement | Operators, Dashboard |
| Architect | Defines system boundaries and technical direction | Product goal, constraints, incidents | Architecture note, implementation plan | Mesh, Knowledge |
| Historian | Preserves decisions and lessons | Reviews, decisions, incidents | Markdown memory, linked records | Knowledge, Obsidian |
| Incident | Investigates failures, stale work, limits | Warnings, failed jobs, stuck processing | Incident report, recovery recommendation | Dashboard, Timeline |
| PM | Human or AI coordinator for priority and approval | Business goals, queue state, verdicts | Priorities, approvals, rejections, reassignments | Dashboard, Decisions |
| UX | Reviews usability and product clarity | Screenshots, UI state, user feedback | UX review, improvement proposal | Mesh, Knowledge |
| GitHub Sync | Mirrors repository status | Branch, commits, PRs, CI | Read-only GitHub status events | GitHub, Timeline |

## Agent Status Values

Recommended normalized statuses:

| Status | Meaning |
| --- | --- |
| idle | Agent is available but not working |
| working | Agent is actively producing output |
| reviewing | Agent is evaluating work |
| waiting | Agent is blocked on another actor or input |
| blocked | Agent cannot proceed without intervention |
| error | Agent or source reported a failure |
| offline | Agent is not detected |

Existing statuses can be mapped into this set without breaking the MVP.

## Conceptual Tables

These are proposed models, not immediate migrations.

### agents

Stores logical agent identity.

Fields:

- id
- name
- role
- status
- runtime_source
- pid_hint
- current_task_id
- last_seen_at
- metadata
- created_at
- updated_at

### agent_capabilities

Describes what an agent is allowed or expected to do.

Fields:

- id
- agent_id
- capability
- description
- is_enabled
- created_at

Example capabilities:

- code_change
- review
- architecture_plan
- decision_archive
- incident_triage
- github_readonly_sync

### tasks

Extends current task queue into mesh participation.

Fields:

- id
- title
- description
- priority
- status
- active_stage
- owner_agent_id
- coordinator_agent_id
- created_at
- updated_at

### task_participants

Tracks which agents are involved in a task.

Fields:

- id
- task_id
- agent_id
- role_in_task
- status
- joined_at
- left_at

Example role_in_task values:

- owner
- implementer
- reviewer
- architect
- historian
- observer
- coordinator

### agent_messages

Records direct or mediated communication between agents.

Fields:

- id
- task_id
- from_agent_id
- to_agent_id
- message_type
- content
- status
- source
- created_at

Recommended message_type values:

- request
- response
- clarification
- review_feedback
- decision_notice
- incident_notice
- handoff

### agent_events

Records state transitions and operational facts.

Fields:

- id
- task_id
- agent_id
- event_type
- title
- description
- severity
- source
- related_artifact_id
- created_at

Recommended event_type values:

- queue_changed
- agent_started
- agent_finished
- builder_result
- reviewer_verdict
- pm_approval
- pm_rejection
- priority_changed
- task_reassigned
- warning_detected
- incident_opened
- incident_resolved

### decisions

Promotes PM and reviewer decisions into first-class records.

Fields:

- id
- task_id
- decision_type
- title
- rationale
- decided_by_agent_id
- decided_by_human
- source
- created_at

Recommended decision_type values:

- approve
- reject
- defer
- reassign
- change_priority
- change_scope
- accept_risk

### artifacts

Represents files, result JSON, reviews, screenshots, commits, or exported notes.

Fields:

- id
- task_id
- artifact_type
- title
- uri
- summary
- source
- created_at

Artifact types:

- builder_result
- reviewer_result
- screenshot
- commit
- markdown_note
- incident_report
- architecture_note

### entity_links

Generic relationship table for the Knowledge Graph MVP.

Fields:

- id
- from_entity_type
- from_entity_id
- to_entity_type
- to_entity_id
- relationship_type
- source
- created_at

Example relationships:

- task produced builder_result
- review evaluated builder_result
- decision approved review
- commit implements task
- incident blocks task
- architecture_note guides task

## Mesh Compatibility With Current Pipeline

The current pipeline maps cleanly into the mesh:

| Current Concept | Mesh Equivalent |
| --- | --- |
| Inbox file | task + queue_changed event |
| Processing file | task status + active participant |
| Implementer PID | agent runtime metadata |
| Outbox result | artifact + builder_result event |
| Reviewer output | artifact + reviewer_verdict event |
| PM decision | decision + pm_approval or pm_rejection event |

## Data Integrity Rules

- Every runtime-derived event needs a source label.
- Seed data should be hidden or marked as demo.
- A message is not an instruction unless a future execution system explicitly consumes it.
- Recording a command is not the same as executing a command.
- PM approval and rejection are records only until execution control is explicitly designed.
- Service role writes remain backend-only.

