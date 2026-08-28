[CmdletBinding()]
param(
    [string]$AtlasHost = '161.33.17.84',
    [string]$AtlasUser = 'opc',
    [string]$SshKeyPath = 'C:\Users\dan18\OCI_SSH_tmp.key',
    [string]$BackendUrl = 'http://127.0.0.1:4100',
    [string]$ArchiveOsAiContainer = 'archiveos-archiveos-ai-1'
)

$ErrorActionPreference = 'Stop'
$allowedKeys = @(
    'schemaVersion', 'targetDate', 'baselineCutoff', 'monitoredRequests',
    'monitoredUniqueIdentities', 'statusCounts', 'serviceCounts', 'delivered',
    'generatedAt', 'deliveredAt'
)
$allowedServices = @(
    'Atlas Home/Other', 'Learn Atlas', 'Sketchfy Atlas', 'Incruit Atlas',
    'Health Atlas', 'Travel Atlas', 'World Atlas', 'Archive'
)

if (-not (Test-Path -LiteralPath $SshKeyPath)) {
    throw "Atlas SSH key was not found."
}

$remoteCommand = "latest=`$(sudo find /var/lib/atlas-access-monitor/reports -maxdepth 1 -type f -name '*.json' | sort | tail -1); test -n `"`$latest`"; sudo cat `"`$latest`""
$rawLines = & ssh.exe -i $SshKeyPath -o BatchMode=yes -o ConnectTimeout=15 "$AtlasUser@$AtlasHost" $remoteCommand
if ($LASTEXITCODE -ne 0) { throw "Atlas report retrieval failed." }
$raw = $rawLines -join "`n"

if ($raw -match '(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)' -or $raw -match '(?i)\b[0-9a-f]{64}\b') {
    throw "Atlas report contains prohibited identity detail."
}
$report = $raw | ConvertFrom-Json
$reportKeys = @($report.PSObject.Properties.Name)
$unexpected = @($reportKeys | Where-Object { $_ -notin $allowedKeys })
if ($unexpected.Count -gt 0) { throw "Atlas report contains unsupported fields." }
if (@($report.statusCounts.PSObject.Properties.Name | Where-Object { $_ -notin @('2xx', '3xx', '4xx', '5xx') }).Count -gt 0) {
    throw "Atlas report contains unsupported status fields."
}
if (@($report.serviceCounts.PSObject.Properties.Name | Where-Object { $_ -notin $allowedServices }).Count -gt 0) {
    throw "Atlas report contains an unregistered project."
}

$containerId = (& docker.exe ps -q --filter "name=$ArchiveOsAiContainer" | Select-Object -First 1)
if (-not $containerId) { throw "ArchiveOS AI container is not running." }
$environment = & docker.exe inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $containerId
if ($LASTEXITCODE -ne 0) { throw "ArchiveOS AI environment could not be inspected." }
$tokenLine = $environment | Where-Object { $_ -like 'ARCHIVE_TOKEN_ADMIN_OPERATOR=*' } | Select-Object -First 1
$token = if ($tokenLine) { $tokenLine.Substring('ARCHIVE_TOKEN_ADMIN_OPERATOR='.Length) } else { '' }
if ([string]::IsNullOrWhiteSpace($token)) { throw "ArchiveOS internal admin token is unavailable." }

$headers = @{
    Authorization = "Bearer $token"
    'X-Archive-Source-System' = 'archive-os'
    'X-Archive-Service-Scope' = 'admin:operate'
}
$response = Invoke-RestMethod -Method Post -Uri "$($BackendUrl.TrimEnd('/'))/api/audit/usage/atlas-report" `
    -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $raw -TimeoutSec 30
if (-not $response.data.imported) { throw "ArchiveOS rejected the Atlas report." }

[pscustomobject]@{
    Result = 'PASS'
    TargetDate = $response.data.targetDate
    ProjectCount = $response.data.projectCount
    Privacy = 'AGGREGATE_ONLY'
}
