Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidDir = Join-Path $scriptDir "pids"
$summary = @()

function Get-ChildProcessIds {
  param([int]$ParentPid)

  try {
    return @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentPid" -ErrorAction Stop |
      Select-Object -ExpandProperty ProcessId)
  } catch {
    return @()
  }
}

function Stop-ProcessTree {
  param([int]$RootPid)

  foreach ($childPid in Get-ChildProcessIds -ParentPid $RootPid) {
    Stop-ProcessTree -RootPid ([int]$childPid)
  }

  try {
    Stop-Process -Id $RootPid -Force -ErrorAction Stop
  } catch {
    # The process may have already exited while its children were stopping.
  }
}

function Stop-Or-ClearPid {
  param(
    [string]$PidFile
  )

  $id = [System.IO.Path]::GetFileNameWithoutExtension($PidFile)
  $pidText = (Get-Content -LiteralPath $PidFile -Raw).Trim()

  if ($pidText -notmatch "^\d+$") {
    Remove-Item -LiteralPath $PidFile -Force
    return [pscustomobject]@{ id = $id; pid = $pidText; status = "removed-invalid-pid-file" }
  }

  try {
    $process = Get-Process -Id ([int]$pidText) -ErrorAction Stop
    Stop-ProcessTree -RootPid $process.Id
    Remove-Item -LiteralPath $PidFile -Force
    return [pscustomobject]@{ id = $id; pid = $pidText; status = "stopped" }
  } catch {
    Remove-Item -LiteralPath $PidFile -Force
    return [pscustomobject]@{ id = $id; pid = $pidText; status = "removed-stale-pid-file" }
  }
}

if (-not (Test-Path -LiteralPath $pidDir)) {
  Write-Host "No PID directory found: $pidDir"
  return
}

foreach ($pidFile in Get-ChildItem -LiteralPath $pidDir -Filter "*.pid" -File) {
  $summary += Stop-Or-ClearPid -PidFile $pidFile.FullName
}

if ($summary.Count -eq 0) {
  Write-Host "No orchestrator PID files found."
} else {
  $summary | Format-Table -AutoSize
}
