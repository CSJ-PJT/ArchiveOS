# ArchiveOS Phase 2 Architecture Proposal

## Goal

ArchiveOS should evolve from a PM visibility dashboard into an AI Organization Operating System.

The next phase should not make ArchiveOS an execution console. Its first responsibility is to make AI work observable, reviewable, attributable, and recoverable. Execution can come later after the operating model is trustworthy.

## Current Baseline

Current runtime shape:

```text
Inbox -> Implementer -> Reviewer -> Decision
```

This linear pipeline is still valuable because it is easy to reason about:

- The PM can see whether work has started.
- The PM can see who is responsible for the current stage.
- The PM can inspect builder output and reviewer verdicts.
- The system can distinguish idle from stuck.

Phase 2 should preserve this pipeline as the default path while adding a mesh layer around it.

## Target Direction

ArchiveOS Phase 2 introduces three conceptual layers:

```text
PM Visibility Layer
  Dashboard, Timeline, Operators, Decisions, Mesh, Knowledge

Coordination Layer
  Tasks, agent assignments, messages, events, decisions, warnings

Runtime Source Layer
  MCP queue files, Codex sessions, Supabase records, Git/GitHub status, exported notes
```

The UI remains read-only or recording-only. The coordination layer may store commands, approvals, decisions, messages, and events, but it must not directly control MCP, Codex, OpenAI, GitHub automation, or arbitrary shell execution yet.

## Phase 2 Principles

1. Visibility before control
2. Traceability before automation
3. Human approval before irreversible actions
4. Backend owns writes and secrets
5. Frontend never receives service role keys
6. Runtime facts must be source-labeled
7. Demo or seed data must never appear as live operational truth
8. The linear pipeline remains the safe default
9. Mesh collaboration is added as an observation and planning model first

## Recommended Phase Breakdown

### Phase 2A: Event and Message Foundation

Add normalized records for agent messages, runtime events, and PM interventions.

Purpose:

- Record why state changed.
- Preserve cross-agent communication.
- Make decisions auditable.
- Prepare for mesh visualization without changing execution.

Outcome:

- ArchiveOS can explain what happened, when, from which source, and which task or agent it affected.

### Phase 2B: Agent Mesh View

Add a read-only graph-style view of agents and their relationships.

Purpose:

- Show active agents.
- Show communication paths.
- Highlight current collaboration.
- Reveal bottlenecks between roles.

Outcome:

- PM can see organization health, not only queue health.

### Phase 2C: Human PM Collaboration Model

Promote PM actions into first-class events.

Examples:

- Approval recorded
- Rejection recorded
- Priority changed
- Task reassigned
- Scope clarified
- Incident acknowledged

Outcome:

- Human decisions become part of the operational history.

### Phase 2D: Obsidian Export

Export selected events, decisions, reviews, incidents, and architecture notes into Markdown.

Purpose:

- ArchiveOS handles live operations.
- Obsidian handles durable memory and design history.

Outcome:

- Long-running projects gain searchable institutional memory.

### Phase 2E: Knowledge Graph MVP

Show relationships between task, review, decision, commit, incident, and agent.

Purpose:

- Answer "why did this change happen?"
- Answer "which decision caused this implementation?"
- Answer "which review blocked this task?"

Outcome:

- ArchiveOS becomes a system of record for AI organization operations.

## Non-Goals For Phase 2

- No OpenAI API integration
- No direct MCP command execution
- No Codex direct control from UI
- No GitHub webhook automation
- No arbitrary shell execution
- No auto approve or auto reject
- No hidden execution behind PM recording buttons

## Core Runtime Sources

| Source | Purpose | Trust Level | UI Label |
| --- | --- | --- | --- |
| MCP queue files | Queue counts, processing task, results | Live runtime | live MCP |
| Supabase | Recorded commands, work logs, decisions | Operational record | Supabase recorded |
| Backend derived state | Warnings, summaries, consistency checks | Derived judgement | backend-derived |
| Git/GitHub | Commits, branch, PRs, CI later | Read-only external status | GitHub read-only |
| Obsidian export | Long-term memory | Exported knowledge | Obsidian memory |

## Proposed Navigation

ArchiveOS should eventually use these major sections:

- Dashboard: 5-second PM overview
- Mesh: agent network and collaboration map
- Decisions: approvals, rejections, decision records
- Operators: implementer, reviewer, loop, bridge, runtime details
- Timeline: operational history
- Knowledge: task-review-decision-commit graph
- GitHub: read-only repository and PR status
- Settings: configuration, source health, security posture

## Success Criteria

ArchiveOS Phase 2 is successful when a PM can answer these questions without opening terminal windows:

- Is the system active?
- What is the active task?
- Which agent is working?
- Who is waiting on whom?
- What changed recently?
- What decision caused the current direction?
- What is blocked or stale?
- Which review or incident explains the slowdown?
- What should be done next?

