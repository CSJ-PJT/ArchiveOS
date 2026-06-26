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

function Write-JsonSummary {
  param([Parameter(Mandatory = $true)]$Value)
  $Value | ConvertTo-Json -Depth 10 | Out-Host
}

function Wait-JsonEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      return Invoke-JsonRequest -Uri $Uri
    } catch {
      $lastError = $_.Exception.Message
      Start-Sleep -Seconds 3
    }
  }
  throw "Endpoint did not become ready within $TimeoutSeconds seconds: $Uri. Last error: $lastError"
}

Push-Location (Resolve-Path "$PSScriptRoot\..\..")
try {
  Assert-Command docker

  Write-Host "== Docker CLI =="
  docker --version
  docker compose version
  docker info | Out-Host

  Write-Host "== Compose config =="
  docker compose config *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose config failed."
  }
  Write-Host "docker compose config: ok"

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
  $health = Wait-JsonEndpoint -Uri "http://localhost:4100/api/health" -TimeoutSeconds 150
  Write-JsonSummary ([pscustomobject]@{
    status = $health.status
    module = $health.module
    database = $health.database
    openAiConfigured = $health.openAiConfigured
    obsidianVaultConfigured = $health.obsidianVaultConfigured
  })
  $runtimeBefore = Invoke-JsonRequest -Uri "http://localhost:4100/api/ai/runtime"
  Write-JsonSummary ([pscustomobject]@{
    status = $runtimeBefore.status
    springAi = $runtimeBefore.springAi.status
    chatModel = $runtimeBefore.chatModel.model
    embeddingModel = $runtimeBefore.embeddingModel.model
    embeddingDimensions = $runtimeBefore.embeddingModel.dimensions
    databaseConnected = $runtimeBefore.vectorStore.databaseConnected
    extensionInstalled = $runtimeBefore.vectorStore.extensionInstalled
    indexReady = $runtimeBefore.vectorStore.indexReady
    indexType = $runtimeBefore.vectorStore.indexType
    documents = $runtimeBefore.knowledge.documents
    chunks = $runtimeBefore.knowledge.chunks
    embeddedChunks = $runtimeBefore.knowledge.embeddedChunks
    ragReady = $runtimeBefore.rag.ready
  })

  Write-Host "== explicit model smoke check =="
  $check = Invoke-JsonRequest -Uri "http://localhost:4100/api/ai/runtime/check" -Method "POST"
  Write-JsonSummary ([pscustomobject]@{
    embeddingSuccess = $check.embedding.success
    embeddingDimensions = $check.embedding.dimensions
    chatSuccess = $check.chat.success
    runtimeStatus = $check.runtime.status
  })

  Write-Host "== Obsidian sync =="
  $sync = Invoke-JsonRequest -Uri "http://localhost:4100/api/obsidian/sync" -Method "POST"
  Write-JsonSummary $sync.data

  Write-Host "== RAG search =="
  $search = Invoke-JsonRequest -Uri "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
  $firstSearch = $search.data | Select-Object -First 1
  Write-JsonSummary ([pscustomobject]@{
    count = ($search.data | Measure-Object).Count
    firstTitle = $firstSearch.title
    firstPath = $firstSearch.path
    firstHeading = $firstSearch.heading
    firstScore = $firstSearch.score
  })

  Write-Host "== RAG ask =="
  $askBody = @{ question = "Summarize the ArchiveOS Spring AI RAG architecture." } | ConvertTo-Json
  $ask = Invoke-JsonRequest -Uri "http://localhost:4100/api/rag/ask" -Method "POST" -Body $askBody
  $firstReference = $ask.data.references | Select-Object -First 1
  Write-JsonSummary ([pscustomobject]@{
    hasAnswer = -not [string]::IsNullOrWhiteSpace($ask.data.answer)
    referenceCount = ($ask.data.references | Measure-Object).Count
    firstReferenceTitle = $firstReference.title
    firstReferencePath = $firstReference.path
    firstReferenceScore = $firstReference.score
  })

  Write-Host "== Spring Batch RPA classify =="
  $batchJobs = Invoke-JsonRequest -Uri "http://localhost:4100/api/batch/jobs"
  Write-JsonSummary ([pscustomobject]@{
    jobs = ($batchJobs.data | ForEach-Object { $_.name }) -join ", "
    launchable = ($batchJobs.data | Where-Object { $_.manualRunAllowed -eq $true }).Count
  })
  $batchRun = Invoke-JsonRequest -Uri "http://localhost:4100/api/batch/jobs/ragHealthCheckJob/run" -Method "POST"
  Write-JsonSummary ([pscustomobject]@{
    jobName = $batchRun.data.jobName
    status = $batchRun.data.status
    exitCode = $batchRun.data.exitCode
    executionId = $batchRun.data.id
  })
  $batchExecutions = Invoke-JsonRequest -Uri "http://localhost:4100/api/batch/executions?limit=5"
  Write-JsonSummary ([pscustomobject]@{
    recentExecutionCount = $batchExecutions.data.Count
    latestJob = ($batchExecutions.data | Select-Object -First 1).jobName
    latestStatus = ($batchExecutions.data | Select-Object -First 1).status
  })

  $rpaBody = @{
    title = "Verify RAG deployment"
    description = "Check pgvector schema and deployment risk before running any shell commands."
    targetProject = "ArchiveOS"
    requestedBy = "verify-rag-e2e"
  } | ConvertTo-Json
  $rpa = Invoke-JsonRequest -Uri "http://localhost:4100/api/rpa/classify" -Method "POST" -Body $rpaBody
  Write-JsonSummary ([pscustomobject]@{
    batchStatus = $rpa.data.batchStatus
    taskStatus = $rpa.data.task.status
    riskLevel = $rpa.data.task.riskLevel
    recommendation = $rpa.data.task.recommendation
    approvalRequired = $rpa.data.task.approvalRequired
    classificationSource = $rpa.data.task.classificationSource
    safety = $rpa.data.safety
  })
  $rpaDecisionBody = @{
    action = "approve"
    reason = "E2E smoke approved the classification record only. No execution was performed."
    decidedBy = "verify-rag-e2e"
  } | ConvertTo-Json
  $rpaDecision = Invoke-JsonRequest -Uri "http://localhost:4100/api/rpa/tasks/$($rpa.data.task.id)/decision" -Method "POST" -Body $rpaDecisionBody
  Write-JsonSummary ([pscustomobject]@{
    decisionAction = $rpaDecision.data.decision.action
    previousStatus = $rpaDecision.data.decision.previousStatus
    nextStatus = $rpaDecision.data.decision.nextStatus
    taskStatus = $rpaDecision.data.task.status
    safety = $rpaDecision.data.safety
  })

  Write-Host "== Node proxy =="
  $proxyRuntime = Invoke-JsonRequest -Uri "http://localhost:4000/api/ai/runtime"
  Write-JsonSummary ([pscustomobject]@{
    runtimeStatus = $proxyRuntime.data.status
    databaseConnected = $proxyRuntime.data.vectorStore.databaseConnected
    ragReady = $proxyRuntime.data.rag.ready
  })
  $proxyCheck = Invoke-JsonRequest -Uri "http://localhost:4000/api/ai/runtime/check" -Method "POST"
  Write-JsonSummary ([pscustomobject]@{
    embeddingSuccess = $proxyCheck.data.embedding.success
    chatSuccess = $proxyCheck.data.chat.success
    runtimeStatus = $proxyCheck.data.runtime.status
  })
  $proxyBatchJobs = Invoke-JsonRequest -Uri "http://localhost:4000/api/batch/jobs"
  Write-JsonSummary ([pscustomobject]@{
    proxyBatchJobCount = $proxyBatchJobs.data.Count
    includesRagHealthCheck = [bool]($proxyBatchJobs.data | Where-Object { $_.name -eq "ragHealthCheckJob" })
  })
  $proxyRpa = Invoke-JsonRequest -Uri "http://localhost:4000/api/rpa/classify" -Method "POST" -Body $rpaBody
  Write-JsonSummary ([pscustomobject]@{
    batchStatus = $proxyRpa.data.batchStatus
    taskStatus = $proxyRpa.data.task.status
    riskLevel = $proxyRpa.data.task.riskLevel
    approvalRequired = $proxyRpa.data.task.approvalRequired
  })
  $proxyRpaDecision = Invoke-JsonRequest -Uri "http://localhost:4000/api/rpa/tasks/$($proxyRpa.data.task.id)/decision" -Method "POST" -Body $rpaDecisionBody
  Write-JsonSummary ([pscustomobject]@{
    decisionAction = $proxyRpaDecision.data.decision.action
    nextStatus = $proxyRpaDecision.data.decision.nextStatus
    taskStatus = $proxyRpaDecision.data.task.status
  })

  Write-Host "== Runtime after RAG calls =="
  $runtimeAfter = Invoke-JsonRequest -Uri "http://localhost:4100/api/ai/runtime"
  Write-JsonSummary ([pscustomobject]@{
    status = $runtimeAfter.status
    documents = $runtimeAfter.knowledge.documents
    chunks = $runtimeAfter.knowledge.chunks
    embeddedChunks = $runtimeAfter.knowledge.embeddedChunks
    ragReady = $runtimeAfter.rag.ready
    lastLatencyMs = $runtimeAfter.rag.lastLatencyMs
    lastReferenceCount = $runtimeAfter.rag.lastReferenceCount
    lastSearchResultCount = $runtimeAfter.rag.lastSearchResultCount
  })

  if (-not $KeepRunning) {
    Write-Host "== Compose down =="
    docker compose down
  }
} finally {
  Pop-Location
}
