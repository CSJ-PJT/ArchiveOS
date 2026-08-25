param(
    [string]$AdditionalIpPath = '',
    [string[]]$AdditionalIps = @(),
    [string]$MonitorStart = '2026-08-26T00:00:00+09:00',
    [string]$StatePath = 'C:\ArchiveRecovery\disk-monitor\daily-digest\access-monitor-state.json'
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ArchiveAccessMonitor.psm1') -Force

if (Test-Path -LiteralPath $StatePath) {
    throw "Access monitor baseline already exists and will not be overwritten: $StatePath"
}

$container = @(& docker ps -a --filter 'name=archiveos-postgres' --format '{{.Names}}' 2>$null) | Select-Object -First 1
if (-not $container) { throw 'ArchiveOS PostgreSQL container was not found.' }
$environment = @(& docker inspect $container --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null)
function Get-ContainerValue([string]$Name) {
    $prefix = $Name + '='
    $row = $environment | Where-Object { $_ -is [string] -and $_.StartsWith($prefix) } | Select-Object -First 1
    if (-not $row) { return '' }
    return $row.Substring($prefix.Length)
}
$user = Get-ContainerValue 'POSTGRES_USER'
$database = Get-ContainerValue 'POSTGRES_DB'
if (-not $user -or -not $database) { throw 'ArchiveOS PostgreSQL identity is unavailable.' }
$sql = @"
select distinct ip from (
  select host(client_ip) as ip from public.archiveos_usage_logs where client_ip is not null
  union
  select nullif(metadata->>'clientIp','') as ip from public.audit_logs where metadata ? 'clientIp'
) observed where ip is not null order by ip;
"@
$knownIps = [Collections.Generic.List[string]]::new()
foreach ($row in @(& docker exec $container psql -X -U $user -d $database -At -c $sql 2>&1)) {
    $normalized = ConvertTo-ArchiveNormalizedIp ([string]$row)
    if ($normalized) { $knownIps.Add($normalized) }
}
if ($AdditionalIpPath) {
    if (-not (Test-Path -LiteralPath $AdditionalIpPath)) { throw "Additional IP source is missing: $AdditionalIpPath" }
    foreach ($row in Get-Content -LiteralPath $AdditionalIpPath -ErrorAction Stop) {
        $normalized = ConvertTo-ArchiveNormalizedIp ([string]$row)
        if ($normalized) { $knownIps.Add($normalized) }
    }
}
$AdditionalIps | ForEach-Object {
    $normalized = ConvertTo-ArchiveNormalizedIp ([string]$_)
    if ($normalized) { $knownIps.Add($normalized) }
}
$result = New-ArchiveAccessMonitorState -KnownIps @($knownIps | Sort-Object -Unique) -MonitorStart ([DateTimeOffset]::Parse($MonitorStart)) -Path $StatePath
Write-Output 'ACCESS_BASELINE_RESULT=PASS'
Write-Output ("BASELINE_IP_COUNT={0}" -f $result.knownIpCount)
Write-Output ("BASELINE_CAPTURED_AT={0}" -f $result.baselineCapturedAt)
Write-Output ("MONITOR_START={0}" -f $result.monitorStart)
Write-Output ("STATE_PATH={0}" -f $result.path)
Write-Output 'RAW_IP_OUTPUT=NO'
