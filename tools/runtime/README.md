# ArchiveOS Local Runtime Orchestrator

These scripts are local developer tools for starting, stopping, and inspecting non-interactive runtime processes used around ArchiveOS and DeepStake/WorldPrototype3D work.

ArchiveOS UI remains read-only. These scripts are not exposed through the frontend or backend API.

## Managed Processes

The example config includes entries for:

- ArchiveOS frontend
- ArchiveOS backend
- MCP queue loop
- reviewer bridge
- optional queue watcher placeholder

Interactive Codex implementer and reviewer sessions are not started by these scripts. Start those manually and keep using PID hints such as `CODEX_IMPLEMENTER_PID` and `CODEX_REVIEWER_PID` for ArchiveOS visibility.

`Run-ModularLoop.ps1` starts `src/gpt-session-bridge.mjs` internally. The standalone `reviewer-bridge` entry is disabled by default to avoid duplicate reviewer bridge processes.

## Setup

Copy the example config and edit local paths and PIDs:

```powershell
Copy-Item .\tools\runtime\runtime.config.example.json .\tools\runtime\runtime.config.json
notepad .\tools\runtime\runtime.config.json
```

Set `enabled` to `false` for anything you do not want started. Replace placeholder DeepStake/WorldPrototype3D paths and `MANUAL_IMPLEMENTER_PID` values before starting the MCP loop.
The committed example keeps `-MaxAutoTasks` at `1` as a safe default. Change your local ignored `runtime.config.json` to `unlimited` only when you intentionally want the loop to continue.

You can also provide the implementer PID with an environment variable instead of editing every placeholder:

```powershell
$env:IMPLEMENTER_PID = "15232"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\start-all.ps1
```

## Commands

Start configured processes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\start-all.ps1
```

Inspect status:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\status.ps1
```

Stop processes started by this orchestrator:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\stop-all.ps1
```

## Files

- Logs are written to `tools/runtime/logs/{id}.log`.
- PID files are written to `tools/runtime/pids/{id}.pid`.
- `runtime.config.json`, logs, and PID files are local-only and ignored by git.

## Security

This is local-only process orchestration. It reads configured process entries from local JSON and does not accept arbitrary command input from the ArchiveOS frontend. Do not expose these scripts through the backend API until there is a separate security design.
