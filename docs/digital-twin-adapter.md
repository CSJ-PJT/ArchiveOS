# ArchiveOS Digital Twin Adapter

ArchiveOS exposes a read-only adapter for an external Three.js viewer. It does not embed Three.js, read GLB bytes, render scenes, or manage Archive-World assets.

## Modes

- `ARCHIVE_WORLD_ADAPTER_MODE=mock`: development mode. Returns an explicit mock state, no asset manifest and no generated runtime events.
- `ARCHIVE_WORLD_ADAPTER_MODE=live`: reads the generated `archive-world-assets.json` manifest from `ARCHIVE_WORLD_MANIFEST_PATH` and maps persisted Live Flow/Timeline facts.

The mounted Archive-World directory is read-only. The API returns only validated local relative manifest paths; absolute host paths, URLs, and traversal paths are excluded.

## Read-only APIs

- `GET /api/world/assets` — generated Archive-World manifest DTO.
- `GET /api/world/layout` — logical district/route DTO.
- `GET /api/world/events` — actual persisted Live Flow events, optionally scoped by `correlationId`.
- `GET /api/world/state` — adapter, manifest, and runtime state.
- `GET /api/world/stream` — SSE `world-state`, `world-event`, and heartbeat frames.

`world-event` contains only viewer hints: `highlight`, `pulse`, and `route_animation`. A frame is emitted only after a persisted runtime event is accepted by ArchiveOS; no random animation, GLB URL generation, or renderer command is created.

## Runtime mapping

| Runtime fact | Viewer district |
|---|---|
| order/demand/payment | Market District |
| production/material/quality | Nexus District |
| shipment/route/delivery | Logistics District |
| transaction/ledger/settlement/reconciliation | Ledger District |
| ArchiveOS ingest/approval/callback | Control Tower |

Authentication and Timeline contracts are unchanged. The adapter introduces no write endpoint and no database migration.
