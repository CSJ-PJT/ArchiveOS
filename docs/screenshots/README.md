# Screenshots

This directory stores actual captured UI/API evidence when local Archive Platform services are running.

Screenshots must not include secrets, tokens, webhooks, private keys, real user data, real financial data, or real delivery/map data. All displayed data is synthetic/demo data.

## Capture Script

```powershell
$env:PUPPETEER_NODE_PATH="D:\ArchiveTools\mermaid-cli\node_modules"
.\scripts\capture-screenshots.ps1
```

Set `-BaseUrl` if ArchiveOS is not running on `http://localhost:5173`.

## Targets

- ArchiveOS Ecosystem Overview
- Service Registry
- Topology
- Ledger Approval Queue
- Callback Outbox
- Policy Evidence / Fallback Evidence
- Safe-mode / Dry-run Demo
- API JSON captures for Nexus, Logistics, Ledger, and ArchiveOS

