#!/usr/bin/env bash
set -euo pipefail

ROOT=${ARCHIVEOS_ROOT:-/opt/archiveos}
ENV_FILE=${ARCHIVEOS_ENV_FILE:-/run/archiveos/archiveos.env}
BACKUP_ROOT=/srv/archiveos/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$BACKUP_ROOT/$timestamp"
mkdir -p "$target"
chmod 0700 "$target"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

compose=(docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.rc.yml" -f "$ROOT/deploy/oci/fullstack/docker-compose.oci.yml")

"${compose[@]}" exec -T postgres pg_dump -Fc --no-owner --no-acl -U "$DB_USER" -d "$DB_NAME" >"$target/archiveos.dump"
tar --xattrs --acls -C /srv/archiveos -czf "$target/vault.tar.gz" vault
find /srv/archiveos/vault -type f -printf '%P\0' | sort -z | xargs -0 -r sha256sum --tag >"$target/vault.sha256"
sha256sum "$target/archiveos.dump" "$target/vault.tar.gz" >"$target/backup.sha256"

if [[ -n ${ARCHIVEOS_BACKUP_BUCKET:-} ]]; then
  for file in archiveos.dump vault.tar.gz vault.sha256 backup.sha256; do
    oci --auth instance_principal os object put \
      --bucket-name "$ARCHIVEOS_BACKUP_BUCKET" \
      --name "archiveos/$timestamp/$file" \
      --file "$target/$file" \
      --force >/dev/null
  done
fi

echo "BACKUP_PASS path=$target"
