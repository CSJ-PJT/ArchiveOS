# ArchiveOS PostgreSQL credential rotation plan

## Scope

This is a runbook only. It does not rotate credentials, recreate volumes, or expose credential values.

The current database owner and application login are resolved from the non-tracked Compose environment (`POSTGRES_USER` and `DB_USER`). Confirm their role names inside the database immediately before the change with a privileged, local-only session; do not copy passwords into tickets, logs, screenshots, or this document.

## Preconditions

1. Schedule a maintenance window and stop write-producing runtime jobs.
2. Record the active ArchiveOS container image and migration version.
3. Take a logical backup using a local secret-managed administrator session. Verify the backup can be listed and restore-tested in an isolated database.
4. Preserve the existing PostgreSQL volume. Do not use `docker compose down -v` or remove volumes.
5. Create a new least-privilege application role and a separate owner/migration role if the deployment model requires it. Generate passwords in the OS secret store or an untracked local environment file.

## Rotation procedure

1. Create the new roles and grant only the schema/table/sequence permissions required by ArchiveOS.
2. Verify a new application connection with the new role while the current application is still running.
3. Update only non-tracked runtime configuration for ArchiveOS:
   - `DB_USER`
   - `DB_PASSWORD`
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` only when an owner-role rotation is explicitly intended
4. Recreate ArchiveOS PostgreSQL clients and ArchiveOS services one at a time. Keep the database volume mounted unchanged.
5. Confirm Flyway reports the same applied migration set, health is UP, and read-only smoke endpoints work.
6. Confirm pre-rotation row counts for `ecosystem_flow_event`, AI-operation tables, approval records, and audit records are unchanged.
7. Revoke the old application role's login only after the new connection has stayed healthy through the agreed observation window. Retain owner-role rollback access until the backup and restore check are signed off.

## Rollback

1. Stop only the affected ArchiveOS application container.
2. Restore the previous non-tracked connection variables.
3. Recreate the application container against the preserved volume.
4. Validate health, Flyway version, and read-only row counts.
5. Do not restore a backup over a healthy volume merely to roll back credentials.

## Validation checklist

- New role can connect and query required schema objects.
- ArchiveOS health endpoint is UP.
- Flyway checksum and version are unchanged.
- Existing synthetic runtime events remain readable.
- No password, JDBC URL containing credentials, or secret appears in Docker inspect output, application logs, screenshots, or Git status.
- Old login is revoked only after the new login has been validated.
