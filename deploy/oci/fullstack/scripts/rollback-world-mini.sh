#!/usr/bin/env bash
set -euo pipefail

ROOT=${ARCHIVEOS_ROOT:-/opt/archiveos}
ENV_FILE=${ARCHIVEOS_ENV_FILE:-/run/archiveos/archiveos.env}
CONFIG=/etc/archiveos/archiveos.oci.conf
COMPOSE_FILES=(-f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.rc.yml" -f "$ROOT/deploy/oci/fullstack/docker-compose.oci.yml")

fail() { printf 'WORLD_MINI_ROLLBACK_FAIL: %s\n' "$1" >&2; exit 1; }
[[ ${EUID} -eq 0 ]] || fail "run as root"
[[ $# -eq 1 ]] || fail "usage: rollback-world-mini.sh <previous-immutable-image@sha256:digest>"
previous_image=$1
[[ "$previous_image" =~ ^.+@sha256:[0-9a-f]{64}$ ]] || fail "previous image must be an immutable digest reference"
[[ -f "$CONFIG" && -f "$ENV_FILE" ]] || fail "OCI configuration or runtime environment is missing"

tmp=$(mktemp "${CONFIG}.XXXXXX")
trap 'rm -f "$tmp"' EXIT
if grep -q '^ARCHIVE_WORLD_MINI_IMAGE=' "$CONFIG"; then
  sed "s|^ARCHIVE_WORLD_MINI_IMAGE=.*|ARCHIVE_WORLD_MINI_IMAGE=${previous_image}|" "$CONFIG" >"$tmp"
else
  cat "$CONFIG" >"$tmp"
  printf '\nARCHIVE_WORLD_MINI_IMAGE=%s\n' "$previous_image" >>"$tmp"
fi
install -o root -g root -m 0600 "$tmp" "$CONFIG"

"$ROOT/deploy/oci/fullstack/scripts/fetch-secrets.sh"
cd "$ROOT"
docker pull "$previous_image"
docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" up -d --no-deps --force-recreate archive-world-mini
docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" ps archive-world-mini

printf 'WORLD_MINI_ROLLBACK_PASS\n'
