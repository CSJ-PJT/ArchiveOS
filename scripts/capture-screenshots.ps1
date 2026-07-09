param(
  [string]$BaseUrl = "http://localhost:5173",
  [string]$PuppeteerNodePath = $env:PUPPETEER_NODE_PATH
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $PuppeteerNodePath) {
  $localNodeModules = Join-Path $repoRoot "node_modules"
  if (Test-Path (Join-Path $localNodeModules "puppeteer")) {
    $PuppeteerNodePath = $localNodeModules
  }
}

if (-not $PuppeteerNodePath) {
  Write-Error "PUPPETEER_NODE_PATH is required when puppeteer is not installed in this repository. Example: `$env:PUPPETEER_NODE_PATH='D:\ArchiveTools\mermaid-cli\node_modules'"
}

$env:ARCHIVEOS_SCREENSHOT_BASE_URL = $BaseUrl
$env:PUPPETEER_NODE_PATH = $PuppeteerNodePath
node (Join-Path $PSScriptRoot "capture-screenshots.js")

