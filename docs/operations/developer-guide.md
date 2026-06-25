# ArchiveOS Developer Guide

이 문서는 ArchiveOS를 로컬 Docker 기반 PostgreSQL + pgvector 환경에서 실행하고 Spring AI RAG End-to-End 흐름을 검증하는 절차를 정리한다.

## 1. Docker Desktop 설치 상태 확인

Windows에서 다음 경로를 확인한다.

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

### PATH만 빠진 경우

Docker Desktop은 설치되어 있는데 `docker` 명령만 실패하면 현재 세션에 PATH를 추가한다.

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
docker --version
docker compose version
```

영구 반영은 Windows 환경 변수 `Path`에 아래 경로를 추가한다.

```text
C:\Program Files\Docker\Docker\resources\bin
```

### Docker Desktop이 실행 중이 아닌 경우

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Docker Desktop 시작 후 `docker info`가 성공할 때까지 기다린다.

### Docker Desktop이 설치되지 않은 경우

관리자 PowerShell에서 설치한다.

```powershell
choco install docker-desktop -y
```

관리자 권한이 아니면 설치가 실패할 수 있다. 이 경우 관리자 PowerShell을 새로 열어 설치한다.

## 2. 환경 파일

루트 `.env`에는 다음 값이 필요하다.

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

`docker-compose.yml` 내부에서는 `archiveos-ai`가 compose 네트워크의 `postgres` host를 사용한다.

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

`/api/obsidian/sync`가 처음 실행될 때 schema와 HNSW index가 생성된다.

## 5. RAG End-to-End 검증

자동 검증:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/runtime/verify-rag-e2e.ps1
```

검증 스크립트는 secret 노출을 막기 위해 compose config 원문과 API 본문 전체를 출력하지 않는다. 출력은 health, pgvector, sync, search, ask, Node proxy의 요약 상태만 포함한다.

수동 검증:

```powershell
curl http://localhost:4100/api/health
curl http://localhost:4100/api/ai/runtime
curl -X POST http://localhost:4100/api/ai/runtime/check
curl -X POST http://localhost:4100/api/obsidian/sync
curl "http://localhost:4100/api/rag/search?query=ArchiveOS&limit=5"
curl -X POST http://localhost:4100/api/rag/ask -H "Content-Type: application/json" -d "{\"question\":\"Summarize the ArchiveOS Spring AI RAG architecture.\"}"
curl http://localhost:4000/api/ai/runtime
curl -X POST http://localhost:4000/api/ai/runtime/check
```

성공 기준:

- `vectorStore.databaseConnected=true`
- `vectorStore.extensionInstalled=true`
- `vectorStore.indexReady=true`
- sync 후 documents/chunks/embeddedChunks 증가
- search 결과에 `score` 포함
- ask 결과에 `answer`와 `references` 포함
- runtime에 `lastLatencyMs`, `lastReferenceCount` 기록
- 응답에 secret 값 미노출

## 6. archiveos-ai unavailable proxy 확인

`archiveos-ai`를 끈 상태에서 Node backend proxy는 fake healthy를 반환하지 않고 HTTP 503을 반환해야 한다.

```powershell
docker compose stop archiveos-ai
curl http://localhost:4000/api/ai/runtime
docker compose start archiveos-ai
```

## 7. Test / Build

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

## 8. Docker가 없는 환경

Docker CLI가 없으면 다음 항목은 실행할 수 없다.

- `docker --version`
- `docker compose version`
- `docker info`
- `docker compose config`
- 실제 pgvector container E2E 검증

이 경우에도 코드 test/build, 문서 정리, 정적 compose 설정 확인은 계속 수행한다. 실제 E2E는 Docker Desktop 설치 후 이 문서의 절차를 다시 실행한다.
