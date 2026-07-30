#!/usr/bin/env bash
set -euo pipefail

ROOT=${ARCHIVEOS_ROOT:-/opt/archiveos}
ENV_FILE=${ARCHIVEOS_ENV_FILE:-/run/archiveos/archiveos.env}
COMPOSE_FILES=(-f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.rc.yml" -f "$ROOT/deploy/oci/fullstack/docker-compose.oci.yml")

fail() { printf 'PREFLIGHT_FAIL: %s\n' "$1" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }

[[ ${EUID} -eq 0 ]] || fail "run as root"
require docker
require jq
require sha256sum
docker compose version >/dev/null

[[ -f "$ENV_FILE" ]] || fail "runtime env file missing"
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || fail "runtime env mode must be 0600"
[[ "$(stat -c '%U:%G' "$ENV_FILE")" == "root:root" ]] || fail "runtime env owner must be root:root"

for path in /srv/archiveos/postgres /srv/archiveos/vault /srv/archiveos/backups /srv/archiveos/runtime/queue /srv/archiveos/world-handoff; do
  [[ -d "$path" ]] || fail "missing persistent path: $path"
done
mountpoint -q /srv/archiveos || fail "/srv/archiveos is not a mounted persistent filesystem"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for name in ARCHIVEOS_FRONTEND_IMAGE ARCHIVEOS_BACKEND_IMAGE ARCHIVEOS_AI_IMAGE ARCHIVE_WORLD_MINI_IMAGE; do
  value=${!name:-}
  [[ "$value" =~ @sha256:[0-9a-f]{64}$ ]] || fail "$name must be pinned by digest"
done

[[ ${ARCHIVEOS_PUBLIC_URL:-} == https://* ]] || fail "ARCHIVEOS_PUBLIC_URL must use HTTPS"
[[ ${ARCHIVEOS_SECURE_COOKIE:-} == "true" ]] || fail "secure cookie must be enabled"
[[ ${ARCHIVEOS_SCHEDULER_ENABLED:-} == "false" ]] || fail "scheduler must remain disabled for canary"
[[ ${ARCHIVE_LIVE_FLOW_COLLECTOR_ENABLED:-} == "false" ]] || fail "collector must remain disabled for canary"
[[ ${ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE:-} == "false" ]] || fail "external writes must remain disabled for canary"
[[ ${ARCHIVE_INTEGRATION_CALLBACK_ENABLED:-} == "false" ]] || fail "callbacks must remain disabled for canary"
[[ ${ARCHIVE_WORLD_ADAPTER_MODE:-} == "live" ]] || fail "World adapter must be live for the World Mini canary"
[[ ${ARCHIVE_WORLD_EVENT_LIMIT:-} == "100" ]] || fail "World event limit must remain 100"
[[ ${ARCHIVE_WORLD_SOURCE_HEAD:-} =~ ^[0-9a-f]{40}$ ]] || fail "ARCHIVE_WORLD_SOURCE_HEAD must be a full immutable Git SHA"
[[ ${ARCHIVE_WORLD_MANIFEST_SHA256:-} =~ ^[0-9a-f]{64}$ ]] || fail "ARCHIVE_WORLD_MANIFEST_SHA256 must be SHA-256"

world_manifest=/srv/archiveos/world-handoff/archive-world-assets.json
world_provenance=/srv/archiveos/world-handoff/provenance.json
[[ -f "$world_manifest" ]] || fail "World PM handoff manifest is missing"
[[ -f "$world_provenance" ]] || fail "World PM provenance is missing"
actual_manifest_sha=$(sha256sum "$world_manifest" | awk '{print $1}')
[[ "$actual_manifest_sha" == "$ARCHIVE_WORLD_MANIFEST_SHA256" ]] || fail "World manifest checksum mismatch"
jq -e \
  --arg source_head "$ARCHIVE_WORLD_SOURCE_HEAD" \
  --arg manifest_sha "$ARCHIVE_WORLD_MANIFEST_SHA256" '
    .schemaVersion == "1.0.0"
    and .sourceProject == "Archive-World"
    and .sourceHead == $source_head
    and .manifestSha256 == $manifest_sha
    and .actualBuildEvidence == true
    and .prototypeTarget == false
    and .canonical == false
    and .v3Applied == false
    and .runtimeMutation == false
    and .mainMerge == false
  ' "$world_provenance" >/dev/null || fail "World PM provenance/protection flags failed"

for name in \
  ARCHIVE_ECOSYSTEM_SERVICES_MARKET_BASE_URL \
  ARCHIVE_ECOSYSTEM_SERVICES_NEXUS_BASE_URL \
  ARCHIVE_ECOSYSTEM_SERVICES_LOGISTICS_BASE_URL \
  ARCHIVE_ECOSYSTEM_SERVICES_LEDGER_BASE_URL; do
  value=${!name:-}
  [[ -n "$value" ]] || fail "$name is required"
  [[ "$value" != *localhost* && "$value" != *127.0.0.1* && "$value" != *host.docker.internal* ]] \
    || fail "$name uses a forbidden local endpoint"
done

config=$(mktemp)
trap 'rm -f "$config"' EXIT
docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" config --format json >"$config"

jq -e '
  [.services.postgres.ports // [], .services.backend.ports // [], .services["archiveos-ai"].ports // []]
  | flatten | length == 0
' "$config" >/dev/null || fail "postgres/backend/AI must not publish host ports"

jq -e '
  (.services.frontend.ports | length) == 1
  and (.services.frontend.ports[0].published == "8080")
' "$config" >/dev/null || fail "frontend must be the only published service on port 8080"

jq -e '
  (.services["archive-world-mini"].ports // [] | length) == 0
  and (.services["archive-world-mini"].expose | index("4190") != null)
  and .services["archive-world-mini"].read_only == true
  and (.services["archive-world-mini"].volumes // [] | length) == 0
' "$config" >/dev/null || fail "World Mini private/read-only container contract failed"

jq -e '
  [(.services["archiveos-ai"].volumes // [])[].source]
  | any(. == "/srv/archiveos/vault")
  and any(. == "/srv/archiveos/world-handoff/archive-world-assets.json")
  and all(. != null; contains("Archive-World") | not)
' "$config" >/dev/null || fail "AI vault/World mount contract failed"

printf 'PREFLIGHT_PASS\n'
