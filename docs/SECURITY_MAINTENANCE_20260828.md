# ArchiveOS Security Maintenance Gate - 2026-08-28

## Current public-window rule

ArchiveOS must remain available while the public recruitment posting is open.
Do not reboot the OCI host, restart or recreate the ArchiveOS containers, reload
Nginx, restart PostgreSQL, or apply package updates during this gate.

The 2026-08-28 non-destructive audit found no evidence of current compromise.
It did find an outstanding Oracle Linux security backlog, sustained SSH login
attacks, no active Fail2ban jail, accepted IPv4 redirects, no edge request-rate
limit, and SPA fallback responses for common sensitive paths.

## Prepared non-destructive fixes

- `nginx.conf` returns 404 for secret and diagnostics probes in the container UI.
- `tools/ops/archiveos-edge-rate-zones.conf` defines bounded per-source request
  and connection state for the OCI edge.
- `tools/ops/archiveos-edge-security.conf` applies generous public-site limits
  and returns 404 for secret and diagnostics probes at the edge.
- `tools/ops/archiveos-fail2ban-sshd.local` supplies an incremental SSH jail.
- `tools/ops/archiveos-sysctl-hardening.conf` disables IPv4 redirects and source
  routing without changing forwarding or tunnel routing.

None of these host settings are applied automatically.

## Maintenance sequence after operator approval

1. Record container health/restart counts, Nginx status, tunnel listeners, disk
   space, current kernel, installed package versions, and pending advisories.
2. Preserve the current Nginx, sshd, Fail2ban, and sysctl files with timestamped
   root-owned backups.
3. Install and validate the Nginx zone and server snippets with `nginx -t`.
   Use a graceful reload only after the configuration test succeeds, then verify
   the public UI, APIs, mail webhook, RAG, login, and tunnel endpoints.
4. Install Fail2ban if necessary, install the supplied jail, validate its
   effective configuration, and start it. Confirm authorized key access before
   closing the maintenance SSH session.
5. Apply the sysctl file, verify effective values, and recheck the reverse SSH
   tunnel. Do not change forwarding, routing tables, OCI security lists, or
   Tailscale state in this step.
6. Review rpcbind consumers before any disablement. Firewall isolation alone is
   retained until a dependency check proves it is unused.
7. Apply the Oracle Linux security updates in a scheduled window. Capture the
   transaction ID and package list. Do not rely on Ksplice because the audit
   reported it as unsuccessful.
8. Reboot only after explicit operator approval. After reboot, verify kernel,
   SELinux, firewalld, auditd, Nginx, certificates, reverse tunnel, all ArchiveOS
   containers, public APIs, and restart-count deltas.

## Rollback conditions

Roll back the most recent configuration change if Nginx validation fails,
authorized SSH access fails, the reverse tunnel disappears, public health or
core APIs fail, or any ArchiveOS container restart count increases unexpectedly.
Do not delete Docker volumes, databases, audit history, mail data, or runtime
delivery data as part of security maintenance.
