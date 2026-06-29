# ArchiveOS Runtime Security

ArchiveOS supports mobile/ngrok visibility, but PM Decision and Task Queue CUD actions need a protection model before they are exposed beyond a trusted local environment.

This document describes the current security readiness layer.

## Current Scope

- Read-only dashboards remain available.
- PM Decision, Task Queue creation/update/retry, and Queue Run Once are marked as protected CUD endpoints.
- Enforcement is currently `report_only` until ngrok OAuth headers and approved device policy are confirmed.
- Slack bot tokens and webhook URLs, Supabase service role keys, Obsidian vault paths, and other secrets are never exposed in the frontend.
- No Codex, MCP, shell, deployment, or process control is added.

## Environment Variables

```env
NGROK_OAUTH_PROVIDER=
NGROK_ALLOWED_EMAILS=
NGROK_ALLOWED_DOMAINS=
ARCHIVEOS_AUTHENTICATION_ENABLED=
ARCHIVEOS_DEVICE_APPROVAL_ENABLED=
ARCHIVEOS_PM_ROLE_ENABLED=
ARCHIVEOS_ADMIN_ROLE_ENABLED=
```

## Role Model

- `viewer`: read-only access to Dashboard, Operators, Timeline, Knowledge, Mesh, KPI, and Settings status.
- `pm`: viewer permissions plus PM decision recording, task approval/rejection/hold, and retry request.
- `admin`: pm permissions plus runtime configuration, device approval, and integration management readiness.

## Device Approval

Approved devices are tracked in a backend-local registry:

```text
backend/data/approved-devices.json
```

This file is intentionally ignored by git. The frontend only receives counts and readiness status, never the local file path.

Policy target:

- authenticated + approved device: PM actions allowed
- authenticated + unapproved device: read-only
- unauthenticated: read-only

## Protected Endpoints

- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/decision`
- `POST /api/tasks/:id/retry`
- `POST /api/queue/run-once`

The current implementation reports these endpoints as protected and ready for PM/admin gating. Full enforcement should be enabled after the ngrok OAuth provider, allowed emails/domains, and device approval workflow are finalized.

## Slack Security Notifications

ArchiveOS sends backend-only Slack notifications for security-sensitive events through Spring Boot:

- new device detected
- device approved
- device denied
- PM decision executed
- admin configuration changed

Notification delivery uses `SLACK_BOT_TOKEN` and `SLACK_CHANNEL`, or the optional `SLACK_WEBHOOK_URL`, in the Java runtime only. A Slack failure does not fail the PM action.
