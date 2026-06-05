# Knowledge Graph MVP

## Goal

ArchiveOS does not need to recreate the full Obsidian graph in Phase 2.

The MVP should answer operational questions:

- Which decision approved this work?
- Which review blocked this task?
- Which commit implemented this task?
- Which incident explains the delay?
- Which agent produced the current result?
- Which architecture note guided this change?

## MVP Entity Types

| Entity | Meaning |
| --- | --- |
| Task | Unit of work from queue or PM |
| Agent | Implementer, Reviewer, Architect, Historian, PM, etc. |
| Review | Reviewer result or verdict |
| Decision | PM or reviewer decision |
| Commit | Git commit or future GitHub commit |
| Incident | Failure, stale processing, usage limit, runtime crash |
| Artifact | Result file, screenshot, Markdown note, raw review |
| Architecture Note | Design direction or constraint |

## MVP Relationships

| Relationship | Example |
| --- | --- |
| produced_by | Builder result produced_by Implementer |
| reviewed_by | Builder result reviewed_by Reviewer |
| approved_by | Decision approved_by PM |
| rejected_by | Decision rejected_by PM |
| implements | Commit implements Task |
| blocks | Incident blocks Task |
| caused_by | Warning caused_by Codex usage limit |
| supersedes | Decision supersedes older Decision |
| references | Review references Architecture Note |
| exported_to | Decision exported_to Obsidian Note |

## Suggested Storage Model

Use a generic relationship table first.

```text
entity_links
  id
  from_entity_type
  from_entity_id
  to_entity_type
  to_entity_id
  relationship_type
  source
  created_at
```

This avoids overfitting too early. Dedicated tables can be added later for high-volume relationships.

## Graph Construction Sources

| Source | Graph Contribution |
| --- | --- |
| MCP queue | Task state and result artifacts |
| Reviewer result | Review entity, verdict edge |
| Supabase decisions | Decision entity, PM action edges |
| Git log | Commit entity, possible task links |
| GitHub later | PR and CI nodes |
| Obsidian export | Markdown note entities |

## UI MVP

Start with a focused graph, not a huge canvas.

Recommended first view:

```text
Task
  -> Builder Result
  -> Review
  -> Decision
  -> Commit
```

Add side branches:

```text
Incident -> blocks -> Task
Architecture Note -> guides -> Task
Historian -> exported_to -> Obsidian Note
```

## Interaction Model

Read-only first:

- Click node to inspect summary
- Copy ID or filename
- Filter by task
- Filter by source
- Filter by entity type
- Highlight stale or failed paths
- Open related Timeline events

No graph node should trigger execution in Phase 2.

## Visual Encoding

| Type | Shape/Color Suggestion |
| --- | --- |
| Task | blue rounded node |
| Agent | cyan circular node |
| Review | amber node |
| Decision | green or red depending on outcome |
| Incident | red warning node |
| Commit | purple or gray node |
| Artifact | slate node |
| Obsidian Note | green outlined node |

## MVP Success Criteria

The Knowledge Graph MVP is enough when it can show:

- one active task's lifecycle
- latest builder result
- latest reviewer verdict
- latest PM decision
- related warning or incident
- linked Obsidian export if present

Avoid broad organization-wide graph exploration until the focused task graph is useful.

