#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 <block-device> [--format]" >&2; exit 2; }
[[ ${EUID} -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
[[ $# -ge 1 ]] || usage

device=$1
allow_format=${2:-}
[[ -b "$device" ]] || { echo "Not a block device: $device" >&2; exit 1; }

filesystem=$(blkid -s TYPE -o value "$device" 2>/dev/null || true)
if [[ -z "$filesystem" ]]; then
  [[ "$allow_format" == "--format" ]] || {
    echo "Device is unformatted. Re-run with --format only after confirming the OCI Block Volume." >&2
    exit 1
  }
  mkfs.xfs -f "$device"
  filesystem=xfs
fi
[[ "$filesystem" == "xfs" || "$filesystem" == "ext4" ]] || {
  echo "Unsupported filesystem: $filesystem" >&2
  exit 1
}

mkdir -p /srv/archiveos
uuid=$(blkid -s UUID -o value "$device")
grep -q "UUID=$uuid " /etc/fstab || printf 'UUID=%s /srv/archiveos %s defaults,nofail 0 2\n' "$uuid" "$filesystem" >>/etc/fstab
mountpoint -q /srv/archiveos || mount /srv/archiveos

install -d -m 0700 /srv/archiveos/postgres
install -d -m 0750 /srv/archiveos/vault /srv/archiveos/backups /srv/archiveos/runtime /srv/archiveos/runtime/queue
echo "STORAGE_MOUNT_PASS"
