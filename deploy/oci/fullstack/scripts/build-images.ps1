param(
  [string]$ImagePrefix = "archiveos",
  [string]$Revision = "c2324df9a935e897fbe8be94068f862c4ac3956f"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path

function Assert-LastExit([string]$Step) {
  if ($LASTEXITCODE -ne 0) { throw "$Step failed with exit code $LASTEXITCODE." }
}

function Invoke-RepositoryGit {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if (Get-Command git -ErrorAction SilentlyContinue) {
    & git @Arguments
    return
  }
  if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
    throw "Git is unavailable in Windows and WSL."
  }
  if ($Root -notmatch "^([A-Za-z]):\\(.*)$") {
    throw "Cannot translate repository path to WSL."
  }
  $wslRoot = "/mnt/$($Matches[1].ToLowerInvariant())/$($Matches[2].Replace('\', '/'))"
  & wsl -d Ubuntu -- git -C $wslRoot @Arguments
}

Push-Location $Root
try {
  $head = (Invoke-RepositoryGit rev-parse HEAD).Trim()
  Assert-LastExit "git rev-parse"
  if ($head -ne $Revision) { throw "Source revision mismatch." }

  $forbidden = Invoke-RepositoryGit diff --name-only $Revision -- src backend archiveos-ai
  Assert-LastExit "product source diff check"
  if ($forbidden) { throw "Product source has local changes; image build refused." }

  $labels = @(
    "--label", "org.opencontainers.image.source=CSJ-PJT/ArchiveOS",
    "--label", "org.opencontainers.image.revision=$Revision",
    "--label", "org.opencontainers.image.version=oci-fullstack-v1"
  )
  $images = [ordered]@{
    frontend = "$ImagePrefix/frontend`:$Revision"
    backend = "$ImagePrefix/backend`:$Revision"
    ai = "$ImagePrefix/ai`:$Revision"
  }

  docker build @labels -t $images.frontend .
  Assert-LastExit "frontend image build"
  docker build @labels -t $images.backend ./backend
  Assert-LastExit "backend image build"
  docker build @labels -t $images.ai ./archiveos-ai
  Assert-LastExit "AI image build"

  $container = docker create $images.frontend
  Assert-LastExit "frontend image inspection container"
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) "archiveos-frontend-$([guid]::NewGuid())"
  New-Item -ItemType Directory -Path $temp | Out-Null
  try {
    docker cp "${container}:/usr/share/nginx/html/." $temp
    Assert-LastExit "frontend asset extraction"
    $assetManifest = Get-ChildItem $temp -Recurse -File | Sort-Object FullName | ForEach-Object {
      $relative = $_.FullName.Substring($temp.Length).TrimStart("\")
      "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())  $relative"
    }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hash = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes(($assetManifest -join "`n")))
      $assetChecksum = -join ($hash | ForEach-Object { $_.ToString("x2") })
    } finally {
      $sha256.Dispose()
    }
  } finally {
    docker rm $container | Out-Null
    Remove-Item -LiteralPath $temp -Recurse -Force
  }

  foreach ($entry in $images.GetEnumerator()) {
    $id = (docker image inspect --format "{{.Id}}" $entry.Value).Trim()
    [pscustomobject]@{
      Component = $entry.Key
      Image = $entry.Value
      LocalDigest = $id
      Revision = $Revision
    }
  }
  "FRONTEND_ASSET_CHECKSUM=$assetChecksum"
} finally {
  Pop-Location
}
