#!/usr/bin/env bash
set -euo pipefail

[[ ${EUID} -eq 0 ]] || { echo "Run as root." >&2; exit 1; }

if command -v dnf >/dev/null 2>&1; then
  dnf install -y docker-engine docker-cli jq oci-cli xfsprogs
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 jq xfsprogs
  command -v oci >/dev/null 2>&1 || {
    echo "OCI CLI is not available from this image's configured repositories." >&2
    echo "Install OCI CLI from Oracle's signed distribution before deployment." >&2
    exit 1
  }
else
  echo "Unsupported operating system package manager." >&2
  exit 1
fi

systemctl enable --now docker
docker version >/dev/null
docker compose version >/dev/null
oci --version
echo "RUNTIME_INSTALL_PASS"
