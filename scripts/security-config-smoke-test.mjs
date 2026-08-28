import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nginx = readFileSync("nginx.conf", "utf8");
const edgeSecurity = readFileSync("tools/ops/archiveos-edge-security.conf", "utf8");
const edgeRateZones = readFileSync("tools/ops/archiveos-edge-rate-zones.conf", "utf8");
const sysctl = readFileSync("tools/ops/archiveos-sysctl-hardening.conf", "utf8");
const fail2ban = readFileSync("tools/ops/archiveos-fail2ban-sshd.local", "utf8");

for (const marker of [
  "location ~* ^/(?:\\.env",
  "\\.git(?:/|$)",
  "actuator/(?:env|configprops|heapdump|logfile)",
  "swagger(?:-ui)?",
  "v[23]/api-docs",
  "phpinfo(?:\\.php)?$",
  "return 404;",
]) {
  assert.ok(nginx.includes(marker), `nginx sensitive-path guard is missing: ${marker}`);
}

assert.ok(
  nginx.indexOf("location ~* ^/(?:\\.env") < nginx.indexOf("location / {"),
  "sensitive-path guard must be evaluated before the SPA fallback",
);

for (const marker of ["limit_req zone=archiveos_public_per_ip", "limit_conn archiveos_public_conn", "return 404;"]) {
  assert.ok(edgeSecurity.includes(marker), `edge security config is missing: ${marker}`);
}
for (const marker of ["limit_req_zone $binary_remote_addr", "limit_conn_zone $binary_remote_addr"]) {
  assert.ok(edgeRateZones.includes(marker), `edge rate zone config is missing: ${marker}`);
}
for (const marker of [
  "net.ipv4.conf.all.accept_redirects = 0",
  "net.ipv4.conf.default.accept_redirects = 0",
  "net.ipv4.conf.all.send_redirects = 0",
  "net.ipv4.conf.default.send_redirects = 0",
]) {
  assert.ok(sysctl.includes(marker), `sysctl hardening config is missing: ${marker}`);
}
for (const marker of ["[sshd]", "enabled = true", "backend = systemd", "bantime.increment = true"]) {
  assert.ok(fail2ban.includes(marker), `fail2ban config is missing: ${marker}`);
}

console.log("security config smoke-test passed");
