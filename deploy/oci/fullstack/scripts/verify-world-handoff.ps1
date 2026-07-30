param(
  [Parameter(Mandatory = $true)][string]$HandoffRoot,
  [Parameter(Mandatory = $true)][string]$MiniArtifactRoot,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$WorldSourceHead,
  [Parameter(Mandatory = $true)][ValidatePattern('^.+@sha256:[0-9a-f]{64}$')][string]$ImageDigest,
  [string]$ManifestPath,
  [string]$ProvenancePath
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ManifestPath)) { $ManifestPath = Join-Path $HandoffRoot 'archive-world-assets.json' }
if ([string]::IsNullOrWhiteSpace($ProvenancePath)) { $ProvenancePath = Join-Path $HandoffRoot 'provenance.json' }

function Require-File([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "BLOCKED_WORLD_HANDOFF: missing $Label" }
  (Resolve-Path -LiteralPath $Path).Path
}

function Read-Json([string]$Path, [string]$Label) {
  try { Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json }
  catch { throw "BLOCKED_WORLD_HANDOFF: invalid JSON for $Label" }
}

function Count-Array($Object, [string]$Name) {
  $value = $Object.$Name
  if ($null -eq $value) { throw "BLOCKED_WORLD_HANDOFF: $Name is absent from world-mini-map.json" }
  @($value).Count
}

function Require-ZeroMetric($Object, [string[]]$Names) {
  foreach ($name in $Names) {
    $value = $Object.$name
    if ($null -ne $value) {
      if ([int64]$value -ne 0) { throw "BLOCKED_WORLD_HANDOFF: $name must be 0" }
      return
    }
  }
  throw "BLOCKED_WORLD_HANDOFF: validation metric is absent ($($Names -join ', '))"
}

$handoff = Resolve-Path -LiteralPath $HandoffRoot
$mini = Resolve-Path -LiteralPath $MiniArtifactRoot
Require-File (Join-Path $mini 'web/dist/archive-world-mini/index.html') 'Mini World index.html' | Out-Null
$assets = Join-Path $mini 'web/dist/archive-world-mini/assets'
if (-not (Test-Path -LiteralPath $assets -PathType Container) -or @(Get-ChildItem -LiteralPath $assets -File -Recurse).Count -lt 1) {
  throw 'BLOCKED_WORLD_HANDOFF: Mini World assets are missing'
}
$mapPath = Require-File (Join-Path $mini 'web/public/archive-world-mini/world-mini-map.json') 'world-mini-map.json'
$statusPath = Require-File (Join-Path $mini 'web/public/archive-world-mini/status.json') 'status.json'
Require-File (Join-Path $mini 'archive-world-live-snapshot-20260730.json') 'live snapshot' | Out-Null
Require-File (Join-Path $mini 'archive-world-current-state-20260730.json') 'current state JSON' | Out-Null
Require-File (Join-Path $mini 'archive-world-current-state-20260730.md') 'current state Markdown' | Out-Null
$manifestPath = Require-File $ManifestPath 'ArchiveOS adapter manifest'
$provenancePath = Require-File $ProvenancePath 'World PM provenance'

$manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$mapHash = (Get-FileHash -LiteralPath $mapPath -Algorithm SHA256).Hash.ToLowerInvariant()
$statusHash = (Get-FileHash -LiteralPath $statusPath -Algorithm SHA256).Hash.ToLowerInvariant()
$provenance = Read-Json $provenancePath 'provenance'
$map = Read-Json $mapPath 'world-mini-map'
$status = Read-Json $statusPath 'status'

if ($provenance.schemaVersion -ne '1.0.0' -or $provenance.sourceProject -ne 'Archive-World' -or
    $provenance.sourceHead -ne $WorldSourceHead -or $provenance.actualBuildEvidence -ne $true -or
    $provenance.prototypeTarget -ne $false) {
  throw 'BLOCKED_WORLD_HANDOFF: provenance identity or actual-build evidence failed'
}
if ($provenance.manifestSha256 -ne $manifestHash -or $provenance.miniMapSha256 -ne $mapHash -or
    $provenance.statusSha256 -ne $statusHash) {
  throw 'BLOCKED_WORLD_SOURCE_MISMATCH: World PM checksum evidence failed'
}
foreach ($flag in @('canonical', 'v3Applied', 'runtimeMutation', 'mainMerge')) {
  if ($provenance.$flag -ne $false) { throw "BLOCKED_WORLD_HANDOFF: protection flag $flag is not false" }
}

if ([string]::IsNullOrWhiteSpace([string]$provenance.bundlePath) -or
    [string]::IsNullOrWhiteSpace([string]$provenance.bundleSha256)) {
  throw 'BLOCKED_WORLD_HANDOFF: provenance must include bundlePath and bundleSha256'
}
$bundlePath = [IO.Path]::GetFullPath((Join-Path $mini $provenance.bundlePath))
$miniPrefix = $mini.Path.TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
if (-not $bundlePath.StartsWith($miniPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'BLOCKED_WORLD_HANDOFF: bundlePath escapes the immutable artifact root'
}
Require-File $bundlePath 'provenance bundlePath' | Out-Null
if ((Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $provenance.bundleSha256.ToLowerInvariant()) {
  throw 'BLOCKED_WORLD_SOURCE_MISMATCH: bundle checksum failed'
}

$districts = Count-Array $map 'districts'
$blocks = Count-Array $map 'blocks'
$buildings = Count-Array $map 'buildings'
$families = Count-Array $map 'families'
$chunks = if ($null -ne $map.lodChunks) { @($map.lodChunks).Count } else { Count-Array $map 'chunks' }
if ($districts -ne 13) { throw "BLOCKED_WORLD_HANDOFF: expected 13 Districts, found $districts" }
$validation = $map.validation
if ($null -eq $validation) { throw 'BLOCKED_WORLD_HANDOFF: map validation section is absent' }
Require-ZeroMetric $validation @('invalidCoordinates', 'invalidCoordinateCount')
Require-ZeroMetric $validation @('negativeScales', 'negativeScaleCount')
Require-ZeroMetric $validation @('anchorMismatch', 'anchorMismatchCount')
if ($status.technicalStatus -ne 'PASS' -or $status.visualStatus -ne 'PARTIAL' -or $status.releaseGate -ne 'PARTIAL') {
  throw 'BLOCKED_WORLD_HANDOFF: World release status does not match the approved current state'
}

[pscustomobject]@{
  Status = 'WORLD_SOURCE_PROVENANCE_VERIFIED'
  ArtifactImage = $ImageDigest
  WorldSourceHead = $WorldSourceHead
  ManifestSha256 = $manifestHash
  MiniMapSha256 = $mapHash
  StatusSha256 = $statusHash
  District = $districts
  Block = $blocks
  Building = $buildings
  Family = $families
  Chunk = $chunks
  Technical = $status.technicalStatus
  Visual = $status.visualStatus
  Release = $status.releaseGate
  ProtectionFlagsPreserved = $true
}
