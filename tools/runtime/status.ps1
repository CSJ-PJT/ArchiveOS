Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "runtime.config.json"
$exampleConfigPath = Join-Path $scriptDir "runtime.config.example.json"
$logDir = Join-Path $scriptDir "logs"
$pidDir = Join-Path $scriptDir "pids"

if (-not (Test-Path -LiteralPath $configPath)) {
  $configPath = $exampleConfigPath
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$summary = @()

function Test-IsRunning {
  param([int]$ProcessId)

  try {
    $null = Get-Process -Id $ProcessId -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

foreach ($entry in $config.processes) {
  $enabled = if ($null -ne $entry.PSObject.Properties["enabled"]) { [bool]$entry.enabled } else { $true }
  $logFile = if ($entry.PSObject.Properties["logFile"] -and $entry.logFile) { $entry.logFile } else { Join-Path $logDir "$($entry.id).log" }
  $pidFile = if ($entry.PSObject.Properties["pidFile"] -and $entry.pidFile) { $entry.pidFile } else { Join-Path $pidDir "$($entry.id).pid" }
  $port = if ($entry.PSObject.Properties["port"]) { $entry.port } else { "" }
  $processPid = ""
  $status = if ($enabled) { "stopped" } else { "disabled" }

  if (Test-Path -LiteralPath $pidFile) {
    $pidText = (Get-Content -LiteralPath $pidFile -Raw).Trim()
    $processPid = $pidText

    if ($pidText -match "^\d+$" -and (Test-IsRunning -ProcessId ([int]$pidText))) {
      $status = "running"
    } else {
      $status = "stale-pid"
    }
  }

  $summary += [pscustomobject]@{
    id = $entry.id
    name = $entry.name
    pid = $processPid
    status = $status
    port = $port
    log = $logFile
  }
}

$summary | Format-Table -AutoSize
