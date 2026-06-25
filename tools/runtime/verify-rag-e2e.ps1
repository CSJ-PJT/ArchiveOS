param(
  [switch]$SkipComposeUp,
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [string]$Method = "GET",
    [string]$Body
  )

  $parameters = @{
    Uri = $Uri
    Method = $Method
    Headers = @{ "Content-Type" = "application/json" }
  }
  if ($Body) {
    $parameters.Body = $Body
  }
  Invoke-RestMethod @parameters
}

function Assert-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not available on PATH. Install Docker Desktop or add Docker CLI to PATH first."
  }
}

Push-Location (Resolve-Path "$PSScriptRoot\..\..")
try {
  Assert-Command docker

  Write-Host "== Docker CLI =="
  docker --version
  docker compose version
  docker info | Out-Host

  Write-Host "== Compose config =="
  docker compose config | Out-Host

  if (-not $SkipComposeUp) {
    Write-Host "== Compose up =="
    docker compose up --build -d
  }

  Write-Host "== Compose ps =="
  docker compose ps | Out-Host

  Write-Host "== pgvector diagnostics =="
  docker compose exec -T postgres psql -U archiveos -d archiveos -c "create extension if not exists vector;"
  docker compose exec -T postgres psql -U archiveos -d archiveos -c "select extname, extversion from pg_extension where extname = 'vector';"
  docker compose exec -T postgres psql -U archiveos -d archiveos -c "select to_regclass('public.obsidian_documents') as obsidian_documents, to_regclass('public.obsidian_chunks') as obsidian_chunks;"

  Write-Host "== archiveos-ai runtime =="
  Invoke-JsonRequest -Uri "http://localhost:4100/api/health" | ConvertTo-Json -Depth 20 | Out-Host
  $runtimeBefore = Invoke-JsonRequest -Uri "http://localhost:4100/api/ai/runtime"
  $runtimeBefore | ConvertTo-Json -Depth 20 | Out-Host

  Write-Host "== explicit model smoke check =="
  Invoke-JsonRequest -Uri "http://localhost:4100/api/ai/runtime/check" -Method "POST" | ConvertTo-Json -Depth 20 | Out-Host

  Write-Host "== Obsidian sync =="
  Invoke-JsonRequest -Uri "http://localhost:4100/api/obsidian/sync" -Method "POST" | ConvertTo-Json -Depth 20 | Out-Host

  Write-Host "== RAG search =="
  Invoke-JsonRequest -Uri "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5" | ConvertTo-Json -Depth 20 | Out-Host

  Write-Host "== RAG ask =="
  $askBody = @{ question = "ArchiveOS의 Spring AI RAG 구조를 요약해줘" } | ConvertTo-Json
  Invoke-JsonRequest -Uri "http://localhost:4100/api/rag/ask" -Method "POST" -Body $askBody | ConvertTo-Json -Depth 20 | Out-Host

  Write-Host "== Node proxy =="
  Invoke-JsonRequest -Uri "http://localhost:4000/api/ai/runtime" | ConvertTo-Json -Depth 20 | Out-Host
  Invoke-JsonRequest -Uri "http://localhost:4000/api/ai/runtime/check" -Method "POST" | ConvertTo-Json -Depth 20 | Out-Host

  Write-Host "== Runtime after RAG calls =="
  Invoke-JsonRequest -Uri "http://localhost:4100/api/ai/runtime" | ConvertTo-Json -Depth 20 | Out-Host

  if (-not $KeepRunning) {
    Write-Host "== Compose down =="
    docker compose down
  }
} finally {
  Pop-Location
}
