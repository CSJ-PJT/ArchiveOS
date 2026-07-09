# Codex Handoff

Archive-Nexus is prepared locally to receive synthetic daily manufacturing settlement callbacks from Archive-Logistics.

ArchiveOS should later connect this as read-only Control Tower visibility.

Read:

```text
docs/codex-handoff-nexus-logistics-daily-settlement.md
```

Key Nexus read APIs:

```http
GET http://localhost:8080/api/logistics/settlements/summary
GET http://localhost:8080/api/logistics/settlements/daily?limit=50
```

Use Synthetic Data / Demo Data only.
