#!/usr/bin/env bash
set -euo pipefail

OUTPUT=/run/archiveos/archiveos.env
MAPPING=/etc/archiveos/secret-ocids.env
CONFIG=/etc/archiveos/archiveos.oci.conf

if [[ ${1:-} == "--delete" ]]; then
  rm -f "$OUTPUT"
  exit 0
fi

[[ ${EUID} -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
command -v oci >/dev/null 2>&1 || { echo "OCI CLI is required." >&2; exit 1; }
[[ -f "$MAPPING" ]] || { echo "Secret OCID mapping is missing." >&2; exit 1; }
[[ -f "$CONFIG" ]] || { echo "Non-secret OCI configuration is missing." >&2; exit 1; }

install -d -m 0700 /run/archiveos
tmp=$(mktemp /run/archiveos/archiveos.env.XXXXXX)
trap 'rm -f "$tmp"' EXIT
chmod 0600 "$tmp"

allowed_config='^(COMPOSE_PROJECT_NAME|ARCHIVEOS_FRONTEND_IMAGE|ARCHIVEOS_BACKEND_IMAGE|ARCHIVEOS_AI_IMAGE|ARCHIVEOS_FRONTEND_BIND_ADDRESS|ARCHIVEOS_PUBLIC_URL|CORS_ALLOWED_ORIGINS|SPRING_AI_OPENAI_CHAT_OPTIONS_MODEL|SPRING_AI_OPENAI_EMBEDDING_OPTIONS_MODEL|ARCHIVE_ECOSYSTEM_SERVICES_[A-Z_]+_BASE_URL|ARCHIVE_LEDGER_BASE_URL|SLACK_CHANNEL|ARCHIVEOS_SCHEDULER_ENABLED|ARCHIVE_LIVE_FLOW_COLLECTOR_ENABLED|ARCHIVE_INTEGRATION_SAFE_MODE|ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE|ARCHIVE_INTEGRATION_CALLBACK_ENABLED|ARCHIVEOS_SECURE_COOKIE|ARCHIVE_WORLD_ADAPTER_MODE)='
grep -E "$allowed_config" "$CONFIG" >>"$tmp"

while IFS='=' read -r name secret_id; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  [[ "$name" =~ ^[A-Z][A-Z0-9_]+$ ]] || { echo "Invalid secret variable name." >&2; exit 1; }
  [[ "$secret_id" == ocid1.vaultsecret.* ]] || { echo "Invalid secret OCID mapping for $name." >&2; exit 1; }
  value=$(
    oci --auth instance_principal secrets secret-bundle get \
      --secret-id "$secret_id" \
      --stage CURRENT \
      --query 'data."secret-bundle-content".content' \
      --raw-output | base64 --decode
  )
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || { echo "Multiline secret is not supported for $name." >&2; exit 1; }
  escaped=${value//\'/\\\'}
  printf "%s='%s'\n" "$name" "$escaped" >>"$tmp"
  unset value escaped
done <"$MAPPING"

for required in DB_NAME DB_USER DB_PASSWORD OPENAI_API_KEY ARCHIVEOS_ADMIN_PASSWORD \
  ARCHIVE_TOKEN_MARKET_TO_OS ARCHIVE_TOKEN_NEXUS_TO_OS ARCHIVE_TOKEN_LOGISTICS_TO_OS \
  ARCHIVE_TOKEN_LEDGER_TO_OS ARCHIVE_TOKEN_OS_TO_LEDGER ARCHIVE_TOKEN_AUTHENTICATED_READ \
  ARCHIVE_TOKEN_ADMIN_OPERATOR ARCHIVEOS_INTEGRATION_TOKEN; do
  grep -q "^${required}=" "$tmp" || { echo "Missing required secret mapping: $required" >&2; exit 1; }
done

chown root:root "$tmp"
chmod 0600 "$tmp"
mv -f "$tmp" "$OUTPUT"
trap - EXIT
echo "SECRET_LOAD_PASS"
