$ErrorActionPreference = 'Stop'
$module = Join-Path $PSScriptRoot 'ArchiveAccessMonitor.psm1'
Import-Module $module -Force
$statePath = Join-Path $env:TEMP ('archive-access-monitor-test-' + [guid]::NewGuid().ToString('N') + '.json')
try {
    $start = [DateTimeOffset]::Parse('2026-08-26T00:00:00+09:00')
    New-ArchiveAccessMonitorState -KnownIps @('1.1.1.1', '10.0.0.1') -MonitorStart $start -Path $statePath | Out-Null
    $events = @(
        [pscustomobject]@{ Ip = '1.1.1.1'; OccurredAt = $start.AddHours(1) },
        [pscustomobject]@{ Ip = '8.8.8.8'; Count = 2; FirstSeen = $start.AddHours(2); LastSeen = $start.AddHours(3) },
        [pscustomobject]@{ Ip = '192.168.1.20'; OccurredAt = $start.AddHours(4) }
    )
    $summary = Get-ArchiveAccessSummary -Events $events -PeriodStart $start -PeriodEnd $start.AddDays(1) -StatePath $statePath
    if ($summary.newExternalIpCount -ne 1) { throw 'new external IP count contract failed' }
    if ($summary.newExternalAccessCount -ne 2) { throw 'new external access count contract failed' }
    if ($summary.baselineAccessCount -ne 1) { throw 'baseline access exclusion contract failed' }
    if ($summary.ignoredNonPublicCount -ne 1) { throw 'non-public IP exclusion contract failed' }
    $serialized = $summary | ConvertTo-Json -Depth 8
    if ($serialized -match '8\.8\.8\.8|1\.1\.1\.1|192\.168\.1\.20') { throw 'raw IP leaked into summary' }
    $state = Get-Content -LiteralPath $statePath -Raw
    if ($state -match '8\.8\.8\.8|1\.1\.1\.1|10\.0\.0\.1') { throw 'raw IP leaked into monitor state' }
    Write-Output 'ARCHIVE_ACCESS_MONITOR_TEST=PASS'
} finally {
    if ([System.IO.File]::Exists($statePath)) { [System.IO.File]::Delete($statePath) }
}
