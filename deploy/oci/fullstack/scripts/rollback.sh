#!/usr/bin/env bash
set -euo pipefail

ROOT=${ARCHIVEOS_ROOT:-/opt/archiveos}
ENV_FILE=${ARCHIVEOS_ENV_FILE:-/run/archiveos/archiveos.env}
PREVIOUS=${ARCHIVEOS_PREVIOUS_IMAGES_FILE:-/srv/archiveos/runtime/previous-image-digests.env}

[[ -f "$PREVIOUS" ]] || { echo "Previous image digest file is missing." >&2; exit 1; }
[[ "$(stat -c '%a' "$PREVIOUS")" == "600" ]] || { echo "Previous image digest file must be mode 0600." >&2; exit 1; }

for name in ARCHIVEOS_FRONTEND_IMAGE ARCHIVEOS_BACKEND_IMAGE ARCHIVEOS_AI_IMAGE; do
  value=$(grep -E "^${name}=" "$PREVIOUS" | head -n1 | cut -d= -f2-)
  [[ "$value" =~ @sha256:[0-9a-f]{64}$ ]] || { echo "Invalid previous digest for $name." >&2; exit 1; }
  sed -i "s|^${name}=.*|${name}=${value}|" "$ENV_FILE"
done

cd "$ROOT"
docker compose --env-file "$ENV_FILE" \
  -f docker-compose.yml \
  -f docker-compose.rc.yml \
  -f deploy/oci/fullstack/docker-compose.oci.yml \
  up -d --pull always --wait

echo "ROLLBACK_PASS"
