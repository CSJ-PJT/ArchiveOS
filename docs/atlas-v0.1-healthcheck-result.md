# Atlas v0.1 Healthcheck Result

## Scope

ArchiveOS was used as the Control Tower to verify the Atlas v0.1 production release status through read-only public healthchecks.

No Atlas SSH access, nginx modification, deployment, or secret output was performed.

## Targets

| Service | Endpoint | ArchiveOS result | HTTP status | Latency | Stored |
| --- | --- | --- | --- | --- | --- |
| Atlas Management | `http://161.33.17.84/` | ok | 200 | 384 ms | yes |
| Travel Atlas | `http://161.33.17.84/travel/` | ok | 200 | 172 ms | yes |
| Learn Atlas | `http://161.33.17.84/learn/` | ok | 200 | 200 ms | yes |
| Health Atlas | `http://161.33.17.84/health/` | ok | 200 | 196 ms | yes |
| Jobs Atlas | `http://161.33.17.84/jobs/` | ok | 200 | 195 ms | yes |
| Atlas API | `http://161.33.17.84/api/health` | failed | timeout | 3009 ms | yes |

## ArchiveOS Overview

- System: Atlas Platform
- Overall status after ArchiveOS healthcheck: `down_candidate`
- Reason: one or more Critical Atlas services failed healthcheck
- Failed service: `atlas-api`
- Error: `HttpTimeoutException: request timed out`

## Direct Read-Only Comparison

After the ArchiveOS healthcheck, the same six endpoints were checked once with direct read-only HTTP GET from the local machine. All six returned HTTP 200.

| Endpoint | Direct HTTP status | Direct latency |
| --- | --- | --- |
| `http://161.33.17.84/` | 200 | 575 ms |
| `http://161.33.17.84/travel/` | 200 | 211 ms |
| `http://161.33.17.84/learn/` | 200 | 208 ms |
| `http://161.33.17.84/health/` | 200 | 182 ms |
| `http://161.33.17.84/jobs/` | 200 | 204 ms |
| `http://161.33.17.84/api/health` | 200 | 436 ms |

## Work Log

ArchiveOS Codex Work Log was recorded:

- `Atlas v0.1 production healthcheck verification`
- Work log id: `b5c7624a-82f3-42b7-973c-f7d98f507215`

An earlier Korean work log was also stored, but the API response showed mojibake in Korean fields. The English work log above is the readable operational record.

## Finding

Atlas v0.1 public static routes are healthy through ArchiveOS:

- `/`
- `/travel/`
- `/learn/`
- `/health/`
- `/jobs/`

Atlas API was stored as failed in ArchiveOS because the configured healthcheck timeout was reached at 3009 ms. Direct comparison returned HTTP 200 shortly afterward, so the current classification is transient timeout or threshold sensitivity, not confirmed service outage.

## Next Actions

- Re-run ArchiveOS Atlas healthcheck after the Atlas API stabilization window.
- If the timeout repeats, either optimize `GET /api/health` response time or increase the ArchiveOS Atlas API timeout above 3000 ms.
- Keep Atlas server, nginx, and deployment unchanged for this verification step.
- If Jobs Atlas should remain part of the permanent ArchiveOS registry, add a dedicated ArchiveOS migration or seed update for `jobs-atlas`.
