param(
  [Parameter(Mandatory = $true)][uri]$BaseUrl,
  [string]$AdminPasswordEnvironmentVariable = "ARCHIVEOS_ADMIN_PASSWORD",
  [string]$ReadTokenEnvironmentVariable = "ARCHIVE_TOKEN_AUTHENTICATED_READ",
  [string]$CorrelationId = "CORR-a98d539e-8497-4d0a-9a41-49690c2bf0b0"
)

$ErrorActionPreference = "Stop"
$origin = $BaseUrl.AbsoluteUri.TrimEnd("/")
if ($BaseUrl.Scheme -ne "https") { throw "OCI verification requires HTTPS." }

function Request {
  param([string]$Path, [string]$Method = "GET", $Body, $Session, $Headers)
  $params = @{ Uri = "$origin$Path"; Method = $Method; UseBasicParsing = $true }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10); $params.ContentType = "application/json" }
  if ($Session) { $params.WebSession = $Session }
  if ($Headers) { $params.Headers = $Headers }
  Invoke-WebRequest @params
}

function ExpectStatus {
  param([string]$Path, [string]$Method, [int]$Expected, $Body, $Session, $Headers)
  try {
    $response = Request -Path $Path -Method $Method -Body $Body -Session $Session -Headers $Headers
    $actual = [int]$response.StatusCode
  } catch {
    $actual = [int]$_.Exception.Response.StatusCode
  }
  if ($actual -ne $Expected) { throw "$Method $Path expected $Expected but received $actual." }
  [pscustomobject]@{ Path = $Path; Status = $actual }
}

function Json {
  param([string]$Path, [string]$Method = "GET", $Body, $Session, $Headers)
  (Request -Path $Path -Method $Method -Body $Body -Session $Session -Headers $Headers).Content |
    ConvertFrom-Json
}

function Test-Sse {
  param([string]$Path, [hashtable]$Headers, $Session)
  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  try {
    foreach ($entry in $Headers.GetEnumerator()) {
      [void]$client.DefaultRequestHeaders.TryAddWithoutValidation($entry.Key, [string]$entry.Value)
    }
    if ($Session) {
      $cookies = $Session.Cookies.GetCookieHeader([uri]$origin)
      if ($cookies) { [void]$client.DefaultRequestHeaders.TryAddWithoutValidation("Cookie", $cookies) }
    }
    $client.DefaultRequestHeaders.Accept.ParseAdd("text/event-stream")
    $response = $client.GetAsync(
      "$origin$Path",
      [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead
    ).GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) {
      throw "SSE endpoint returned HTTP $([int]$response.StatusCode)."
    }
    if ($response.Content.Headers.ContentType.MediaType -ne "text/event-stream") {
      throw "SSE endpoint did not return text/event-stream."
    }
    $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $reader = [System.IO.StreamReader]::new($stream)
    $readTask = $reader.ReadLineAsync()
    if (-not $readTask.Wait(5000)) { throw "SSE stream did not produce an initial frame in time." }
    $line = $readTask.Result
    if ([string]::IsNullOrWhiteSpace($line)) { throw "SSE stream returned no initial frame." }
    return $true
  } finally {
    $client.Dispose()
  }
}

ExpectStatus -Path "/" -Method GET -Expected 200
$publicSession = Json -Path "/api/auth/session"
if ($publicSession.data.role -ne "PUBLIC") { throw "Public session contract failed." }
$health = Json -Path "/api/health"
if ($health.status -ne "ok") { throw "Backend health contract failed." }
[void](Json -Path "/api/platform/readiness")

$managed = (Json -Path "/api/managed-systems").data
if (@($managed).Count -ne 5) { throw "Managed Systems must contain exactly five systems." }
$ids = @($managed.systemId)
if ($ids -contains "archive-logitics" -or $ids -contains "archive-world" -or
    $ids -contains "atlas-platform" -or $ids -contains "deepstake") {
  throw "Managed Systems canonical identity contract failed."
}
foreach ($requiredSystem in @("archive-os", "archive-market", "archive-nexus", "archive-logistics", "archive-ledger")) {
  if ($ids -notcontains $requiredSystem) { throw "Managed Systems is missing $requiredSystem." }
}
[void](Json -Path "/api/managed-systems/overview")
[void](Json -Path "/api/managed-systems/archive-logistics")
[void](Json -Path "/api/managed-systems/archive-logistics/events")
[void](Json -Path "/api/managed-systems/archive-logistics/workflows")
[void](Json -Path "/api/managed-systems/archive-logistics/work-logs")

$inbox = @((Json -Path "/api/pm-inbox").data)
$probe = if ($inbox.Count) { $inbox[0].id } else { "missing-verification-item" }
ExpectStatus -Path "/api/pm-inbox/$probe/acknowledge" -Method POST -Expected 401

$password = [Environment]::GetEnvironmentVariable($AdminPasswordEnvironmentVariable)
if ([string]::IsNullOrWhiteSpace($password)) { throw "Admin credential environment variable is unavailable." }
$pm = New-Object Microsoft.PowerShell.Commands.WebRequestSession
ExpectStatus -Path "/api/auth/login" -Method POST -Expected 200 -Session $pm -Body @{ username = "admin"; password = $password; role = "PM" }
ExpectStatus -Path "/api/pm-inbox/$probe/acknowledge" -Method POST -Expected 403 -Session $pm

$admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
ExpectStatus -Path "/api/auth/login" -Method POST -Expected 200 -Session $admin -Body @{ username = "admin"; password = $password; role = "ADMIN" }
$password = $null

if ($inbox.Count) {
  ExpectStatus -Path "/api/pm-inbox/$probe/acknowledge" -Method POST -Expected 200 -Session $admin
  ExpectStatus -Path "/api/pm-inbox/$probe/acknowledge" -Method POST -Expected 200 -Session $admin
  ExpectStatus -Path "/api/pm-inbox/$probe/resolve" -Method POST -Expected 200 -Session $admin
  ExpectStatus -Path "/api/pm-inbox/$probe/resolve" -Method POST -Expected 200 -Session $admin
}

$runtime = (Json -Path "/api/ai/runtime" -Session $admin).data
$modelCheck = Json -Path "/api/ai/runtime/check" -Method POST -Session $admin
if (-not $runtime.vectorStore.databaseConnected -or -not $runtime.vectorStore.extensionInstalled -or -not $runtime.vectorStore.indexReady) {
  throw "pgvector readiness failed."
}
if ($runtime.embeddingModel.dimensions -ne 1536 -or -not $modelCheck.embedding.success -or -not $modelCheck.chat.success) {
  throw "OpenAI model smoke failed."
}
if (-not $runtime.chatModel.beanAvailable -or -not $runtime.embeddingModel.beanAvailable -or -not $runtime.rag.ready) {
  throw "AI runtime is not ready for real RAG."
}

$sync = (Json -Path "/api/obsidian/sync" -Method POST -Session $admin).data
$documents = @((Json -Path "/api/obsidian/documents?limit=100" -Session $admin).data)
if ($documents.Count -lt 1 -or $runtime.knowledge.failedEmbeddings -ne 0) {
  throw "Obsidian synchronization evidence failed."
}

$search = (Json -Path "/api/rag/search?query=ArchiveOS&limit=5" -Session $admin).data
if (@($search).Count -lt 1) { throw "RAG search returned no evidence." }
$firstSearch = @($search)[0]
if ($null -eq $firstSearch.score -or
    [string]::IsNullOrWhiteSpace([string]$firstSearch.title) -or
    [string]::IsNullOrWhiteSpace([string]$firstSearch.path)) {
  throw "RAG search result lacks evidence metadata."
}
$ask = (Json -Path "/api/rag/ask" -Method POST -Body @{
  question = "Summarize the ArchiveOS Spring AI RAG architecture."
} -Session $admin).data
if ([string]::IsNullOrWhiteSpace($ask.answer) -or @($ask.references).Count -lt 1) { throw "RAG answer evidence failed." }

$jobs = (Json -Path "/api/batch/jobs" -Session $admin).data
if (-not ($jobs | Where-Object name -eq "ragHealthCheckJob")) { throw "Required Spring Batch job is missing." }
$batchRun = (Json -Path "/api/batch/jobs/ragHealthCheckJob/run" -Method POST -Session $admin).data
if ($batchRun.status -notin @("COMPLETED", "STARTED", "STARTING")) { throw "Spring Batch launch failed." }
$batchExecutions = @((Json -Path "/api/batch/executions?limit=10" -Session $admin).data)
if (-not ($batchExecutions | Where-Object {
  $_.jobName -eq "ragHealthCheckJob" -and $_.status -eq "COMPLETED"
})) {
  throw "No successful ragHealthCheckJob execution was recorded."
}

$rpa = (Json -Path "/api/rpa/classify" -Method POST -Session $admin -Body @{
  title = "OCI full-stack canary classification"
  description = "Classify a canary validation record without executing a shell command."
  targetProject = "ArchiveOS"
  requestedBy = "verify-fullstack"
}).data
if (-not $rpa.data) { $rpaData = $rpa } else { $rpaData = $rpa.data }
if (-not $rpaData.task.approvalRequired -or
    $rpaData.safety -notmatch "classification_only|approval_required") {
  throw "RPA classification safety contract failed."
}
$rpaDecision = (Json -Path "/api/rpa/tasks/$($rpaData.task.id)/decision" -Method POST -Session $admin -Body @{
  action = "approve"
  reason = "Canary validation records the decision only; no shell execution is authorized."
  decidedBy = "verify-fullstack"
}).data
if ($rpaDecision.decision.action -ne "approve") { throw "RPA decision record failed." }

[void](Json -Path "/api/audit/logs?limit=20" -Session $admin)
[void](Json -Path "/api/knowledge/health" -Session $admin)
[void](Json -Path "/api/knowledge/overview" -Session $admin)
[void](Json -Path "/api/knowledge/recent?limit=10" -Session $admin)
[void](Json -Path "/api/runtime/timeline?limit=10" -Session $admin)
[void](Json -Path "/api/live-flow/summary")
[void](Json -Path "/api/live-flow/topology")
[void](Json -Path "/api/live-flow/events/recent?limit=10" -Session $admin)

$token = [Environment]::GetEnvironmentVariable($ReadTokenEnvironmentVariable)
if ([string]::IsNullOrWhiteSpace($token)) { throw "Read token environment variable is unavailable." }
$headers = @{
  Authorization = "Bearer $token"
  "X-Archive-Source-System" = "archive-os"
  "X-Archive-Service-Scope" = "authenticated:read"
}
$timeline = (Json -Path "/api/correlation-timeline/$CorrelationId" -Headers $headers).data
$liveCorrelation = (Json -Path "/api/live-flow/correlation/$CorrelationId" -Headers $headers).data
$ssePass = Test-Sse -Path "/api/live-flow/stream" -Headers @{} -Session $admin
$token = $null
if (@($timeline.events).Count -ne 35) { throw "Official correlation event count mismatch." }
if (@($liveCorrelation).Count -ne 35) { throw "Live Flow correlation event count mismatch." }
if (@($timeline.lineage.observedServices).Count -ne 4) { throw "Official correlation source count mismatch." }
if ($timeline.lineage.chainStatus -ne "COMPLETE_CHAIN") { throw "Official correlation is not COMPLETE_CHAIN." }
if (@($timeline.events | Where-Object causationStatus -eq "ROOT_EVENT").Count -ne 1) {
  throw "Official correlation ROOT_EVENT count mismatch."
}
if (@($timeline.events | Where-Object causationStatus -eq "EXTERNAL_PARENT_NOT_INGESTED").Count -ne 0) {
  throw "Official correlation has an external parent gap."
}
if (@($timeline.events | Where-Object causationStatus -eq "INVALID_CAUSATION").Count -ne 0) {
  throw "Official correlation has invalid causation."
}
$eventIds = @($timeline.events.eventId)
if (@($eventIds | Sort-Object -Unique).Count -ne $eventIds.Count) {
  throw "Official correlation contains duplicate event IDs."
}
if ($timeline.lineage.simulationRunIdDistinctCount -ne 1) {
  throw "Official correlation simulationRunId contract failed."
}

[pscustomobject]@{
  Status = "FULLSTACK_SMOKE_PASS"
  ManagedSystems = @($managed).Count
  PmInboxActionsExecuted = [bool]$inbox.Count
  DatabaseConnected = $runtime.vectorStore.databaseConnected
  VectorIndexReady = $runtime.vectorStore.indexReady
  EmbeddingDimensions = $runtime.embeddingModel.dimensions
  RagSearchCount = @($search).Count
  RagAnswerPresent = -not [string]::IsNullOrWhiteSpace($ask.answer)
  RagReferenceCount = @($ask.references).Count
  ObsidianDocuments = $documents.Count
  ObsidianSyncCompleted = ($null -ne $sync)
  BatchJobStatus = $batchRun.status
  RpaApprovalRequired = $rpaData.task.approvalRequired
  RpaDecisionRecorded = ($rpaDecision.decision.action -eq "approve")
  Sse = $ssePass
  CorrelationEvents = @($timeline.events).Count
  CorrelationSources = @($timeline.lineage.observedServices).Count
  CorrelationStatus = $timeline.lineage.chainStatus
}
