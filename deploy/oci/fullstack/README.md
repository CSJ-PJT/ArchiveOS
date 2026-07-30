# ArchiveOS OCI Full-Stack Parity v1

This package prepares an isolated OCI canary for ArchiveOS source revision
`c2324df9a935e897fbe8be94068f862c4ac3956f`. It does not perform production
DNS cutover, merge to `main`, or enable a second active scheduler/collector.

## Scope and exclusions

Included:

- immutable frontend, Node backend, and ArchiveOS AI images;
- PostgreSQL 16 with pgvector on attached persistent storage;
- Obsidian Vault, runtime queue, backup, and secret-loading contracts;
- private Compute placement behind an OCI Flexible Load Balancer;
- canary-safe Compose, systemd, Terraform, migration, verification, backup,
  and rollback assets.

Excluded:

- Archive-World and its mounts/builds;
- Archive-lite commit `ebd5928`;
- Runtime timeline projection commit `554334a`;
- product UI/backend/AI changes;
- production DNS changes and production cutover.

## Archive World Mini handoff boundary

ArchiveOS never builds, edits, mounts, or commits the Archive-World repository.
The only accepted input is a World PM release handoff with an immutable OCIR
reference (`archive-world/mini@sha256:...`) or an equivalently immutable tar
artifact. Before a canary deployment, run:

```powershell
.\deploy\oci\fullstack\scripts\verify-world-handoff.ps1 `
  -HandoffRoot <verified-handoff-directory> `
  -MiniArtifactRoot <extracted-immutable-artifact> `
  -WorldSourceHead <40-character-world-sha> `
  -ImageDigest <ocir-image@sha256:digest>
```

The handoff must contain the Mini viewer, `world-mini-map.json`, `status.json`,
the dated snapshot/current-state evidence, a read-only adapter manifest, and a
`provenance.json`. The provenance schema is `1.0.0` and must include the
required source/checksum fields plus additive `bundlePath` and `bundleSha256`
fields so the immutable viewer bundle can be verified. Its protection flags
must all remain `false`: `canonical`, `v3Applied`, `runtimeMutation`, and
`mainMerge`.

The validator rejects missing source SHA, checksum mismatch, non-13-District
maps, invalid coordinates, negative scales, anchor mismatch, failed technical
status, or any protection-flag violation. `WORLD_MINI_VISUAL_PARTIAL` and
`WORLD_MINI_RELEASE_PARTIAL` are intentionally preserved; ArchiveOS runtime
health never upgrades World visual/release status.

If `runtime-bindings.json` is not supplied by World PM and verified against the
same World source SHA and manifest SHA, the Mini viewer must show
`SPATIAL_BINDING_NOT_PROVIDED` and use only a whole-map/runtime-panel pulse.
ArchiveOS must not infer a mapping from its five logical Runtime areas to the
World's thirteen physical Districts.

## Current OCI inventory

The read-only survey on 2026-07-30 found:

- region: `ap-osaka-1`;
- two existing VCNs and two public subnets;
- two running `VM.Standard.E2.1.Micro` instances with public IPs;
- no private subnet, NAT Gateway, Service Gateway, NSG, Load Balancer,
  OCIR repository, Vault/Secret, attached Block Volume, Object Storage bucket,
  or Dynamic Group suitable for this deployment.

The existing Atlas and Studio micro instances are not reused. They are public,
resource-constrained, and owned by unrelated workloads. Provisioning the
resources in this package requires explicit cost approval.

## Target architecture

```text
Internet
  -> OCI Flexible Load Balancer :443
     -> private Compute VM :8080
        -> frontend Nginx
           -> backend:4000
               -> archiveos-ai:4100
                  -> postgres:5432
                  -> /srv/archiveos/vault
                  -> /srv/archiveos/world-handoff/archive-world-assets.json (read-only)
                  -> OpenAI HTTPS
         -> archive-world-mini:4190 (private only)
```

Only frontend port 8080 is published on the VM, and its NSG accepts traffic
only from the Load Balancer NSG. Backend, AI, and PostgreSQL have no host
published ports. The World Mini container has no host port, database, source
repository mount, or Generated-root mount. The Compute VNIC has no public IP.

The frontend's OCI-only Nginx configuration keeps `/api/*` on the ArchiveOS
backend and proxies the independent sibling route without removing its prefix:

- `/archive-world-mini/*` -> `archive-world-mini:4190/archive-world-mini/*`
- `/archive-world-mini/status.json` and `world-mini-map.json` -> `no-store`
- hashed Mini assets -> immutable cache
- `/api/world/stream` -> HTTP/1.1 unbuffered SSE with cache disabled

Canary access must use a private hostname or approved CIDR and returns
`X-Robots-Tag: noindex, nofollow` for Mini World content. Do not proceed to a
public production cutover without Load Balancer/WAF allowlisting, VPN, bastion,
or an approved authentication proxy.

## Paid default proposal

The Terraform defaults propose:

- one `VM.Standard.E4.Flex`, 2 OCPU, 16 GB memory;
- 100 GB boot volume and 200 GB balanced Block Volume;
- one 10 Mbps Flexible Load Balancer;
- one private subnet, NAT Gateway, Service Gateway, and two NSGs;
- one private Object Storage backup bucket;
- OCI Certificates, Vault/Secrets, and instance-principal IAM.

Using the public list rates as a planning estimate, Compute is approximately
USD 70.82/month and 300 GB balanced block/boot storage approximately
USD 12.75/month. The first 10 Mbps Flexible Load Balancer allocation may be
free when the tenancy is eligible. Object Storage, OpenAI usage, DNS,
certificate, backup growth, taxes, and account-specific Osaka adjustments are
additional. Confirm with the OCI Cost Estimator before `terraform apply`.

## Immutable image flow

Run from the clean source worktree:

```powershell
.\deploy\oci\fullstack\scripts\build-images.ps1
.\deploy\oci\fullstack\scripts\push-images.ps1 `
  -Region ap-osaka-1 `
  -Namespace <ocir-namespace>
```

The scripts use only the full source SHA as the tag and emit digest references.
The VM must deploy `@sha256:` references; it must not build source.

OCI repositories required:

- `archiveos/frontend`
- `archiveos/backend`
- `archiveos/ai`

## Secret Management

Create `/etc/archiveos/secret-ocids.env` on the VM with root ownership and mode
`0600`. It maps variable names to OCI Secret OCIDs, not values:

```text
DB_NAME=ocid1.vaultsecret...
DB_USER=ocid1.vaultsecret...
DB_PASSWORD=ocid1.vaultsecret...
OPENAI_API_KEY=ocid1.vaultsecret...
ARCHIVEOS_ADMIN_PASSWORD=ocid1.vaultsecret...
ARCHIVE_TOKEN_MARKET_TO_OS=ocid1.vaultsecret...
ARCHIVE_TOKEN_NEXUS_TO_OS=ocid1.vaultsecret...
ARCHIVE_TOKEN_LOGISTICS_TO_OS=ocid1.vaultsecret...
ARCHIVE_TOKEN_LEDGER_TO_OS=ocid1.vaultsecret...
ARCHIVE_TOKEN_OS_TO_LEDGER=ocid1.vaultsecret...
ARCHIVE_TOKEN_AUTHENTICATED_READ=ocid1.vaultsecret...
ARCHIVE_TOKEN_ADMIN_OPERATOR=ocid1.vaultsecret...
ARCHIVEOS_INTEGRATION_TOKEN=ocid1.vaultsecret...
```

Create `/etc/archiveos/archiveos.oci.conf` for non-secret values based on
`env/archiveos.oci.env.example`. The loader reads secrets with the Compute
instance principal and writes `/run/archiveos/archiveos.env` as root:root
`0600`. It removes the file when the service stops.

The non-secret OCI configuration also requires the immutable World image
digest, World source HEAD, and adapter manifest SHA. The handoff manifest is
stored only at `/srv/archiveos/world-handoff/archive-world-assets.json` and
mounted read-only at `/world-handoff/archive-world-assets.json` into ArchiveOS
AI.

Never place secret values in Git, Terraform variables/state outputs, cloud-init,
Docker build arguments, service unit files, or shell history.

## Provisioning sequence

1. Review `terraform plan`; do not apply without cost approval.
2. Provision the private network, Compute, storage, Load Balancer, bucket,
   Dynamic Group, and policy.
3. Provision an OCI certificate and OCI Secret entries separately; Terraform
   intentionally does not manage secret payloads.
4. Install the runtime and attach/mount Block Volume:

   ```bash
   sudo deploy/oci/fullstack/scripts/install-runtime.sh
   sudo deploy/oci/fullstack/scripts/mount-storage.sh /dev/oracleoci/oraclevdb
   ```

   Formatting requires the explicit `--format` switch and confirmation that
   the device is the newly provisioned empty volume.

5. Copy this exact source revision to `/opt/archiveos` for Compose and
   operational assets only. Do not build on the VM.
6. Install the systemd units and secret mapping.
7. Load secrets and run `deploy-canary.sh`.

## Data and Vault migration

The source database remains read-only. Use:

```powershell
.\deploy\oci\fullstack\scripts\migrate-data.ps1 -Mode Inventory
.\deploy\oci\fullstack\scripts\migrate-data.ps1 -Mode Dump
```

The dump is custom format, checksummed, transferred through SSH, and restored
only when `-ConfirmTargetRestore` is supplied. The restore target must be the
empty disposable canary database; the script does not drop or clean an existing
database. `Compare` checks core table row counts. Review Flyway history and
schema diffs before application startup.

For Vault migration, produce a manifest without file contents:

```bash
find /approved/source/vault -type f -printf '%P\0' |
  sort -z | xargs -0 -r sha256sum --tag > vault.sha256
```

Copy over an encrypted/private channel, regenerate the manifest under
`/srv/archiveos/vault`, and require exact path, count, byte, and SHA-256 match.
The Vault must not be committed or exposed publicly.

## Canary safety

The OCI overlay enforces:

- `ARCHIVEOS_SCHEDULER_ENABLED=false`
- `ARCHIVE_LIVE_FLOW_COLLECTOR_ENABLED=false`
- `ARCHIVE_INTEGRATION_SAFE_MODE=true`
- `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=false`
- `ARCHIVE_INTEGRATION_CALLBACK_ENABLED=false`
- `ARCHIVE_WORLD_ADAPTER_MODE=live`

Runtime service endpoints must be approved private or HTTPS endpoints. Localhost,
`127.0.0.1`, and `host.docker.internal` are rejected by preflight.

## Verification

First run the product's unchanged local contract:

```powershell
.\tools\runtime\verify-rag-e2e.ps1
```

For OCI, inject credentials through process environment only and run:

```powershell
.\deploy\oci\fullstack\scripts\verify-fullstack.ps1 `
  -BaseUrl https://archiveos-canary.example.com
```

The wrapper validates Public/PM/Admin boundaries, Managed Systems, pgvector,
real OpenAI Chat/Embedding checks, Obsidian sync, RAG search/ask evidence,
Spring Batch, RPA classification/decision records, Live Flow/SSE, and the
official correlation through the frontend/backend path. It prints no credential
values or RAG answer contents. It intentionally creates only canary validation
records, so run it exclusively against the disposable canary database copy,
never against the current production database.

Browser parity additionally requires manual/automated screenshots at desktop
and mobile widths for all Console V3 routes, refresh/history behavior, zero
console errors, and asset checksum equality with the locally built frontend.

World Mini canary smoke additionally requires the sibling route, `index.html`,
status, map, hashed assets, no stale data cache, pan/zoom/reset/layer/LOD and
validation UI, desktop/mobile screenshots, `/api/world/state`,
`/api/world/events`, and `/api/world/stream`. The stream must distinguish
persisted `world-event` frames from heartbeats and reconnect with bounded
backoff. It must not create or invent Runtime events.

### Source-level integration blocker discovered before OCI provisioning

An isolated disposable PostgreSQL smoke against this exact source SHA exposed a
real PM Inbox write failure: Admin acknowledge/resolve reaches the repository
but PostgreSQL rejects the upsert because `acknowledged_at` / `resolved_at` is
an ambiguous column reference. Public 401 and PM 403 boundaries still pass.

This deployment branch does not change product code, so the defect remains a
separate ArchiveOS RC maintenance item. OCI provisioning may be planned, but
`FULL_PARITY_PASS` and production cutover are prohibited until a product-code
fix is approved, tested, and incorporated into a separately approved source
revision.

## Backup and rollback

`backup.sh` creates:

- custom-format PostgreSQL dump;
- Vault archive and per-file SHA-256 manifest;
- aggregate checksums;
- optional upload to the private Object Storage bucket.

Configure Object Storage lifecycle retention separately; the script does not
delete backups. Schedule Block Volume backups and perform a restore test before
cutover.

`rollback.sh` changes only immutable image digest references and recreates
services. It does not delete or reset PostgreSQL, Vault, runtime, or backup
data.

`rollback-world-mini.sh <previous-image@sha256:...>` is intentionally separate.
It updates only the non-secret Mini image reference and recreates only
`archive-world-mini`. Dynamic Docker DNS in the OCI Nginx route lets the
existing ArchiveOS frontend keep proxying to the replacement; backend, AI,
PostgreSQL, ArchiveOS data, and the World source remain untouched.

## Cutover gate

Canary success is not production approval. Report
`READY_FOR_OCI_FULLSTACK_CUTOVER` only after:

- immutable local/OCIR/Compose digests match;
- DB schema, Flyway history, core row counts, Vault manifest, and official
  correlation match;
- RAG uses real OpenAI models and returns evidence;
- all UI, auth, PM Inbox, Live Flow/SSE, Runtime, Knowledge, Batch, RPA, and
  Audit gates pass;
- World source provenance, protection flags, Mini route/data/UI, and read-only
  World adapter/stream gates pass;
- backup restore is proven;
- the existing deployment and OCI cannot both run scheduler/collector writes.

Production DNS, write freeze, final dump, active scheduler election, and old
deployment shutdown require separate OS PM approval.
