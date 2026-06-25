# ArchiveOS AX Implementation Status

ArchiveOS now tracks the `ARCHITECTURE_FULL.md` AX target as an executable roadmap.

## Implemented

- AX readiness API
  - `GET /api/ax/readiness`
  - `GET /api/ax/roadmap`
- Spring Boot module skeleton
  - `archiveos-ai`
  - Java 21
  - Spring Boot 3.x
  - `GET /api/health`
- Obsidian ingestion foundation
  - `POST /api/obsidian/sync`
  - `GET /api/obsidian/documents`
  - content hash based incremental sync
  - Markdown heading-aware chunking
  - code block preservation
- RAG MVP
  - `GET /api/rag/search?query=...`
  - `POST /api/rag/ask`
  - reference-first responses without frontend OpenAI exposure
- PostgreSQL / pgvector schema foundation
  - `obsidian_documents`
  - `obsidian_chunks`
  - `embedding vector(1536)`
- Docker assets
  - root frontend `Dockerfile`
  - backend `Dockerfile`
  - `archiveos-ai/Dockerfile`
  - `docker-compose.yml`

## Intentionally Guarded

- OpenAI calls are not exposed to the frontend.
- `OPENAI_API_KEY`, `DISCORD_WEBHOOK_URL`, service role keys, and vault paths remain backend-only.
- Codex, MCP, shell, deployment, and process control are not exposed as UI execution controls.
- RAG ask currently returns grounded references and a deterministic answer message until Spring AI credentials and approval gates are configured.

## Required Environment

Backend:

```bash
OPENAI_API_KEY=
OBSIDIAN_VAULT_PATH=
OBSIDIAN_CHUNK_SIZE=1200
OBSIDIAN_CHUNK_OVERLAP=160
DB_HOST=localhost
DB_PORT=5432
DB_NAME=archiveos
DB_USER=archiveos
DB_PASSWORD=archiveos
ARCHIVEOS_DEPLOY_COMPOSE_FILE=../docker-compose.yml
ARCHIVEOS_HEALTH_CHECK_URL=http://localhost:4000/health
```

Spring AI module:

```bash
cd archiveos-ai
gradle bootRun
```

Docker:

```bash
docker compose build
docker compose up
```

## Validation Notes

The current local machine has Java 21 available.

Local validation status:

- Frontend build: available through `npm run build`
- Backend typecheck/build/test: available through backend npm scripts
- Java runtime: available
- Gradle CLI: not currently available in PATH
- Docker CLI: not currently available in PATH

The Docker and Spring module files are committed so the same repository can run `gradle test`, `docker compose build`, and `docker compose up` once Gradle/Docker are installed or exposed in PATH.
