$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'archive-daily-operations-digest.ps1'
$resultPath = Join-Path $env:TEMP ('archive-daily-digest-test-' + [guid]::NewGuid().ToString('N') + '.json')
try {
    & $script -NoSend -NoPersist -OutputPath $resultPath
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    if ($null -eq $result.snapshot) { throw 'snapshot is missing' }
    if ($result.message -notmatch 'Archive 일일 통합 운영 보고') { throw 'daily digest title is missing' }
    if ($result.message -notmatch '\[배치 · 자동화 24시간\]') { throw 'batch summary section is missing' }
    if ($result.message -notmatch '\[접속 보안\]') { throw 'access security section is missing' }
    if ($result.message -notmatch 'Slack에는 IP 원문을 전송하지 않습니다') { throw 'IP anonymization notice is missing' }
    if ($result.message -notmatch '\[스토리지 · Nexus\]') { throw 'storage and Nexus section is missing' }
    if ($result.slackSent -ne $false) { throw 'NoSend mode attempted Slack delivery' }
    Write-Output 'ARCHIVE_DAILY_DIGEST_TEST=PASS'
    Write-Output ("ARCHIVEOS_HEALTH={0}" -f $result.snapshot.archiveOsHealth)
    Write-Output ("SPRING_BATCH_24H={0}" -f $result.snapshot.batch.recentTotal)
    Write-Output ("BATCH_FAILED_24H={0}" -f ($result.snapshot.batch.failed + $result.snapshot.batch.legacyFailed))
    Write-Output ("NEXUS_LO_COUNT={0}" -f $result.snapshot.nexus.largeObjectCount)
} finally {
    Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
}
