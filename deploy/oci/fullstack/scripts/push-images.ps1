param(
  [Parameter(Mandatory = $true)][string]$Region,
  [Parameter(Mandatory = $true)][string]$Namespace,
  [string]$RepositoryPrefix = "archiveos",
  [string]$LocalPrefix = "archiveos",
  [string]$Revision = "c2324df9a935e897fbe8be94068f862c4ac3956f"
)

$ErrorActionPreference = "Stop"
$registry = "$Region.ocir.io"
$components = @("frontend", "backend", "ai")

foreach ($component in $components) {
  $local = "$LocalPrefix/$component`:$Revision"
  $remote = "$registry/$Namespace/$RepositoryPrefix/$component`:$Revision"
  docker image inspect $local *> $null
  if ($LASTEXITCODE -ne 0) { throw "Local immutable image is missing: $component" }

  docker tag $local $remote
  if ($LASTEXITCODE -ne 0) { throw "Tag failed: $component" }
  docker push $remote
  if ($LASTEXITCODE -ne 0) { throw "Push failed: $component" }

  $inspection = docker buildx imagetools inspect $remote --format "{{json .Manifest}}"
  if ($LASTEXITCODE -ne 0) { throw "Remote digest inspection failed: $component" }
  $manifest = $inspection | ConvertFrom-Json
  if (-not $manifest.digest -or $manifest.digest -notmatch "^sha256:[0-9a-f]{64}$") {
    throw "Remote digest is invalid: $component"
  }
  [pscustomobject]@{
    Component = $component
    ImmutableTag = $remote
    DigestReference = "$remote@$($manifest.digest)"
    Revision = $Revision
  }
}
