# ArchiveOS Developer Guide

이 문서는 ArchiveOS를 로컬 Docker 기반 PostgreSQL + pgvector 환경에서 실행하고 Spring AI RAG / Spring Batch / RPA 흐름을 검증하는 절차를 정리한다.

## 1. Docker Desktop 설치 상태 확인

Windows 기준 확인 경로:

```powershell
Test-Path "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Test-Path "C:\ProgramData\DockerDesktop"
```

CLI 확인:

```powershell
docker --version
docker compose version
docker info
```

Docker Desktop은 설치되어 있으나 현재 세션 PATH만 빠진 경우:

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
docker --version
docker compose version
```

Docker Desktop이 실행 중이 아니면:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

## 2. 환경 파일

루트 `.env`에는 다음 값이 필요하다. 실제 secret은 커밋하지 않는다.

```env
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
DB_HOST=localhost
DB_PORT=5432
DB_NAME=archiveos
DB_USER=archiveos
DB_PASSWORD=archiveos
HOST_OBSIDIAN_VAULT_PATH=./docs
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
```

Docker Compose 내부에서 `archiveos-ai`는 `postgres` host로 DB에 접속한다.

## 3. Compose 실행

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

정상 상태:

- `postgres`: running / healthy
- `archiveos-ai`: running
- `backend`: running
- `frontend`: running

## 4. PostgreSQL + pgvector 확인

```powershell
docker compose exec -T postgres psql -U archiveos -d archiveos -c "create extension if not exists vector;"
docker compose exec -T postgres psql -U archiveos -d archiveos -c "select extname, extversion from pg_extension where extname = 'vector';"
docker compose exec -T postgres psql -U archiveos -d archiveos -c "select to_regclass('public.obsidian_documents'), to_regclass('public.obsidian_chunks');"
```

`/api/obsidian/sync`가 실행되면 schema와 HNSW index가 생성된다.

## 5. 자동 E2E 검증

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1
```

이미 compose가 실행 중이고 종료하지 않으려면:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1 -SkipComposeUp -KeepRunning
```

검증 스크립트는 secret 노출을 막기 위해 compose config 원문과 API 본문 전체를 출력하지 않고 상태 요약만 출력한다.

## 6. 수동 RAG / Batch / RPA 검증

```powershell
curl http://localhost:4100/api/health
curl http://localhost:4100/api/ai/runtime
curl -X POST http://localhost:4100/api/ai/runtime/check
curl -X POST http://localhost:4100/api/obsidian/sync
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
curl -X POST http://localhost:4100/api/rag/ask -H "Content-Type: application/json" -d "{\"question\":\"Summarize the ArchiveOS Spring AI RAG architecture.\"}"

curl http://localhost:4100/api/batch/jobs
curl -X POST http://localhost:4100/api/batch/jobs/ragHealthCheckJob/run
curl "http://localhost:4100/api/batch/executions?limit=5"

curl -X POST http://localhost:4100/api/rpa/classify -H "Content-Type: application/json" -d "{\"title\":\"Verify RAG deployment\",\"description\":\"Check pgvector schema and deployment risk before running any shell commands.\",\"targetProject\":\"ArchiveOS\"}"
curl -X POST http://localhost:4100/api/rpa/tasks/{taskId}/decision -H "Content-Type: application/json" -d "{\"action\":\"approve\",\"reason\":\"PM approved the classification record only.\",\"decidedBy\":\"pm\"}"

curl http://localhost:4000/api/ai/runtime
curl http://localhost:4000/api/batch/jobs
```

성공 기준:

- `vectorStore.databaseConnected=true`
- `vectorStore.extensionInstalled=true`
- `vectorStore.indexReady=true`
- sync 후 documents/chunks/embeddedChunks 증가
- search 결과에 `score` 포함
- ask 결과에 `answer`와 `references` 포함
- batch job catalog에 `obsidianSyncJob`, `ragHealthCheckJob`, `archiveosRpaClassifyJob` 표시
- `ragHealthCheckJob` 실행 이력이 Spring Batch metadata에 기록
- RPA classify가 `pm_approval_required`와 risk/recommendation 기록
- RPA decision이 `archiveos_rpa_decisions`에 기록
- 응답에 API key, DB password, webhook URL, vault 절대 경로 미노출

## 7. archiveos-ai unavailable proxy 확인

`archiveos-ai`가 꺼져 있으면 Node backend proxy는 fake healthy를 반환하지 않아야 한다.

```powershell
docker compose stop archiveos-ai
curl http://localhost:4000/api/ai/runtime
docker compose start archiveos-ai
```

## 8. Test / Build

```powershell
npm run test
npm run build

cd backend
npm run test
npm run typecheck
npm run build

cd ..\archiveos-ai
.\gradlew.bat test --no-daemon
.\gradlew.bat bootJar --no-daemon
```

## 9. Docker가 없는 환경

Docker CLI가 없으면 다음 검증은 수행할 수 없다.

- `docker --version`
- `docker compose version`
- `docker info`
- `docker compose config`
- 실제 pgvector container E2E 검증

이 경우에도 코드 test/build, 문서 정리, compose 설정 정적 확인은 계속 수행한다. 실제 E2E는 Docker Desktop 설치 후 다시 실행한다.
