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
  exec -T frontend nginx -t

for route in /archive-world-mini/ /archive-world-mini/status.json /archive-world-mini/world-mini-map.json; do
  docker compose --env-file "$ENV_FILE" \
    -f docker-compose.yml \
    -f docker-compose.rc.yml \
    -f deploy/oci/fullstack/docker-compose.oci.yml \
    exec -T frontend wget -q -O /dev/null "http://127.0.0.1${route}"
done

docker compose --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.rc.yml \
  -f deploy/oci/fullstack/docker-compose.oci.yml \
  ps

echo "CANARY_DEPLOY_PASS"
