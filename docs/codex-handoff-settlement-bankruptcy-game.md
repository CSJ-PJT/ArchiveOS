# Codex Handoff · Settlement Agency Profit + Bankruptcy Prevention Game

Audience: ArchiveOS Codex thread

Archive-Ledger now has a local synthetic game/simulation namespace for settlement-agency revenue and bankruptcy prevention.

All data is Synthetic Data / Demo Data. Do not use real user, financial, card, account, logistics, shipment, or map data.

## Ledger game API

```http
GET  http://localhost:18080/api/game/settlement-agency/preset
POST http://localhost:18080/api/game/settlement-agency/simulate
```

## ArchiveOS role

ArchiveOS should act as the Control Tower / Game Master:

- read the simulation result
- show cash balance, burn rate, bankruptcy risk
- collect service-agent proposals
- require safe-mode / approval / user decision for real writes
- never execute fee policy changes directly from agent suggestions

## Required event metadata

Every game event includes:

- `simulationRunId`
- `settlementCycleId`
- `tickId`
- `day`
- `correlationId`
- `hop`
- `maxHop`

Use `maxHop` and processed-event guards when connecting Nexus, Logistics, Ledger, and OS to prevent infinite loops.

## Recommended ArchiveOS UI/API additions

Read-only first:

```http
GET /api/game/settlement-agency/summary
POST /api/game/settlement-agency/simulate?dryRun=true
```

Suggested cards:

- Ecosystem cash balance
- Nexus cash / profit
- Logistics cash / profit
- Ledger cash / settlement-agency revenue
- Burn rate
- Bankruptcy risk
- Agent proposals waiting for approval

Do not mix this with normal operational settlement APIs. Keep it under `GAME` or `SIMULATION` namespace.

## Ledger files to inspect

Repository:

```text
C:\Users\dan18\Documents\ArchivePJT\Archive-Ledger
```

Files:

- `src/main/java/com/archiveledger/ledger/game/SettlementGameModels.java`
- `src/main/java/com/archiveledger/ledger/game/SettlementGameService.java`
- `src/main/java/com/archiveledger/ledger/game/SettlementGameController.java`
- `src/test/java/com/archiveledger/ledger/SettlementGameServiceTest.java`
- `docs/settlement-agency-bankruptcy-game.md`
