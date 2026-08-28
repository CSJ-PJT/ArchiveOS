#!/usr/bin/env bash
set -euo pipefail

release_id="${1:?release id is required}"
expected_sha256="${2:?artifact sha256 is required}"

if [[ ! "$release_id" =~ ^archiveos-ui-[a-z0-9-]+$ ]]; then
  printf 'invalid release id\n' >&2
  exit 2
fi
if [[ ! "$expected_sha256" =~ ^[0-9a-f]{64}$ ]]; then
  printf 'invalid artifact sha256\n' >&2
  exit 2
fi

artifact="/tmp/${release_id}.tgz"
release_dir="/srv/archiveos-edge/releases/${release_id}"
current_link="/srv/archiveos-edge/current-ui"
domain_config="/etc/nginx/conf.d/archiveos-domain.conf"
header_source="/tmp/archiveos-security-headers.conf"
header_target="/etc/nginx/snippets/archiveos-security-headers.conf"

actual_sha256="$(sha256sum "$artifact" | awk '{print $1}')"
test "$actual_sha256" = "$expected_sha256"
test ! -e "$release_dir"
old_target="$(readlink -f "$current_link")"
stamp="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$release_dir" /etc/nginx/snippets
tar -xzf "$artifact" -C "$release_dir"
test -f "$release_dir/index.html"
find "$release_dir" -type f -exec chmod 0644 {} +
find "$release_dir" -type d -exec chmod 0755 {} +
chown -R root:root "$release_dir"

install -o root -g root -m 0644 "$header_source" "$header_target"
cp -a "$domain_config" "${domain_config}.bak-${stamp}"

if ! grep -q 'archiveos-security-headers.conf' "$domain_config"; then
  sed -i '/server_name archiveos\.kr www\.archiveos\.kr;/a\    include /etc/nginx/snippets/archiveos-security-headers.conf;' "$domain_config"
  sed -i '/server_name archiveos\.kr;$/a\    include /etc/nginx/snippets/archiveos-security-headers.conf;' "$domain_config"
fi

if ! grep -q 'shared:ARCHIVEOS_SSL' "$domain_config"; then
  sed -i '/server_name archiveos\.kr;$/a\    ssl_session_tickets off;\n    ssl_session_cache shared:ARCHIVEOS_SSL:10m;\n    ssl_session_timeout 1d;\n    ssl_protocols TLSv1.2 TLSv1.3;' "$domain_config"
fi

# Apply the vendor-provided OpenSSL security update. Oracle Linux currently
# offers no newer nginx RPM on this host, so its backported RPM stays in place.
dnf -q -y upgrade openssl
nginx -t

next_link="${current_link}.next.$$"
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

rollback() {
  ln -s "$old_target" "$next_link"
  mv -Tf "$next_link" "$current_link"
  systemctl reload nginx
}

if ! systemctl reload nginx || ! curl -fsS http://127.0.0.1:18080/ >/dev/null; then
  rollback
  exit 1
fi

printf 'OLD_RELEASE=%s\n' "$old_target"
printf 'ACTIVE_RELEASE=%s\n' "$(readlink -f "$current_link")"
printf 'REMOTE_SHA256=%s\n' "$actual_sha256"
printf 'REMOTE_FILE_COUNT=%s\n' "$(find "$release_dir" -type f | wc -l)"
printf 'NGINX_PACKAGE=%s\n' "$(rpm -q nginx)"
printf 'OPENSSL_PACKAGE=%s\n' "$(rpm -q openssl)"

rm -f "$artifact" "$header_source"
