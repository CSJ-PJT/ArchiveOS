param(
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

function Show-Value {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return "(missing)"
  }
  return $Value
}

$frontendBackendUrl = Read-EnvValue -Path $FrontendEnvPath -Name "VITE_BACKEND_URL"
$frontendPublicUrl = Read-EnvValue -Path $FrontendEnvPath -Name "VITE_REMOTE_FRONTEND_URL"
$frontendRemoteBackendUrl = Read-EnvValue -Path $FrontendEnvPath -Name "VITE_REMOTE_BACKEND_URL"
$backendPublicUrl = Read-EnvValue -Path $BackendEnvPath -Name "ARCHIVEOS_PUBLIC_URL"
$backendPublicBackendUrl = Read-EnvValue -Path $BackendEnvPath -Name "ARCHIVEOS_BACKEND_PUBLIC_URL"
$corsOrigins = Read-EnvValue -Path $BackendEnvPath -Name "CORS_ALLOWED_ORIGINS"

$rows = @(
  [pscustomobject]@{ Setting = "VITE_BACKEND_URL"; Value = Show-Value $frontendBackendUrl },
  [pscustomobject]@{ Setting = "VITE_REMOTE_FRONTEND_URL"; Value = Show-Value $frontendPublicUrl },
  [pscustomobject]@{ Setting = "VITE_REMOTE_BACKEND_URL"; Value = Show-Value $frontendRemoteBackendUrl },
  [pscustomobject]@{ Setting = "ARCHIVEOS_PUBLIC_URL"; Value = Show-Value $backendPublicUrl },
  [pscustomobject]@{ Setting = "ARCHIVEOS_BACKEND_PUBLIC_URL"; Value = Show-Value $backendPublicBackendUrl },
  [pscustomobject]@{ Setting = "CORS_ALLOWED_ORIGINS"; Value = Show-Value $corsOrigins }
)

Write-Host "ArchiveOS ngrok/runtime sync check"
Write-Host "No processes are started or stopped by this script."
Write-Host ""
$rows | Format-Table -AutoSize

$warnings = New-Object System.Collections.Generic.List[string]

if ($frontendBackendUrl -match "^(http://)?(localhost|127\.0\.0\.1)(:\d+)?") {
  $warnings.Add("VITE_BACKEND_URL points to localhost. Mobile/ngrok frontend cannot call that backend directly.")
}

if (-not $backendPublicUrl) {
  $warnings.Add("ARCHIVEOS_PUBLIC_URL is missing. Daily reports and Settings cannot show the current frontend public URL.")
}

if (-not $backendPublicBackendUrl) {
  $warnings.Add("ARCHIVEOS_BACKEND_PUBLIC_URL is missing. Settings cannot confirm the backend public URL from backend env.")
}

if ($frontendPublicUrl -and $corsOrigins -and $corsOrigins -notlike "*$frontendPublicUrl*") {
  $warnings.Add("CORS_ALLOWED_ORIGINS does not include VITE_REMOTE_FRONTEND_URL.")
}

if ($warnings.Count -eq 0) {
  Write-Host ""
  Write-Host "OK: no obvious ngrok sync warnings detected."
  exit 0
}

Write-Host ""
Write-Host "Warnings:"
$warnings | ForEach-Object { Write-Host "- $_" }
exit 1
