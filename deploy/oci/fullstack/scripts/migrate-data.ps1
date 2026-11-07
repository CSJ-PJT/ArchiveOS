param(
  [ValidateSet("Inventory", "Dump", "Restore", "Compare")][string]$Mode = "Inventory",
  [string]$SourceProjectRoot,
  [string]$SourceEnvFile,
  [string]$ArtifactRoot = ".\artifacts\oci-migration",
  [string]$TargetSshHost,
  [string]$TargetRoot = "/opt/archiveos",
  [string]$TargetInventoryPath,
  [switch]$ConfirmTargetRestore
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($SourceProjectRoot)) {
  $SourceProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
}
if ([string]::IsNullOrWhiteSpace($SourceEnvFile)) {
  $SourceEnvFile = Join-Path $SourceProjectRoot ".env.rc"
}
$CoreTables = @(
  "runtime_timeline", "audit_logs", "ecosystem_flow_event", "managed_system_pm_inbox_state",
  "obsidian_documents", "obsidian_chunks", "batch_job_instance", "batch_job_execution",
  "rpa_tasks", "rpa_decisions", "external_approval_requests"
)

function ComposePrefix {
  @(
    "compose", "--env-file", $SourceEnvFile,
    "-f", (Join-Path $SourceProjectRoot "docker-compose.yml"),
    "-f", (Join-Path $SourceProjectRoot "docker-compose.rc.yml")
  )
}

function Invoke-SourcePsql([string]$Sql) {
  $args = ComposePrefix
  & docker @args exec -T -e "ARCHIVEOS_READ_SQL=$Sql" postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$ARCHIVEOS_READ_SQL"'
  if ($LASTEXITCODE -ne 0) { throw "Read-only source query failed." }
}

New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null
$inventoryPath = Join-Path $ArtifactRoot "source-inventory.tsv"
$dumpPath = Join-Path $ArtifactRoot "archiveos.dump"

if ($Mode -in @("Inventory", "Dump", "Compare")) {
  $rows = foreach ($table in $CoreTables) {
    $sql = "select case when to_regclass('public.$table') is null then 'MISSING' else (select count(*)::text from public.$table) end;"
    [pscustomobject]@{ Table = $table; Rows = (Invoke-SourcePsql $sql | Select-Object -First 1) }
  }
  $rows | Export-Csv -Delimiter "`t" -NoTypeInformation -Path $inventoryPath
  $rows
}

if ($Mode -eq "Dump") {
  $args = ComposePrefix
  & docker @args exec -T postgres sh -lc 'pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/archiveos-oci.dump'
  if ($LASTEXITCODE -ne 0) { throw "Source pg_dump failed." }
  $containerId = (& docker @args ps -q postgres).Trim()
  if (-not $containerId) { throw "Source PostgreSQL container was not found." }
  docker cp "${containerId}:/tmp/archiveos-oci.dump" $dumpPath
  if ($LASTEXITCODE -ne 0) { throw "Dump extraction failed." }
  & docker @args exec -T postgres rm -f /tmp/archiveos-oci.dump
  Get-FileHash $dumpPath -Algorithm SHA256
}

if ($Mode -eq "Restore") {
  if (-not $ConfirmTargetRestore) { throw "Restore requires -ConfirmTargetRestore." }
  if (-not $TargetSshHost) { throw "TargetSshHost is required." }
  if (-not (Test-Path $dumpPath)) { throw "Migration dump is missing." }
  scp $dumpPath "${TargetSshHost}:/tmp/archiveos-oci.dump"
  if ($LASTEXITCODE -ne 0) { throw "Encrypted dump transfer failed." }
  ssh $TargetSshHost "cd '$TargetRoot' && cid=`$(docker compose -f docker-compose.yml -f docker-compose.rc.yml -f deploy/oci/fullstack/docker-compose.oci.yml ps -q postgres) && docker cp /tmp/archiveos-oci.dump \"`$cid:/tmp/archiveos-oci.dump\" && docker compose -f docker-compose.yml -f docker-compose.rc.yml -f deploy/oci/fullstack/docker-compose.oci.yml exec -T postgres sh -lc 'pg_restore --no-owner --no-acl --exit-on-error -U \"`$POSTGRES_USER\" -d \"`$POSTGRES_DB\" /tmp/archiveos-oci.dump' && rm -f /tmp/archiveos-oci.dump"
  if ($LASTEXITCODE -ne 0) { throw "Target restore failed." }
}

if ($Mode -eq "Compare") {
  if (-not $TargetInventoryPath -or -not (Test-Path $TargetInventoryPath)) {
    throw "Compare requires a target inventory TSV produced by running Inventory against the canary."
  }
  $sourceRows = Import-Csv -Delimiter "`t" $inventoryPath
  $targetRows = Import-Csv -Delimiter "`t" $TargetInventoryPath
  foreach ($table in $CoreTables) {
    $source = ($sourceRows | Where-Object Table -eq $table).Rows
    $target = ($targetRows | Where-Object Table -eq $table).Rows
    [pscustomobject]@{ Table = $table; Source = $source; Target = $target; Match = $source -eq $target }
  }
}
