# Archive daily Slack digest

Archive host operations are summarized once per day instead of sending a disk and Nexus message every 30 minutes.

## Schedule

- Windows task: `Archive Daily Operations Digest`
- Trigger: every day at 09:00 Asia/Seoul
- Missed start: run as soon as the signed-in host becomes available
- Multiple instances: ignore a second start while the prior report is still running
- Script: `tools/ops/archive-daily-operations-digest.ps1`

The legacy `Archive Capacity and Nexus Monitor 30min` task is retained in a disabled state for rollback. It must not be enabled at the same time as the daily task.

## One-message report contract

The report contains the prior 24 hours of:

- ArchiveOS health and registered endpoint coverage;
- Archive Docker container availability and restart totals;
- Spring Batch success, failure, running counts and per-job latest state;
- legacy operations batch count and failures;
- Windows C: free space and Docker VHDX size with daily deltas;
- Nexus database, WAL, `pg_largeobject` relation size and logical metadata count;
- warnings for failed batches, stopped containers, low disk space, or Large Object recurrence.

The script reads metrics only. It does not start a batch, delete data, compact a VHDX, prune Docker, or mutate a database.

## Safe verification

Run the test without sending Slack or changing the daily baseline:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\ops\archive-daily-operations-digest-test.ps1
```

The production script also supports `-NoSend -NoPersist` for read-only diagnostics. Slack credentials remain in the existing runtime environment and are never written into the repository or report files.
