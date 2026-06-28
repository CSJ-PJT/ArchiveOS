# Java backend migration status

Updated: 2026-06-28

## Local commits not yet confirmed on GitHub

- `4e2105d feat: improve Spring AI runtime`
- `1566de8 fix: runtime stability improvements`
- `2541fba docs: inventory existing backend for Java migration`
- `a0b7e02 feat: migrate core runtime APIs to Java`
- `7df5496 fix: allow AI runtime degraded startup`

## Completed locally

- Java migration inventory document
- Shared ChatModel and EmbeddingModel gateways
- Database and pgvector readiness checks
- Java versions of health and runtime APIs
- Controller and Service tests
- Node 24 Docker image
- Frontend, Node backend, and Java build verification
- PostgreSQL, pgvector, and frontend runtime verification

## Remaining work

- Diagnose why the Java container exits in degraded mode
- Prevent provider configuration from stopping the whole application
- Recheck Compose and API behavior
- Commit the remaining Gradle Docker cache change
- Push the migration branch and open a pull request

## Notes

Brand files are outside the scope of this migration.
