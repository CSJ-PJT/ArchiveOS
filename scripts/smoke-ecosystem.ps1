param(
  [string]$NexusUrl = "http://localhost:8080",
  [string]$LogisticsUrl = "http://localhost:8092",
  [string]$LedgerUrl = "http://localhost:18080",
  [string]$OsApiUrl = "http://localhost:5173",
  [switch]$WriteSmoke,
  [string]$OsUsername = "admin",
  [string]$OsPassword = "",
  [int]$TimeoutSec = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-SmokeCall {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [pscustomobject]$Body = $null,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null
  )

  try {
    $params = @{
      Uri = $Url
      Method = $Method
      UseBasicParsing = $true
      TimeoutSec = $TimeoutSec
    }
    if ($Body) {
      $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
      $params.ContentType = "application/json"
    }
    if ($Session) {
      $params.WebSession = $Session
    }

    $response = Invoke-WebRequest @params
    $raw = $response.Content
    $status = $response.StatusCode

    try {
      $json = $raw | ConvertFrom-Json -ErrorAction Stop
      $snippet = $json | ConvertTo-Json -Depth 4
      if ($snippet.Length -gt 1800) {
        $snippet = $snippet.Substring(0, 1800) + "...(truncated)"
      }
    } catch {
      $snippet = $raw
    }
    Write-Host "[OK] $Name [$Method] $url -> $status"
    if ($snippet) {
      Write-Host ("  " + $snippet.Replace("`n", "`n  "))
    }
    return [pscustomobject]@{
      Name = $Name
      Method = $Method
      Url = $Url
      Status = $status
      Success = $true
      Snippet = $snippet
    }
  }
  catch {
    $code = 0
    $details = $_.Exception.Message
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        $details = $reader.ReadToEnd()
      } catch {
        $details = $_.Exception.Response.StatusDescription
      }
    }
    Write-Host "[ERR] $Name [$Method] $url -> $code"
    if ($details) {
      if ($details.Length -gt 1800) {
        $details = $details.Substring(0, 1800) + "...(truncated)"
      }
      Write-Host ("  " + $details.Replace("`n", "`n  "))
    }
    return [pscustomobject]@{
      Name = $Name
      Method = $Method
      Url = $Url
      Status = $code
      Success = $false
      Snippet = $details
    }
  }
}

function Login-Admin {
  param([string]$BaseApi, [string]$Username, [string]$Password)

  $effectivePassword = if ([string]::IsNullOrWhiteSpace($Password)) { $env:ARCHIVEOS_ADMIN_PASSWORD } else { $Password }
  if ([string]::IsNullOrWhiteSpace($effectivePassword)) {
    return $null
  }

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{
    username = $Username
    password = $effectivePassword
    role = "admin"
  } | ConvertTo-Json -Compress

  try {
    Invoke-WebRequest -Uri "$BaseApi/api/auth/login" -Method POST -WebSession $session -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec $TimeoutSec | Out-Null
    $sessCheck = Invoke-WebRequest -Uri "$BaseApi/api/auth/session" -Method GET -WebSession $session -UseBasicParsing -TimeoutSec $TimeoutSec
    Write-Host "[OK] logged in as admin for safe-mode/refresh endpoints."
    return $session
  } catch {
    Write-Host "[WARN] admin login skipped or failed. Admin-only checks may be 401/SAFE_MODE_BLOCKED."
    return $null
  }
}

$results = @()

Write-Host ""
Write-Host "=== ArchiveOS 4-service ecosystem smoke (read-only baseline) ==="
Write-Host "Nexus:       $NexusUrl"
Write-Host "Logitics:    $LogisticsUrl"
Write-Host "Ledger:      $LedgerUrl"
Write-Host "OS API:      $OsApiUrl"
Write-Host "WriteSmoke:  $WriteSmoke"
Write-Host ""

$results += Invoke-SmokeCall -Name "Nexus outbox summary" -Method GET -Url "$NexusUrl/api/outbox/summary"
$results += Invoke-SmokeCall -Name "Nexus integrations summary" -Method GET -Url "$NexusUrl/api/integrations/summary"
$results += Invoke-SmokeCall -Name "Logistics health" -Method GET -Url "$LogisticsUrl/actuator/health"
$results += Invoke-SmokeCall -Name "Logistics operations summary" -Method GET -Url "$LogisticsUrl/api/operations/summary"
$results += Invoke-SmokeCall -Name "Logistics outbox summary" -Method GET -Url "$LogisticsUrl/api/outbox/summary"
$results += Invoke-SmokeCall -Name "Logistics routes summary" -Method GET -Url "$LogisticsUrl/api/routes/summary"
$results += Invoke-SmokeCall -Name "Ledger health" -Method GET -Url "$LedgerUrl/actuator/health"
$results += Invoke-SmokeCall -Name "Ledger operations summary" -Method GET -Url "$LedgerUrl/api/operations/summary"
$results += Invoke-SmokeCall -Name "Ledger approval required transactions" -Method GET -Url "$LedgerUrl/api/transactions?status=APPROVAL_REQUIRED"
$results += Invoke-SmokeCall -Name "Ledger reconciliation summary" -Method GET -Url "$LedgerUrl/api/reconciliation/summary"
$results += Invoke-SmokeCall -Name "ArchiveOS ecosystem services" -Method GET -Url "$OsApiUrl/api/ecosystem/services"
$results += Invoke-SmokeCall -Name "ArchiveOS ecosystem summary" -Method GET -Url "$OsApiUrl/api/ecosystem/summary"
$results += Invoke-SmokeCall -Name "ArchiveOS ecosystem topology" -Method GET -Url "$OsApiUrl/api/ecosystem/topology"
$results += Invoke-SmokeCall -Name "ArchiveOS nexus integration" -Method GET -Url "$OsApiUrl/api/integrations/nexus/outbox"
$results += Invoke-SmokeCall -Name "ArchiveOS logistics integration" -Method GET -Url "$OsApiUrl/api/integrations/logitics/summary"
$results += Invoke-SmokeCall -Name "ArchiveOS logistics outbox" -Method GET -Url "$OsApiUrl/api/integrations/logitics/outbox"
$results += Invoke-SmokeCall -Name "ArchiveOS logistics routes" -Method GET -Url "$OsApiUrl/api/integrations/logitics/routes"
$results += Invoke-SmokeCall -Name "ArchiveOS ledger integration" -Method GET -Url "$OsApiUrl/api/integrations/ledger/summary"
$results += Invoke-SmokeCall -Name "ArchiveOS ledger approval-required (OS view)" -Method GET -Url "$OsApiUrl/api/integrations/ledger/approval-required"

$session = Login-Admin -BaseApi $OsApiUrl -Username $OsUsername -Password $OsPassword
if ($session) {
  $results += Invoke-SmokeCall -Name "ArchiveOS safe mode dry-run" -Method POST -Url "$OsApiUrl/api/ecosystem/demo/dry-run" -Session $session
  $results += Invoke-SmokeCall -Name "ArchiveOS refresh" -Method POST -Url "$OsApiUrl/api/ecosystem/refresh" -Session $session
  $results += Invoke-SmokeCall -Name "ArchiveOS safe mode run" -Method POST -Url "$OsApiUrl/api/ecosystem/demo/run" -Session $session
}

if ($WriteSmoke.IsPresent) {
  Write-Host ""
  Write-Host "=== Write smoke (direct service integration paths + optional OS checks) ==="
  Write-Host "Warning: write smoke mutates test data in service environments."

  $results += Invoke-SmokeCall -Name "Nexus generate logistics (10)" -Method POST -Url "$NexusUrl/api/outbox/events/generate?count=10&type=logistics"
  $results += Invoke-SmokeCall -Name "Nexus publish logistics" -Method POST -Url "$NexusUrl/api/outbox/events/publish?target=logitics"
  $results += Invoke-SmokeCall -Name "Logistics outbox publish" -Method POST -Url "$LogisticsUrl/api/outbox/publish"
  $results += Invoke-SmokeCall -Name "Nexus generate ledger (10)" -Method POST -Url "$NexusUrl/api/outbox/events/generate?count=10&type=ledger"
  $results += Invoke-SmokeCall -Name "Nexus publish ledger" -Method POST -Url "$NexusUrl/api/outbox/events/publish?target=ledger"
  $results += Invoke-SmokeCall -Name "Nexus generate approval-risk (5)" -Method POST -Url "$NexusUrl/api/outbox/events/generate?count=5&type=approval-risk"
  $results += Invoke-SmokeCall -Name "Nexus publish approval-risk to ledger" -Method POST -Url "$NexusUrl/api/outbox/events/publish?target=ledger"

  $results += Invoke-SmokeCall -Name "Logistics operations summary (after write smoke)" -Method GET -Url "$LogisticsUrl/api/operations/summary"
  $results += Invoke-SmokeCall -Name "Logistics outbox summary (after write smoke)" -Method GET -Url "$LogisticsUrl/api/outbox/summary"
  $results += Invoke-SmokeCall -Name "Ledger operations summary (after write smoke)" -Method GET -Url "$LedgerUrl/api/operations/summary"
  $results += Invoke-SmokeCall -Name "Ledger transactions from Archive-Logitics" -Method GET -Url "$LedgerUrl/api/transactions?source=Archive-Logitics"
  $results += Invoke-SmokeCall -Name "Ledger approval-required (after write smoke)" -Method GET -Url "$LedgerUrl/api/transactions?status=APPROVAL_REQUIRED"
  $results += Invoke-SmokeCall -Name "Ledger ledger entries" -Method GET -Url "$LedgerUrl/api/ledger/entries"
  $results += Invoke-SmokeCall -Name "ArchiveOS approval-required mirror check" -Method GET -Url "$OsApiUrl/api/integrations/ledger/approval-required"
}

$okCount = @($results | Where-Object Success -eq $true).Count
$errCount = @($results | Where-Object Success -eq $false).Count

Write-Host ""
Write-Host "=== Summary ==="
Write-Host "Total checks: $($results.Count)"
Write-Host "Success: $okCount"
Write-Host "Fail/Blocked: $errCount"

if ($errCount -gt 0) {
  Write-Host "Failures / warnings:"
  $results | Where-Object Success -eq $false | ForEach-Object { Write-Output (" - " + $_.Name + " => " + $_.Status) }
}

Write-Host ""
Write-Host "Notes:"
Write-Host "- Safe-mode write behavior is expected in default config (`ARCHIVE_INTEGRATION_SAFE_MODE=true`, `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=false`)."
Write-Host "- If write endpoints are blocked, enable writes intentionally before re-running."
Write-Host "- Do not commit secrets; provide password via -OsPassword or ARCHIVEOS_ADMIN_PASSWORD environment variable."
