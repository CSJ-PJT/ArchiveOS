$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$backendRoot = Join-Path $repoRoot "backend"

Push-Location $backendRoot
try {
  npm run batch:supabase-keepalive
} finally {
  Pop-Location
}
