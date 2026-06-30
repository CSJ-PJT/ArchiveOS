# ArchiveOS Backend

ArchiveOS Node.js/Express backend는 기존 API 호환과 Spring Boot 위임을 담당하는 점진적 마이그레이션 계층이다.

Obsidian 수집, embedding, vector search, RAG 답변, Spring Batch 기반 Intelligent RPA 판단은 별도 Spring Boot 모듈인 `archiveos-ai`가 담당한다.

## 역할 구분

### Node/Express backend

- Agent 및 작업 상태 조회
- PM 작업과 의사결정 기록
- 로컬 runtime 상태 수집
- Spring Boot Slack 알림 API 위임
- MCP 및 실행 상태 표시
- Supabase 운영 데이터 접근
- `archiveos-ai` API proxy

### archiveos-ai

- Obsidian Markdown 수집
- 문서 chunking
- OpenAI embedding 생성
- PostgreSQL + pgvector 저장
- vector similarity search
- Spring AI 기반 RAG 답변
- Spring Batch 기반 Intelligent RPA 작업 분류

## 실행

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

기본 포트는 `4000`이다.

## 환경 변수

```env
PORT=4000
CORS_ALLOWED_ORIGINS=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
ARCHIVEOS_PROJECT_PATH=
MCP_REPO_PATH=
MCP_QUEUE_PATH=
CODEX_IMPLEMENTER_PID=
CODEX_REVIEWER_PID=
```

## 보안 원칙

- `SUPABASE_SERVICE_ROLE_KEY`는 backend에서만 사용한다.
- 민감한 값에 `VITE_` 접두사를 붙이지 않는다.
- API Key, DB 비밀번호, webhook URL은 로그에 출력하지 않는다.
- 임의 shell 문자열을 직접 실행하지 않는다.
- 로컬 실행 명령은 allowlist 기반 action ID로 제한한다.

## 주요 API

### 상태 확인

```http
GET /health
GET /api/health
GET /api/health/endpoints
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

명령 API는 사용자의 의도를 기록하는 용도이며 임의 명령을 실행하지 않는다.

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

### 로컬 runtime

```http
GET /api/local-runtime/status
```

Codex loop, implementer/reviewer process, MCP queue 상태를 읽기 전용으로 제공한다.

## Spring AI Proxy

다음 endpoint는 `ARCHIVEOS_AI_BASE_URL`의 Spring AI 서비스로 전달한다.

```http
POST /api/obsidian/sync
GET /api/obsidian/documents
GET /api/rag/search?query=...
POST /api/rag/ask
GET /api/ai/runtime
POST /api/ai/runtime/check
```

`archiveos-ai`가 준비되지 않은 경우 placeholder 성공 응답이 아니라 명확한 오류를 반환한다.

## Spring Batch RPA Proxy

Node backend는 Intelligent RPA 판단 책임을 직접 수행하지 않고 `archiveos-ai`의 Spring Batch API로 위임한다.

```http
POST /api/rpa/classify
GET /api/rpa/tasks/recent
GET /api/rpa/tasks/:id
POST /api/rpa/tasks/:id/decision
```

이 API는 작업을 직접 실행하지 않는다. Spring Batch Job이 작업을 분류하고 위험도, 권장 조치, PM 승인 필요 여부를 DB에 기록한다. PM decision API는 승인/반려/보류/재시도 상태와 사유만 기록한다.

## PM 작업 흐름

```text
queued
  -> architect_review
  -> ready_for_build
  -> building
  -> review
  -> pm_decision_required
  -> approved | rejected | hold | failed | done
```

관련 테이블:

- `pm_tasks`
- `pm_task_decisions`
- `pm_task_events`
- `architecture_reviews`
- `command_runs`

## 기존 Node 배치 작업

아직 남아 있는 Node 배치:

```bash
npm run batch:nightly-review
npm run batch:daily-report
```

이 책임은 단계적으로 Spring Batch Job으로 이전한다.

## 테스트와 빌드

```bash
npm run test
npm run typecheck
npm run build
```

## 운영 원칙

- 실행보다 관찰 가능성을 우선한다.
- Agent 결과와 PM 결정을 분리해 기록한다.
- 실패 원인과 재시도 이력을 보존한다.
- 위험한 실행은 승인 게이트 이후에만 허용한다.
- Node backend와 Spring AI backend의 책임을 중복시키지 않는다.
