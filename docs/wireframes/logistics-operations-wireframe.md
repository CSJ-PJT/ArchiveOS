# Logistics Operations Wireframe / 화면설계도

This is a Wireframe / 화면설계도, not an actual screenshot.

## Sections

- Route Summary: total route plans, delayed routes, deviated routes
- Cost Summary: base cost, cold-chain surcharge, urgent delivery surcharge
- Delayed / Deviated Filter: risk-focused route list
- Outbox Publish Status: pending, published, retry, failed
- Simulation Trigger: synthetic event generation and dry-run publish

## Operator Flow

1. Review route risk summary.
2. Filter delayed or deviated routes.
3. Inspect logistics cost drivers.
4. Confirm outbox publish state.
5. Trigger synthetic demo data only when safe-mode allows it.

