# ArchiveOS Backend

ArchiveOS의 Node.js/Express backend는 PM 운영, Agent 상태, 런타임 가시화, Discord 알림, MCP 상태, 기존 Supabase 운영 데이터를 담당합니다.

Obsidian 수집, 임베딩, 벡터 검색, RAG 답변은 별도 Spring Boot 모듈인 `archiveos-ai`가 담당합니다.

## 역할 구분

### Node/Express backend

- Agent 및 작업 상태 조회
- PM 작업과 의사결정 기록
- 로컬 런타임 상태 수집
- Discord 알림
- MCP 큐 및 실행 상태 표시
- Supabase 운영 데이터 접근
- `archiveos-ai` API 프록시

### archiveos-ai

- Obsidian Markdown 수집
- 문서 chunking
- OpenAI embedding 생성
- PostgreSQL + pgvector 저장
- vector similarity search
- Spring AI 기반 RAG 답변

## 실행

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

기본 포트는 `4000`입니다.

## 환경 변수

```env
PORT=4000
CORS_ALLOWED_ORIGINS=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
DISCORD_WEBHOOK_URL=
ARCHIVEOS_PROJECT_PATH=
MCP_REPO_PATH=
MCP_QUEUE_PATH=
CODEX_IMPLEMENTER_PID=
CODEX_REVIEWER_PID=
```

### 보안 원칙

- `SUPABASE_SERVICE_ROLE_KEY`는 backend에서만 사용합니다.
- 민감한 값에 `VITE_` 접두사를 붙이지 않습니다.
- API Key, DB 비밀번호, webhook URL은 로그에 출력하지 않습니다.
- 임의 shell 문자열을 직접 실행하지 않습니다.
- 로컬 실행 명령은 allowlist 기반 action ID로 제한합니다.

## 주요 API

### 상태 확인

```http
GET /health
```

### 작업 로그

```http
GET /api/work-logs/recent
POST /api/work-logs
```

### 명령 기록

```http
GET /api/commands/recent
POST /api/commands
```

현재 명령 API는 사용자의 의도를 기록하는 용도이며 임의 명령을 실행하지 않습니다.

### 로컬 action

```http
GET /api/local-actions/projects
POST /api/local-actions/run
```

허용된 action 예시:

- `git_status`
- `git_branch`
- `git_log_recent`
- `frontend_build`
- `backend_typecheck`
- `backend_build`

### 로컬 런타임

```http
GET /api/local-runtime/status
```

Codex loop, implementer/reviewer process, MCP queue 상태를 읽기 전용으로 제공합니다.

## RAG 프록시

다음 endpoint는 `ARCHIVEOS_AI_BASE_URL`의 Spring AI 서비스로 전달됩니다.

```http
POST /api/obsidian/sync
GET /api/obsidian/documents
GET /api/rag/search?query=...
POST /api/rag/ask
```

`archiveos-ai`가 준비되지 않은 경우 placeholder 응답 대신 명확한 오류를 반환합니다.

## PM 작업 흐름

주요 상태 흐름:

```text
queued
  -> architect_review
  -> ready_for_build
  -> building
  -> review
  -> pm_decision_required
  -> approved | rejected | hold | failed | done
```

관련 API와 데이터는 다음 단위로 관리합니다.

- `pm_tasks`
- `pm_task_decisions`
- `pm_task_events`
- `architecture_reviews`
- `command_runs`

## 배치 작업

### Nightly Review

```bash
npm run batch:nightly-review
```

- MCP queue 상태 수집
- builder/reviewer 결과 요약
- 최근 command 및 decision 집계
- `batch_runs` 기록

### Daily Report

```bash
npm run batch:daily-report
```

- Asia/Seoul 기준 일일 운영 요약
- Discord 알림 조건 판단
- 휴일과 주말에 대한 fail-safe 처리
- Historian export 기록

## 테스트 및 빌드

```bash
npm run test
npm run typecheck
npm run build
```

## 운영 원칙

- 실행보다 관찰 가능성을 우선합니다.
- Agent 결과와 PM 결정을 분리해 기록합니다.
- 실패 원인과 재시도 이력을 보존합니다.
- 위험한 실행은 승인 게이트 이후에만 허용합니다.
- Node backend와 Spring AI backend의 책임을 중복시키지 않습니다.

## 관련 문서

- [루트 README](../README.md)
- [전체 아키텍처](../docs/ARCHITECTURE_FULL.md)
- [AX 구현 상태](../docs/AX_IMPLEMENTATION_STATUS.md)
- [런타임 보안](../docs/runtime-security.md)
- [Obsidian 연동 전략](../docs/obsidian-integration-strategy.md)
