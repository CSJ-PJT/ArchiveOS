param(
    [switch]$NoSend,
    [switch]$NoPersist,
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$root = 'C:\ArchiveRecovery\disk-monitor\daily-digest'
$history = Join-Path $root 'history'
$latest = Join-Path $root 'latest.json'
$log = Join-Path $root 'monitor.log'
$archiveOsBaseUrl = 'http://localhost:4000'
$publicUrl = 'https://161.33.45.1/archiveos/'

function Invoke-SafeApi([string]$Path) {
    try {
        return Invoke-RestMethod -Uri ($archiveOsBaseUrl + $Path) -TimeoutSec 15
    } catch {
        return $null
    }
}

function Get-FileBytes([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return [int64]0 }
    return [int64]$item.Length
}

function Get-ContainerEnvironment([string]$ContainerName) {
    if (-not $ContainerName) { return @() }
    try {
        return @(& docker inspect $ContainerName --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null)
    } catch {
        return @()
    }
}

function Get-EnvironmentValue([object[]]$Rows, [string]$Name) {
    $prefix = $Name + '='
    $row = $Rows | Where-Object { $_ -is [string] -and $_.StartsWith($prefix) } | Select-Object -First 1
    if (-not $row) { return '' }
    return $row.Substring($prefix.Length)
}

function Get-SlackConfiguration {
    $token = [Environment]::GetEnvironmentVariable('SLACK_BOT_TOKEN')
    $channel = [Environment]::GetEnvironmentVariable('SLACK_CHANNEL')
    $webhook = [Environment]::GetEnvironmentVariable('SLACK_WEBHOOK_URL')

    $aiContainer = @(& docker ps -a --filter 'name=archiveos-ai' --format '{{.Names}}' 2>$null) | Select-Object -First 1
    $containerEnv = Get-ContainerEnvironment $aiContainer
    if (-not $token) { $token = Get-EnvironmentValue $containerEnv 'SLACK_BOT_TOKEN' }
    if (-not $channel) { $channel = Get-EnvironmentValue $containerEnv 'SLACK_CHANNEL' }
    if (-not $webhook) { $webhook = Get-EnvironmentValue $containerEnv 'SLACK_WEBHOOK_URL' }

    if (-not $token) {
        $taskRoots = @(
            (Join-Path $env:USERPROFILE 'Desktop\Task'),
            (Join-Path $env:USERPROFILE 'OneDrive\Desktop\Task'),
            (Join-Path $env:USERPROFILE 'OneDrive\바탕 화면\Task')
        )
        foreach ($taskRoot in $taskRoots) {
            if (-not (Test-Path -LiteralPath $taskRoot)) { continue }
            $info = Get-ChildItem -LiteralPath $taskRoot -Filter '*Slack*.txt' -File -Recurse -Force -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -eq $info) { continue }
            $line = Get-Content -LiteralPath $info.FullName -ErrorAction SilentlyContinue | Where-Object { $_ -match 'xoxb-' } | Select-Object -First 1
            if ($line -match '(xoxb-[A-Za-z0-9-]+)') { $token = $Matches[1] }
            if ($token) { break }
        }
    }

    return [ordered]@{ token = $token; channel = $channel; webhook = $webhook }
}

function Get-NexusMetrics {
    try {
        $container = 'archive-nexus-postgres'
        $envRows = Get-ContainerEnvironment $container
        $user = Get-EnvironmentValue $envRows 'POSTGRES_USER'
        $database = Get-EnvironmentValue $envRows 'POSTGRES_DB'
        if (-not $user) { $user = 'postgres' }
        if (-not $database) { $database = 'postgres' }
        $sql = "select pg_database_size(current_database())::bigint, pg_total_relation_size('pg_catalog.pg_largeobject')::bigint, (select count(*)::bigint from pg_catalog.pg_largeobject_metadata), coalesce((select sum(size)::bigint from pg_ls_waldir()),0)::bigint;"
        $rows = @(& docker exec $container psql -U $user -d $database -At -F '|' -c $sql 2>&1)
        $line = $rows | Where-Object { $_ -match '^\d+\|\d+\|\d+\|\d+$' } | Select-Object -First 1
        if (-not $line) { throw 'Nexus read-only metrics query failed.' }
        $values = $line -split '\|'
        return [ordered]@{
            available = $true
            databaseBytes = [int64]$values[0]
            largeObjectBytes = [int64]$values[1]
            largeObjectCount = [int64]$values[2]
            walBytes = [int64]$values[3]
        }
    } catch {
        return [ordered]@{ available = $false; reason = $_.Exception.Message }
    }
}

function Get-DockerSummary {
    try {
        $runtimeNames = @(
            'archiveos-frontend-1',
            'archiveos-backend-1',
            'archiveos-archiveos-ai-1',
            'archive-market',
            'archive-nexus-backend',
            'archive-logitics',
            'archive-ledger'
        )
        $items = @()
        $restartTotal = 0
        foreach ($name in $runtimeNames) {
            $state = 'missing'
            $restart = 0
            try {
                $row = [string](& docker inspect $name --format '{{.State.Status}}|{{.RestartCount}}' 2>$null)
                if ($row -match '^([^|]+)\|(\d+)$') {
                    $state = $Matches[1]
                    $restart = [int]$Matches[2]
                }
            } catch {}
            $restartTotal += $restart
            $items += [ordered]@{ name = $name; status = $state; running = $state -eq 'running'; restartCount = $restart }
        }
        return [ordered]@{
            available = $true
            total = $items.Count
            running = @($items | Where-Object { $_.running }).Count
            restartTotal = $restartTotal
            items = $items
        }
    } catch {
        return [ordered]@{ available = $false; total = 0; running = 0; restartTotal = 0; items = @(); reason = $_.Exception.Message }
    }
}

function Get-BatchSummary([datetime]$Cutoff) {
    $executionsResponse = Invoke-SafeApi '/api/batch/executions?limit=200'
    $jobsResponse = Invoke-SafeApi '/api/batch/jobs'
    $legacyResponse = Invoke-SafeApi '/api/batches/recent?limit=100'
    $executions = @()
    if ($null -ne $executionsResponse -and $null -ne $executionsResponse.data) { $executions = @($executionsResponse.data) }
    $recent = @($executions | Where-Object {
        try { [datetime]$_.createTime -ge $Cutoff } catch { $false }
    })
    $legacy = @()
    if ($null -ne $legacyResponse -and $null -ne $legacyResponse.data) {
        $legacy = @($legacyResponse.data | Where-Object {
            try { [datetime]$_.created_at -ge $Cutoff.ToUniversalTime() } catch { $false }
        })
    }
    $jobs = @()
    if ($null -ne $jobsResponse -and $null -ne $jobsResponse.data) {
        foreach ($job in @($jobsResponse.data)) {
            $last = @($job.recentExecutions) | Select-Object -First 1
            $jobs += [ordered]@{
                name = [string]$job.name
                status = if ($null -eq $last) { 'NO_HISTORY' } else { [string]$last.status }
                lastRun = if ($null -eq $last) { $null } else { [string]$last.createTime }
            }
        }
    }
    return [ordered]@{
        available = ($null -ne $executionsResponse)
        recentTotal = $recent.Count
        completed = @($recent | Where-Object { $_.status -eq 'COMPLETED' }).Count
        failed = @($recent | Where-Object { $_.status -in @('FAILED','ABANDONED','STOPPED','UNKNOWN') }).Count
        running = @($recent | Where-Object { $_.running -eq $true -or $_.status -in @('STARTING','STARTED','STOPPING') }).Count
        legacyTotal = $legacy.Count
        legacyFailed = @($legacy | Where-Object { $_.status -eq 'failed' }).Count
        jobs = $jobs
        failures = @($recent | Where-Object { $_.status -in @('FAILED','ABANDONED','STOPPED','UNKNOWN') } | ForEach-Object {
            [ordered]@{ name = [string]$_.jobName; status = [string]$_.status; at = [string]$_.createTime }
        })
        latestExecutions = @($executions | Select-Object -First 5 | ForEach-Object {
            [ordered]@{ name = [string]$_.jobName; status = [string]$_.status; at = [string]$_.createTime }
        })
    }
}

function Add-Warning([System.Collections.Generic.List[string]]$Warnings, [bool]$Condition, [string]$Message) {
    if ($Condition) { $Warnings.Add($Message) }
}

function Format-Gb([int64]$Bytes) { return ('{0:N2}GB' -f ($Bytes / 1GB)) }
function Format-DeltaGb([int64]$Bytes) { return ('{0:+0.00;-0.00;0.00}GB' -f ($Bytes / 1GB)) }

$now = Get-Date
$cutoff = $now.AddDays(-1)
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$health = Invoke-SafeApi '/api/health'
$endpointHealth = Invoke-SafeApi '/api/health/endpoints'
$nexus = Get-NexusMetrics
$docker = Get-DockerSummary
$batch = Get-BatchSummary $cutoff
$snapshot = [ordered]@{
    capturedAt = $now.ToString('o')
    periodStart = $cutoff.ToString('o')
    cFreeBytes = [int64]$disk.FreeSpace
    dockerVhdxBytes = Get-FileBytes 'C:\Users\dan18\AppData\Local\Docker\wsl\disk\docker_data.vhdx'
    archiveOsHealth = if ($null -eq $health) { 'UNAVAILABLE' } else { [string]$health.status }
    endpointHealth = if ($null -eq $endpointHealth) { $null } else { $endpointHealth.summary }
    docker = $docker
    batch = $batch
    nexus = $nexus
}

$previous = $null
if (Test-Path -LiteralPath $latest) {
    try { $previous = Get-Content -LiteralPath $latest -Raw | ConvertFrom-Json } catch {}
}
$cDelta = if ($null -eq $previous) { [int64]0 } else { [int64]$snapshot.cFreeBytes - [int64]$previous.cFreeBytes }
$vhdxDelta = if ($null -eq $previous) { [int64]0 } else { [int64]$snapshot.dockerVhdxBytes - [int64]$previous.dockerVhdxBytes }

$warnings = [System.Collections.Generic.List[string]]::new()
Add-Warning $warnings ($snapshot.archiveOsHealth -notin @('ok','UP')) ('ArchiveOS health=' + $snapshot.archiveOsHealth)
Add-Warning $warnings ($docker.available -and $docker.running -lt $docker.total) ("Docker 실행 {0}/{1}" -f $docker.running, $docker.total)
Add-Warning $warnings ($batch.failed -gt 0) ("최근 24시간 Spring Batch 실패 {0}건" -f $batch.failed)
Add-Warning $warnings ($batch.legacyFailed -gt 0) ("최근 24시간 운영 배치 실패 {0}건" -f $batch.legacyFailed)
Add-Warning $warnings ($nexus.available -and $nexus.largeObjectCount -gt 0) ("Nexus Large Object 재생성 {0}건" -f $nexus.largeObjectCount)
Add-Warning $warnings ($snapshot.cFreeBytes -lt 50GB) ("C: 여유 공간 임계치 미만: {0}" -f (Format-Gb $snapshot.cFreeBytes))

$endpointText = '수집 불가'
if ($null -ne $snapshot.endpointHealth) {
    $endpointText = "{0}/{1} 정상, 실패 {2}, 누락 {3}" -f $snapshot.endpointHealth.online, $snapshot.endpointHealth.total, $snapshot.endpointHealth.failed, $snapshot.endpointHealth.missing
}
$jobText = if ($batch.jobs.Count -eq 0) { '수집 불가' } else { ($batch.jobs | ForEach-Object { "$($_.name)=$($_.status)" }) -join ', ' }
$latestBatchText = if ($batch.latestExecutions.Count -eq 0) { '실행 이력 없음' } else { ($batch.latestExecutions | ForEach-Object { "• $($_.name): $($_.status) ($($_.at))" }) -join "`n" }
$failedBatchText = if ($batch.failures.Count -eq 0) { '• 실패 작업 없음' } else { ($batch.failures | ForEach-Object { "• 실패: $($_.name) / $($_.status) ($($_.at))" }) -join "`n" }
$nexusText = if (-not $nexus.available) {
    '수집 불가'
} else {
    "DB $(Format-Gb $nexus.databaseBytes) | LO $(Format-Gb $nexus.largeObjectBytes) / $($nexus.largeObjectCount)건 | WAL $(Format-Gb $nexus.walBytes)"
}
$warningText = if ($warnings.Count -eq 0) { '• 감지된 경고 없음' } else { ($warnings | ForEach-Object { "• $_" }) -join "`n" }

$message = @"
📊 Archive 일일 통합 운영 보고
기준: $($cutoff.ToString('yyyy-MM-dd HH:mm')) ~ $($now.ToString('yyyy-MM-dd HH:mm')) KST

[서비스]
• ArchiveOS: $($snapshot.archiveOsHealth)
• API: $endpointText
• Docker: $($docker.running)/$($docker.total) 실행, 누적 재시작 $($docker.restartTotal)

[배치 · 자동화 24시간]
• Spring Batch: 전체 $($batch.recentTotal), 성공 $($batch.completed), 실패 $($batch.failed), 실행 중 $($batch.running)
• 운영 배치: 전체 $($batch.legacyTotal), 실패 $($batch.legacyFailed)
• 작업별 최신 상태: $jobText
$failedBatchText
$latestBatchText

[스토리지 · Nexus]
• C: 여유 $(Format-Gb $snapshot.cFreeBytes) / 전일 대비 $(Format-DeltaGb $cDelta)
• Docker VHDX: $(Format-Gb $snapshot.dockerVhdxBytes) / 전일 대비 $(Format-DeltaGb $vhdxDelta)
• Nexus: $nexusText

[주의]
$warningText

대시보드: $publicUrl
"@.Trim()

$report = [ordered]@{ snapshot = $snapshot; warnings = $warnings; message = $message; slackSent = $false }
if (-not $NoSend) {
    $slack = Get-SlackConfiguration
    try {
        if ($slack.token -and $slack.channel) {
            $body = @{ channel = $slack.channel; text = $message } | ConvertTo-Json -Compress
            $response = Invoke-RestMethod -Uri 'https://slack.com/api/chat.postMessage' -Method Post -Headers @{ Authorization = "Bearer $($slack.token)" } -ContentType 'application/json; charset=utf-8' -Body $body
            if (-not $response.ok) { throw ('Slack API error: ' + $response.error) }
            $report.slackSent = $true
        } elseif ($slack.webhook) {
            $body = @{ text = $message } | ConvertTo-Json -Compress
            Invoke-RestMethod -Uri $slack.webhook -Method Post -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null
            $report.slackSent = $true
        } else {
            throw 'Slack credentials are not configured.'
        }
    } catch {
        $report.slackError = $_.Exception.Message
    }
}

if (-not $NoPersist) {
    New-Item -ItemType Directory -Force -Path $history | Out-Null
    $reportPath = Join-Path $history ('daily-' + $now.ToString('yyyyMMdd-HHmmss') + '.json')
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $latest -Encoding UTF8
    Add-Content -LiteralPath $log -Value ("{0} slack={1} warnings={2}" -f $now.ToString('o'), $report.slackSent, $warnings.Count)
}

$json = $report | ConvertTo-Json -Depth 8
if ($OutputPath) {
    $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
} else {
    $json
}
