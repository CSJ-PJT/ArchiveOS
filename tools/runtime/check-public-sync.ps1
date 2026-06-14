param(
  [string]$FrontendUrl = "http://127.0.0.1:5173",
  [string]$BackendUrl = "http://127.0.0.1:4000",
  [string]$FrontendEnvPath = ".env",
  [string]$BackendEnvPath = "backend/.env"
)

$ErrorActionPreference = "Stop"

function Read-EnvValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -First 1

  if (-not $line) {
    return $null
  }

  return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", "").Trim()
}

function Invoke-JsonOrNull {
  param([string]$Url)

  try {
    return Invoke-RestMethod -Uri $Url -TimeoutSec 10
  } catch {
    return $null
  }
}

$viteBackendUrl = Read-EnvValue -Path $FrontendEnvPath -Name "VITE_BACKEND_URL"
$frontendPublicUrl = Read-EnvValue -Path $BackendEnvPath -Name "ARCHIVEOS_PUBLIC_URL"
$backendPublicUrl = Read-EnvValue -Path $BackendEnvPath -Name "ARCHIVEOS_BACKEND_PUBLIC_URL"

Write-Host "ArchiveOS public/runtime sync check"
Write-Host "No processes are started or stopped by this script."
Write-Host ""

$frontendHealth = Invoke-JsonOrNull -Url $FrontendUrl
$runtimeVersion = Invoke-JsonOrNull -Url "$BackendUrl/api/runtime/version"
$endpointHealth = Invoke-JsonOrNull -Url "$BackendUrl/api/health/endpoints"
$publicAccess = Invoke-JsonOrNull -Url "$BackendUrl/api/runtime/public-access"

[pscustomobject]@{
  FrontendUrl = $FrontendUrl
  FrontendReachable = [bool]$frontendHealth
  BackendUrl = $BackendUrl
  BackendVersionReachable = [bool]$runtimeVersion
  BackendCommit = $runtimeVersion.data.commitSha
  BackendBranch = $runtimeVersion.data.branch
  BackendStartedAt = $runtimeVersion.data.startedAt
  EndpointOk = $endpointHealth.summary.ok
  EndpointTotal = $endpointHealth.summary.total
  ViteBackendUrl = $viteBackendUrl
  FrontendPublicUrl = $frontendPublicUrl
  BackendPublicUrl = $backendPublicUrl
  BackendPublicSource = $publicAccess.data.backendUrlSource
} | Format-List

$warnings = New-Object System.Collections.Generic.List[string]

if (-not $runtimeVersion) {
  $warnings.Add("Backend /api/runtime/version is unreachable.")
}

if (-not $endpointHealth) {
  $warnings.Add("Backend /api/health/endpoints is unreachable.")
} elseif ($endpointHealth.summary.error -gt 0 -or $endpointHealth.summary.missing -gt 0) {
  $warnings.Add("Endpoint Health Matrix reports errors or missing endpoints.")
}

if ($viteBackendUrl -match "^(http://)?(localhost|127\.0\.0\.1)(:\d+)?") {
  $warnings.Add("VITE_BACKEND_URL points to localhost. A public ngrok frontend will not be able to call it from a phone.")
}

if (-not $frontendPublicUrl) {
  $warnings.Add("ARCHIVEOS_PUBLIC_URL is missing.")
}

if (-not $backendPublicUrl) {
  $warnings.Add("ARCHIVEOS_BACKEND_PUBLIC_URL is missing.")
}

if ($warnings.Count -eq 0) {
  Write-Host "OK: public/runtime sync checks passed."
  exit 0
}

Write-Host "Warnings:"
$warnings | ForEach-Object { Write-Host "- $_" }
exit 1
