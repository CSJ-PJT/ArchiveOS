Set-StrictMode -Version Latest

function ConvertTo-ArchiveNormalizedIp {
    param([Parameter(Mandatory = $true)][string]$Ip)

    $address = $null
    if (-not [System.Net.IPAddress]::TryParse($Ip.Trim(), [ref]$address)) { return $null }
    if ($address.IsIPv4MappedToIPv6) { $address = $address.MapToIPv4() }
    return $address.ToString().ToLowerInvariant()
}

function Test-ArchivePublicIp {
    param([Parameter(Mandatory = $true)][string]$Ip)

    $normalized = ConvertTo-ArchiveNormalizedIp $Ip
    if (-not $normalized) { return $false }
    $address = [System.Net.IPAddress]::Parse($normalized)
    if ($address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
        $bytes = $address.GetAddressBytes()
        if ($bytes[0] -in @(0, 10, 127)) { return $false }
        if ($bytes[0] -ge 224) { return $false }
        if ($bytes[0] -eq 100 -and $bytes[1] -ge 64 -and $bytes[1] -le 127) { return $false }
        if ($bytes[0] -eq 169 -and $bytes[1] -eq 254) { return $false }
        if ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) { return $false }
        if ($bytes[0] -eq 192 -and $bytes[1] -eq 168) { return $false }
        if ($bytes[0] -eq 198 -and $bytes[1] -in @(18, 19)) { return $false }
        return $true
    }

    if ($address.Equals([System.Net.IPAddress]::IPv6None) -or
        $address.Equals([System.Net.IPAddress]::IPv6Any) -or
        $address.Equals([System.Net.IPAddress]::IPv6Loopback) -or
        $address.IsIPv6LinkLocal -or
        $address.IsIPv6Multicast -or
        $address.IsIPv6SiteLocal) { return $false }
    $bytes = $address.GetAddressBytes()
    if (($bytes[0] -band 0xFE) -eq 0xFC) { return $false }
    return $true
}

function ConvertTo-ArchivePlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecureString)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Get-ArchiveAccessKeyBytes {
    param([Parameter(Mandatory = $true)][string]$ProtectedKey)

    $secure = ConvertTo-SecureString -String $ProtectedKey
    $plain = ConvertTo-ArchivePlainText $secure
    return [Convert]::FromBase64String($plain)
}

function Get-ArchiveAccessFingerprint {
    param(
        [Parameter(Mandatory = $true)][string]$Ip,
        [Parameter(Mandatory = $true)][byte[]]$Key
    )

    $normalized = ConvertTo-ArchiveNormalizedIp $Ip
    if (-not $normalized) { return $null }
    $hmac = [Security.Cryptography.HMACSHA256]::new($Key)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($normalized)
        return ([BitConverter]::ToString($hmac.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $hmac.Dispose()
    }
}

function Protect-ArchiveAccessStateFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        & icacls.exe $Path /inheritance:r /grant:r "${identity}:(F)" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "icacls exit code $LASTEXITCODE" }
    } catch {
        throw "Access monitor state ACL protection failed: $($_.Exception.Message)"
    }
}

function New-ArchiveAccessMonitorState {
    param(
        [Parameter(Mandatory = $true)][string[]]$KnownIps,
        [Parameter(Mandatory = $true)][DateTimeOffset]$MonitorStart,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $key = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($key) } finally { $rng.Dispose() }
    $secure = ConvertTo-SecureString -String ([Convert]::ToBase64String($key)) -AsPlainText -Force
    $protectedKey = ConvertFrom-SecureString -SecureString $secure
    $knownHashes = @($KnownIps |
        ForEach-Object { ConvertTo-ArchiveNormalizedIp ([string]$_) } |
        Where-Object { $_ } |
        Sort-Object -Unique |
        ForEach-Object { Get-ArchiveAccessFingerprint -Ip $_ -Key $key } |
        Sort-Object -Unique)
    $state = [ordered]@{
        schemaVersion = 1
        baselineCapturedAt = ([DateTimeOffset]::Now).ToString('o')
        monitorStart = $MonitorStart.ToString('o')
        knownIpCount = $knownHashes.Count
        knownIpHashes = $knownHashes
        protectedHmacKey = $protectedKey
    }
    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
    $temporary = $Path + '.new'
    $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Protect-ArchiveAccessStateFile -Path $temporary
    [System.IO.File]::Move($temporary, $Path)
    Protect-ArchiveAccessStateFile -Path $Path
    return [pscustomobject]@{
        path = $Path
        baselineCapturedAt = $state.baselineCapturedAt
        monitorStart = $state.monitorStart
        knownIpCount = $state.knownIpCount
    }
}

function Get-ArchiveAccessMonitorStateInfo {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { throw "Access monitor state is missing: $Path" }
    $state = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ([int]$state.schemaVersion -ne 1) { throw 'Unsupported access monitor state schema.' }
    return [pscustomobject]@{
        baselineCapturedAt = [DateTimeOffset]::Parse([string]$state.baselineCapturedAt)
        monitorStart = [DateTimeOffset]::Parse([string]$state.monitorStart)
        knownIpCount = [int]$state.knownIpCount
    }
}

function Get-ArchiveAccessSummary {
    param(
        [Parameter(Mandatory = $true)][object[]]$Events,
        [Parameter(Mandatory = $true)][DateTimeOffset]$PeriodStart,
        [Parameter(Mandatory = $true)][DateTimeOffset]$PeriodEnd,
        [Parameter(Mandatory = $true)][string]$StatePath
    )

    if (-not (Test-Path -LiteralPath $StatePath)) { throw "Access monitor state is missing: $StatePath" }
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    if ([int]$state.schemaVersion -ne 1) { throw 'Unsupported access monitor state schema.' }
    $key = Get-ArchiveAccessKeyBytes -ProtectedKey ([string]$state.protectedHmacKey)
    $known = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($hash in @($state.knownIpHashes)) { [void]$known.Add([string]$hash) }

    $groups = @{}
    $knownAccesses = 0
    $ignoredNonPublic = 0
    foreach ($event in @($Events)) {
        $eventCount = 1
        if ($null -ne $event.PSObject.Properties['Count']) { $eventCount = [Math]::Max(1, [int]$event.Count) }
        $ip = ConvertTo-ArchiveNormalizedIp ([string]$event.Ip)
        if (-not $ip -or -not (Test-ArchivePublicIp $ip)) { $ignoredNonPublic += $eventCount; continue }
        $fingerprint = Get-ArchiveAccessFingerprint -Ip $ip -Key $key
        if ($known.Contains($fingerprint)) { $knownAccesses += $eventCount; continue }
        $firstSeen = if ($null -ne $event.PSObject.Properties['FirstSeen']) { [DateTimeOffset]$event.FirstSeen } else { [DateTimeOffset]$event.OccurredAt }
        $lastSeen = if ($null -ne $event.PSObject.Properties['LastSeen']) { [DateTimeOffset]$event.LastSeen } else { [DateTimeOffset]$event.OccurredAt }
        if (-not $groups.ContainsKey($fingerprint)) {
            $groups[$fingerprint] = [pscustomobject][ordered]@{
                anonymousId = '외부-' + $fingerprint.Substring(0, 8).ToUpperInvariant()
                count = 0
                firstSeen = $firstSeen
                lastSeen = $lastSeen
            }
        }
        $groups[$fingerprint].count += $eventCount
        if ($firstSeen -lt $groups[$fingerprint].firstSeen) { $groups[$fingerprint].firstSeen = $firstSeen }
        if ($lastSeen -gt $groups[$fingerprint].lastSeen) { $groups[$fingerprint].lastSeen = $lastSeen }
    }
    $identities = @($groups.Values | Sort-Object @{Expression='count';Descending=$true}, anonymousId | ForEach-Object {
        [pscustomobject][ordered]@{
            anonymousId = $_.anonymousId
            count = $_.count
            firstSeen = ([DateTimeOffset]$_.firstSeen).ToString('o')
            lastSeen = ([DateTimeOffset]$_.lastSeen).ToString('o')
        }
    })
    $newExternalAccessCount = 0
    foreach ($identity in $identities) { $newExternalAccessCount += [int]$identity.count }
    return [ordered]@{
        available = $true
        baselineCapturedAt = [string]$state.baselineCapturedAt
        monitorStart = [string]$state.monitorStart
        baselineIpCount = [int]$state.knownIpCount
        periodStart = $PeriodStart.ToString('o')
        periodEnd = $PeriodEnd.ToString('o')
        newExternalIpCount = $identities.Count
        newExternalAccessCount = $newExternalAccessCount
        baselineAccessCount = $knownAccesses
        ignoredNonPublicCount = $ignoredNonPublic
        identities = $identities
    }
}

Export-ModuleMember -Function @(
    'ConvertTo-ArchiveNormalizedIp',
    'Test-ArchivePublicIp',
    'New-ArchiveAccessMonitorState',
    'Get-ArchiveAccessMonitorStateInfo',
    'Get-ArchiveAccessSummary'
)
