Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "runtime.config.json"
$exampleConfigPath = Join-Path $scriptDir "runtime.config.example.json"
$logDir = Join-Path $scriptDir "logs"
$pidDir = Join-Path $scriptDir "pids"

New-Item -ItemType Directory -Force -Path $logDir, $pidDir | Out-Null

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

function Get-PortOwner {
  param([object]$Port)

  if ([string]::IsNullOrWhiteSpace([string]$Port)) {
    return $null
  }

  try {
    return Get-NetTCPConnection -LocalPort ([int]$Port) -State Listen -ErrorAction Stop |
      Select-Object -First 1 -ExpandProperty OwningProcess
  } catch {
    return $null
  }
}

function Resolve-Args {
  param([object[]]$InputArgs)

  $implementerPid = $env:IMPLEMENTER_PID
  if ([string]::IsNullOrWhiteSpace($implementerPid)) {
    $implementerPid = $env:TARGET_PID
  }
  if ([string]::IsNullOrWhiteSpace($implementerPid)) {
    $implementerPid = $env:CODEX_IMPLEMENTER_PID
  }

  $resolved = @()
  foreach ($arg in $InputArgs) {
    $value = [string]$arg
    if ($value -eq "MANUAL_IMPLEMENTER_PID") {
      if ([string]::IsNullOrWhiteSpace($implementerPid)) {
        return @{ ok = $false; error = "needs-implementer-pid"; args = @() }
      }
      $resolved += $implementerPid
    } else {
      $resolved += $value
    }
  }

  return @{ ok = $true; error = ""; args = $resolved }
}

function Test-FileArgument {
  param([string[]]$InputArgs)

  for ($index = 0; $index -lt $InputArgs.Count; $index++) {
    if ($InputArgs[$index] -eq "-File") {
      if ($index + 1 -ge $InputArgs.Count -or -not (Test-Path -LiteralPath $InputArgs[$index + 1])) {
        return $false
      }
    }
  }

  return $true
}

foreach ($entry in $config.processes) {
  $enabled = if ($null -ne $entry.PSObject.Properties["enabled"]) { [bool]$entry.enabled } else { $true }
  $logFile = if ($entry.PSObject.Properties["logFile"] -and $entry.logFile) { $entry.logFile } else { Join-Path $logDir "$($entry.id).log" }
  $pidFile = if ($entry.PSObject.Properties["pidFile"] -and $entry.pidFile) { $entry.pidFile } else { Join-Path $pidDir "$($entry.id).pid" }
  $port = if ($entry.PSObject.Properties["port"]) { $entry.port } else { "" }

  if (-not $enabled) {
    $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = ""; status = "disabled"; port = $port; log = $logFile }
    continue
  }

  if (Test-Path -LiteralPath $pidFile) {
    $existingPidText = (Get-Content -LiteralPath $pidFile -Raw).Trim()
    if ($existingPidText -match "^\d+$" -and (Test-IsRunning -ProcessId ([int]$existingPidText))) {
      $portOwner = Get-PortOwner -Port $port
      if (-not [string]::IsNullOrWhiteSpace([string]$port) -and $null -eq $portOwner) {
        Remove-Item -LiteralPath $pidFile -Force
      } else {
      $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = $existingPidText; status = "already-running"; port = $port; log = $logFile }
      continue
      }
    } else {
      Remove-Item -LiteralPath $pidFile -Force
    }
  }

  if (-not (Test-Path -LiteralPath $entry.cwd)) {
    $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = ""; status = "missing-cwd"; port = $port; log = $logFile }
    continue
  }

  $portOwner = Get-PortOwner -Port $port
  if ($null -ne $portOwner) {
    $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = $portOwner; status = "port-in-use"; port = $port; log = $logFile }
    continue
  }

  $configuredArgs = @($entry.PSObject.Properties["args"].Value)
  $resolvedArgs = Resolve-Args -InputArgs $configuredArgs
  if (-not $resolvedArgs["ok"]) {
    $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = ""; status = $resolvedArgs["error"]; port = $port; log = $logFile }
    continue
  }

  $arguments = @($resolvedArgs["args"] | ForEach-Object { [string]$_ })
  if (-not (Test-FileArgument -InputArgs $arguments)) {
    $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = ""; status = "missing-file"; port = $port; log = $logFile }
    continue
  }

  $logLiteral = $logFile.Replace("'", "''")
  $cwdLiteral = ([string]$entry.cwd).Replace("'", "''")
  $commandLiteral = ([string]$entry.command).Replace("'", "''")
  $argList = ($arguments | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ", "
  $runner = "`$ErrorActionPreference = 'Continue'; Set-Location -LiteralPath '$cwdLiteral'; & '$commandLiteral' @($argList) *>> '$logLiteral'"

  $process = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $runner) -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

  $summary += [pscustomobject]@{ id = $entry.id; name = $entry.name; pid = $process.Id; status = "started"; port = $port; log = $logFile }
}

$summary | Format-Table -AutoSize
