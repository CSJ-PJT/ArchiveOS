# ArchiveOS Runtime Security

ArchiveOS supports mobile/ngrok visibility, but PM Decision and Task Queue CUD actions need a protection model before they are exposed beyond a trusted local environment.

This document describes the current security enforcement layer.

## Current Scope

- Public users can read non-sensitive dashboards and platform status.
- PM Decision, Task Queue creation/update/retry, Queue Run Once, batch run, and integration callbacks are protected CUD endpoints.
- Spring Boot enforces API authorization. The Node compatibility API performs the same guard before proxying legacy routes.
- Slack bot tokens and webhook URLs, Supabase service role keys, Obsidian vault paths, and other secrets are never exposed in the frontend.
- No Codex, MCP, shell, deployment, or process control is added.

## Environment Variables

```env
ARCHIVEOS_ADMIN_PASSWORD=
ARCHIVEOS_INTEGRATION_TOKEN=
ARCHIVEOS_SESSION_TIMEOUT_MINUTES=30
ARCHIVEOS_LOGIN_MAX_ATTEMPTS=5
ARCHIVEOS_LOGIN_LOCKOUT_MINUTES=15
ARCHIVEOS_SECURE_COOKIE=false
```

`ARCHIVEOS_ADMIN_PASSWORD` may be a local plain password for development or a bcrypt hash for operations. When a bcrypt value (`$2a$`, `$2b$`, `$2y$`) is supplied, ArchiveOS verifies login attempts against that hash without committing the secret.

## Role Model

- `PUBLIC`: read-only access to non-sensitive APIs. Settings details, audit logs, and CUD operations are not available.
- `OPERATOR`: operational read access to timeline and registry views. Risky actions remain blocked.
- `PM`: approval, rejection, hold, retry, and workflow decision actions.
- `ADMIN`: all platform actions, including batch/manual operations and integration callbacks.

## Device Approval

Approved devices are tracked in a backend-local registry:

```text
backend/data/approved-devices.json
```

This file is intentionally ignored by git. The frontend only receives counts and readiness status, never the local file path.

Policy target:

- authenticated admin session: all actions allowed until session timeout
- authenticated PM session: PM decision actions allowed
- authenticated operator session: operational read views only
- valid `X-ArchiveOS-Integration-Token`: service-to-service admin authority for Archive-Nexus callbacks
- unauthenticated/public: read-only

## Protected Endpoints

- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/decision`
- `POST /api/tasks/:id/retry`
- `POST /api/tasks/:id/callback`
- `POST /api/queue/run-once`
- `POST /api/batch/**`

The current implementation rejects unauthorized CUD requests at the backend. Frontend hiding is only a convenience layer and is not treated as the security boundary.

## Archive-Nexus Service Token

Archive-Nexus must call ArchiveOS through the Node compatibility API or direct Spring API with:

```http
X-ArchiveOS-Integration-Token: <ARCHIVEOS_INTEGRATION_TOKEN>
```

The same secret value is injected through each project's local `.env`. It is never committed. When the token is missing or mismatched, Archive-Nexus workflow creation, approval sync, and action callback requests are rejected as unauthenticated/forbidden CUD operations.

## Slack Security Notifications

ArchiveOS sends backend-only Slack notifications for security-sensitive events through Spring Boot:

- new device detected
- device approved
- device denied
- PM decision executed
- admin configuration changed

Notification delivery uses `SLACK_BOT_TOKEN` and `SLACK_CHANNEL`, or the optional `SLACK_WEBHOOK_URL`, in the Java runtime only. A Slack failure does not fail the PM action.
