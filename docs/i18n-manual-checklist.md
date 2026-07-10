# ArchiveOS i18n Manual Checklist

Use this checklist when running ArchiveOS locally at `http://localhost:5173`.

## Common checks

- [ ] Open ArchiveOS frontend.
- [ ] Confirm the top-right globe selector is visible.
- [ ] Select `한국어`.
- [ ] Confirm the selected locale persists after refresh.
- [ ] Select `English`.
- [ ] Confirm visible labels switch without page reload.
- [ ] Select `日本語`.
- [ ] Confirm visible labels switch without page reload.
- [ ] Select `简体中文`.
- [ ] Confirm visible labels switch without page reload.
- [ ] Resize to mobile width and confirm the language selector does not break layout.

## Screen checks

- [ ] Overview
- [ ] Managed Systems
- [ ] Ecosystem
- [ ] Ecosystem Survival Mode
- [ ] Ledger Approvals
- [ ] Workflows
- [ ] Knowledge
- [ ] History
- [ ] Agents
- [ ] Batch
- [ ] RPA
- [ ] Atlas
- [ ] MCP Registry
- [ ] Settings

## Contract checks

- [ ] `ArchiveOS`, `Archive-Nexus`, `Archive-Logistics`, `Archive-Ledger` remain untranslated.
- [ ] API paths remain unchanged.
- [ ] eventType and enum values remain unchanged in source data.
- [ ] UI-only status labels can be translated.
- [ ] Internal `logitics` compatibility key remains where existing contracts require it.

## Evidence path

If screenshots are needed, save them under:

- `docs/screenshots/i18n-ko.png`
- `docs/screenshots/i18n-en.png`
- `docs/screenshots/i18n-ja.png`
- `docs/screenshots/i18n-zh-CN.png`
