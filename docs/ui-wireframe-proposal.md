# UI Wireframe Proposal

## Navigation

Recommended Phase 2 navigation:

```text
[Dashboard] [Mesh] [Decisions] [Operators] [Timeline] [Knowledge] [GitHub] [Settings]
```

If the current app should stay smaller, Mesh and Knowledge can be introduced behind feature flags or as read-only placeholders.

## Dashboard

Purpose: answer the PM's top questions in five seconds.

```text
┌──────────────────────────────────────────────────────────────┐
│ PM Status Snapshot                                            │
│ System: Working  Active Task: modular-construction...         │
│ Worker: Implementer PID 15232  Verdict: approve_next          │
│ Warning: No failure detected                                  │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐ ┌─────────────────────────────┐
│ Current Workflow State       │ │ Live Pipeline Map            │
│ Inbox / Processing / Outbox  │ │ Inbox -> Builder -> Review   │
│ Human-readable judgement     │ │ Animated only for live facts │
└─────────────────────────────┘ └─────────────────────────────┘

┌─────────────────────────────┐ ┌─────────────────────────────┐
│ Latest Builder Result        │ │ Latest Reviewer Result       │
│ Summary first                │ │ Verdict first                │
│ Raw collapsed                │ │ Raw collapsed                │
└─────────────────────────────┘ └─────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Recent Timeline Preview, max 3 events                         │
└──────────────────────────────────────────────────────────────┘
```

Dashboard should not contain full operator diagnostics or long raw logs.

## Agent Mesh View

Purpose: show the organization, not just the queue.

```text
                 Architect
                    ●
                    │
Historian ●────────● Reviewer
     │              │
     │              │
     ● PM ─────────● Implementer
                    │
                 GitHub Sync
                    ●
```

Node states:

- gray: idle or offline
- cyan: working
- amber: reviewing
- yellow: waiting or stale
- red: error or blocked
- green: recently succeeded

Edge states:

- dim: known relationship
- cyan pulse: active communication
- amber: waiting for review
- red: blocked relationship
- green: recent successful handoff

Right-side detail panel:

```text
Selected Agent: Reviewer
Status: reviewing
PID: 18180
Current Task: ...
Latest Verdict: approve_next
Last Seen: 3m ago
Recent Messages:
- Reviewer -> PM: approval recommendation
- Architect -> Reviewer: constraint note
```

## Decisions

Purpose: PM decisions and decision archive.

```text
┌──────────────────────────────────────────────────────────────┐
│ Approval / Rejection Recorder                                │
│ Target Task: <current task>                                   │
│ [Record Approval] [Record Rejection]                          │
│ Optional reason                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Recorded Decisions                                            │
│ approve | task id | source PM dashboard | 5m ago              │
│ reject  | task id | reason | source PM dashboard | yesterday  │
└──────────────────────────────────────────────────────────────┘
```

Buttons remain recording-only.

## Operators

Purpose: concrete runtime status.

```text
┌──────────────────────┐ ┌──────────────────────┐
│ Implementer Codex     │ │ Reviewer Codex        │
│ detected              │ │ detected              │
│ PID / CPU             │ │ PID / CPU             │
│ active task           │ │ latest review file    │
│ latest builder result │ │ latest verdict        │
└──────────────────────┘ └──────────────────────┘

┌──────────────────────┐ ┌──────────────────────┐
│ MCP Loop              │ │ Reviewer Bridge       │
│ running / stopped     │ │ running / stopped     │
│ queue counts          │ │ last review time      │
│ stale judgement       │ │ source path           │
└──────────────────────┘ └──────────────────────┘
```

No start or stop controls in this phase.

## Timeline

Purpose: explain how the state changed.

```text
Today
  10:32  builder completed       success   mcp
  10:34  reviewer verdict        success   mcp
  10:35  PM approval recorded    info      supabase

Yesterday
  23:10  usage limit stop        warning   backend
```

Features:

- Group by day
- Relative time visible
- Exact timestamp in tooltip
- Source badges
- Show more / show less
- Type filters later

## Knowledge

Purpose: focused task graph.

```text
Task
  ├── Builder Result
  │     └── Review
  │           └── Decision
  │                 └── Commit
  └── Incident
        └── Recovery Note
```

Initial scope:

- Current task graph
- Latest completed task graph
- Filter by entity type
- Inspect node summary

## GitHub

Purpose: read-only repository status.

```text
GitHub integration not configured yet.

Future fields:
- repo
- branch
- latest commit
- recent PRs
- CI status
- linked task
```

Do not call GitHub API until explicitly implemented.

## Settings

Purpose: configuration clarity without exposing secrets.

```text
Frontend URL: http://localhost:5173
Backend URL: http://localhost:4000
Supabase: configured / unknown
ARCHIVEOS_PROJECT_PATH: configured / missing
CODEX_IMPLEMENTER_PID: configured / missing
CODEX_REVIEWER_PID: configured / missing

Security:
- service role key backend-only
- frontend uses publishable key only
- commands are recording-only
- local diagnostics are allowlisted
- no arbitrary shell execution
```

## Visual Priority

Most prominent:

- system active or idle
- active task
- current worker
- latest verdict
- blocker or stale warning

Less prominent:

- raw JSON
- long filenames
- placeholders
- historical logs older than today

## Animation Policy

Use animation only when it communicates live state:

- live loop dot pulse
- active handoff edge
- worker active pulse

Do not animate placeholders, historical events, or inactive edges.

