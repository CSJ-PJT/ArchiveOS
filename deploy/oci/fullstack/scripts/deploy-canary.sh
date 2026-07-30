#!/usr/bin/env bash
set -euo pipefail

ROOT=${ARCHIVEOS_ROOT:-/opt/archiveos}
ENV_FILE=${ARCHIVEOS_ENV_FILE:-/run/archiveos/archiveos.env}
cd "$ROOT"

"$ROOT/deploy/oci/fullstack/scripts/preflight.sh"

docker compose --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.rc.yml \
  -f deploy/oci/fullstack/docker-compose.oci.yml \
  pull

docker compose --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.rc.yml \
  -f deploy/oci/fullstack/docker-compose.oci.yml \
  up -d --wait

docker compose --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.rc.yml \
  -f deploy/oci/fullstack/docker-compose.oci.yml \
  ps

echo "CANARY_DEPLOY_PASS"
