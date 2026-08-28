Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$controlRoot = Join-Path $scriptDir "queue\control"
$inbox = Join-Path $controlRoot "inbox"
$outbox = Join-Path $controlRoot "outbox"
$statusPath = Join-Path $controlRoot "host-status.json"
$runtimePidPath = Join-Path $scriptDir "pids\mcp-queue-loop.pid"
$allowed = @("runtime_status", "runtime_start_all", "runtime_stop_all", "runtime_restart_all")

New-Item -ItemType Directory -Force -Path $inbox, $outbox | Out-Null

function Invoke-AllowlistedRuntimeAction {
  param([string]$Action)

  $stdout = ""
  $stderr = ""
  $exitCode = 0
  try {
    $output = switch ($Action) {
      "runtime_status" { & (Join-Path $scriptDir "status.ps1") 2>&1 }
      "runtime_start_all" { & (Join-Path $scriptDir "start-all.ps1") 2>&1 }
      "runtime_stop_all" { & (Join-Path $scriptDir "stop-all.ps1") 2>&1 }
      "runtime_restart_all" {
        & (Join-Path $scriptDir "stop-all.ps1") 2>&1
        & (Join-Path $scriptDir "start-all.ps1") 2>&1
      }
      default { throw "Action is not allowlisted." }
    }
    $stdout = ($output | Out-String).Trim()
  } catch {
    $exitCode = 1
    $stderr = $_.Exception.Message
  }

  return [ordered]@{
    status = if ($exitCode -eq 0) { "succeeded" } else { "failed" }
    stdout = $stdout
    stderr = $stderr
    exitCode = $exitCode
    completedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
}

while ($true) {
  $runtimePid = 0
  $runtimeRunning = $false
  if (Test-Path -LiteralPath $runtimePidPath) {
    $runtimePidText = (Get-Content -LiteralPath $runtimePidPath -Raw).Trim()
    if ($runtimePidText -match "^\d+$") {
      $runtimePid = [int]$runtimePidText
      $runtimeRunning = $null -ne (Get-Process -Id $runtimePid -ErrorAction SilentlyContinue)
    }
  }
  $hostStatus = [ordered]@{
    running = $runtimeRunning
    pid = $runtimePid
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($statusPath, $hostStatus, [System.Text.UTF8Encoding]::new($false))

  foreach ($file in @(Get-ChildItem -LiteralPath $inbox -Filter "*.json" -File -ErrorAction SilentlyContinue | Sort-Object CreationTimeUtc)) {
    try {
      $request = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
      if ([string]::IsNullOrWhiteSpace([string]$request.id) -or $allowed -notcontains [string]$request.action) {
        throw "Invalid runtime control request."
      }
      $result = Invoke-AllowlistedRuntimeAction -Action ([string]$request.action)
      $resultPath = Join-Path $outbox ("{0}.json" -f [string]$request.id)
      $tempPath = "$resultPath.tmp"
      $json = $result | ConvertTo-Json -Depth 4
      [System.IO.File]::WriteAllText($tempPath, $json, [System.Text.UTF8Encoding]::new($false))
      Move-Item -LiteralPath $tempPath -Destination $resultPath -Force
    } catch {
      # Malformed requests are discarded. No arbitrary command or path is accepted.
    } finally {
      Remove-Item -LiteralPath $file.FullName -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Milliseconds 250
}
