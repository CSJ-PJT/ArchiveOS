# ArchiveOS Security

ArchiveOS is under active development and is not yet a production authentication boundary.

## Operating guidance

- Keep PostgreSQL and internal backend ports on the local machine.
- Share only the frontend through a private network.
- Do not publish write APIs directly to the public internet.
- Keep local configuration and runtime state outside version control.
- Treat forwarded identity headers as untrusted unless they come from a verified proxy.

## Before production

Add authenticated sessions, server-side role enforcement, audit records, restricted database policies, trusted proxy configuration and automated dependency checks.
