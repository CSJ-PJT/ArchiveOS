# Screenshot Checklist

Use this checklist when automated screenshots cannot run.

## UI Targets

| File | URL / route | Expected state |
| --- | --- | --- |
| `archiveos-01-ecosystem-overview.png` | `http://localhost:5173` → Ecosystem | Synthetic ecosystem overview, health cards visible |
| `archiveos-02-service-registry.png` | `http://localhost:5173` → Ecosystem | Service Registry section visible |
| `archiveos-03-topology.png` | `http://localhost:5173` → Ecosystem | Topology section visible |
| `archiveos-04-ledger-approval-queue.png` | `http://localhost:5173` → Ledger Approvals | Approval queue visible |
| `archiveos-05-callback-outbox.png` | `http://localhost:5173` → Ledger Approvals | Callback outbox section visible |
| `archiveos-06-policy-evidence.png` | `http://localhost:5173` → Ledger Approvals | Policy evidence or empty-state visible |
| `archiveos-07-safe-mode-demo.png` | `http://localhost:5173` → Ecosystem → Demo dry-run | Dry-run or safe-mode status visible |

## API Targets

| File | URL |
| --- | --- |
| `api-01-nexus-outbox-summary.png` | `http://localhost:8080/api/outbox/summary` |
| `api-02-logistics-routes-summary.png` | `http://localhost:8092/api/routes/summary` |
| `api-03-ledger-operations-summary.png` | `http://localhost:18080/api/operations/summary` |
| `api-04-ledger-reconciliation-summary.png` | `http://localhost:18080/api/reconciliation/summary` |
| `api-05-archiveos-ecosystem-summary.png` | `http://localhost:5173/api/ecosystem/summary` |
| `api-06-archiveos-topology.png` | `http://localhost:5173/api/ecosystem/topology` |

## Safety

- Do not capture `.env`, secrets, local passwords, tokens, or webhook values.
- Do not present a wireframe as an actual screenshot.
- Confirm all visible data is synthetic/demo data.

