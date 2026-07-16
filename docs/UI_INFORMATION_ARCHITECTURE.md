# ArchiveOS UI Information Architecture

ArchiveOS v1 now presents the product as a focused AI Agent Operations Platform instead of a dense collection of implementation cards.

## Final Navigation

The top-level navigation is reduced to five areas:

1. **Overview** - 5-second PM operations summary.
2. **Workflows** - task queue, pipeline stages, agent ownership, and PM decisions.
3. **Knowledge** - human-reviewed Decision Records, graph, RAG, and Obsidian status. It is not an automatic learning or model-training area.
4. **History** - timeline, commands, decisions, errors, and KPI detail.
5. **Settings** - runtime, integrations, public access, security, theme, and build information.

Legacy Dashboard, Decisions, Operators, Timeline, Mesh, and KPI concepts are preserved, but their details are moved into these five areas.

## Overview Priority

Overview shows only the information needed for a fast PM judgement:

- System status
- Active task
- Current agent
- Current pipeline stage
- Approval waiting count
- Critical alerts
- Runtime flow
- Queue counts
- Memory constellation preview
- Active chain focus
- Attention required
- Five most recent events

Detailed tables, full timelines, full graphs, and repeated health cards are intentionally moved out of Overview.

## Theme System

The UI now uses semantic CSS tokens:

- `--color-bg`
- `--color-surface`
- `--color-surface-elevated`
- `--color-surface-muted`
- `--color-border`
- `--color-border-strong`
- `--color-text`
- `--color-text-muted`
- `--color-text-subtle`
- `--color-primary`
- `--color-primary-contrast`
- `--color-success`
- `--color-warning`
- `--color-danger`
- `--color-info`
- `--color-overlay`
- `--color-focus-ring`

Dark, light, and system modes share the same component structure and only swap token values.

## Code Structure

`src/App.tsx` is now a thin shell entry. The main UI is split into:

- `src/app/AppShell.tsx`
- `src/app/navigation.ts`
- `src/pages/OverviewPage.tsx`
- `src/pages/WorkflowsPage.tsx`
- `src/pages/KnowledgePage.tsx`
- `src/pages/HistoryPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/components/shared/*`
- `src/theme/ThemeProvider.tsx`
- `src/lib/viewModels/overview.ts`

The Overview page consumes an `OverviewViewModel` instead of directly spreading raw API data through the page.

## Safety

The UI remains visibility-first:

- No Codex direct execution controls
- No MCP command execution controls
- No arbitrary shell execution UI
- PM decision buttons only record ArchiveOS task state
- Secrets and webhook values are not exposed
