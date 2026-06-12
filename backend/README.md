# ArchiveOS 백엔드

ArchiveOS 백엔드는 서버 측 쓰기, 명령 기록, 로컬 런타임 상태 조회를 위한 최소 Express API입니다. 현재 단계의 우선순위는 읽기 전용 PM 가시화와 안전한 기록입니다.

## 목적

이 서비스는 향후 안전한 Supabase 서버 측 쓰기, GitHub Webhook, AI 리뷰 작업, MCP 연동을 위한 기반입니다. 현재 MVP에서는 프론트엔드가 Supabase 읽기를 계속 수행합니다.

백엔드는 다음을 제공하지 않습니다.

- 임의 셸 명령 실행
- Codex 프로세스 직접 제어
- OpenAI API 호출
- GitHub 자동화
- MCP 직접 실행

## 실행 방법

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## 환경 변수

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=4000
CORS_ALLOWED_ORIGINS=
ARCHIVEOS_PROJECT_PATH=
CODEX_IMPLEMENTER_PID=
CODEX_REVIEWER_PID=
MCP_REPO_PATH=
MCP_QUEUE_PATH=
```

`SUPABASE_SERVICE_ROLE_KEY`는 백엔드 전용 비밀값입니다. Vite 프론트엔드에 노출하지 말고, `VITE_` 접두사를 붙이지 말고, 커밋하지 마세요.

`ARCHIVEOS_PROJECT_PATH`는 allowlisted local action을 실행할 ArchiveOS 저장소 루트를 가리킵니다.

`CODEX_IMPLEMENTER_PID`, `CODEX_REVIEWER_PID`는 수동으로 켠 Codex 터미널을 읽기 전용으로 감지하기 위한 로컬 힌트입니다. 비밀값은 아니지만 세션별 값이므로 `.env`에만 둡니다.

`CORS_ALLOWED_ORIGINS`는 휴대폰 원격 확인용 ngrok 프론트엔드 origin을 쉼표로 추가할 때 사용합니다. 예: `https://your-frontend-ngrok-url`

## 로컬 액션 보안

ArchiveOS는 사용자 입력으로 임의 셸 명령을 실행하지 않습니다. 로컬 프로젝트 액션은 미리 정의된 action ID를 고정된 `spawn` 명령에 매핑합니다. 요청 본문은 임의 경로나 임의 명령 문자열을 제공할 수 없습니다.

## Supabase 클라이언트 주의사항

백엔드는 service role client로 Supabase 테이블 작업을 수행합니다. service role key는 서버에서만 사용해야 합니다.

## 엔드포인트

### GET /health

백엔드 상태를 반환합니다.

### GET /api/work-logs/recent

최근 작업 로그 20개를 `created_at` 내림차순으로 반환합니다. 가능한 경우 task title과 agent name을 함께 포함합니다.

### POST /api/work-logs

서버 측 Supabase admin client로 작업 로그를 생성합니다.

```json
{
  "task_id": null,
  "agent_id": null,
  "log_type": "summary",
  "content": "짧은 작업 로그"
}
```

검증 오류는 `400`, Supabase 또는 서버 오류는 비밀값을 노출하지 않고 `500`을 반환합니다.

### GET /api/commands/recent

최근 command run 20개를 `created_at` 내림차순으로 반환합니다.

### POST /api/commands

외부 액션을 실행하지 않고 명령 의도를 기록합니다.

```json
{
  "command": "현재 큐 요약",
  "command_type": "typed",
  "status": "pending"
}
```

현재 이 엔드포인트는 OpenAI, GitHub, MCP, 외부 자동화를 호출하지 않습니다.

### GET /api/local-actions/projects

백엔드에 정적으로 설정된 allowlisted local project를 반환합니다.

### POST /api/local-actions/run

allowlisted local action 하나를 실행하고 결과를 `command_runs`에 기록합니다.

```json
{
  "project_id": "archiveos",
  "action": "git_status"
}
```

허용된 액션은 `git_status`, `git_branch`, `git_log_recent`, `frontend_build`, `backend_typecheck`, `backend_build`입니다.

### GET /api/local-runtime/status

로컬 Codex loop, implementer process, reviewer bridge process, queue folder를 감지 가능한 범위에서 읽기 전용으로 반환합니다. 이 엔드포인트는 프로세스를 제어하지 않으며 사용자 제공 명령을 실행하지 않습니다.

## Nightly Review Batch / Daily Report Batch

ArchiveOS backend에는 PM 운영 요약 batch가 포함됩니다. batch는 backend/local-worker에서만 실행되며 frontend UI는 read-only 상태 표시만 합니다.

### Nightly Review Batch

```bash
npm run batch:nightly-review
```

동작:

- 전날 기준 운영 요약을 생성합니다.
- MCP queue counts, 최신 builder/reviewer 결과, 최근 command_runs, 최근 decision work_logs를 읽습니다.
- `batch_runs` 테이블에 `batch_type = nightly_review`, `status = completed`로 기록합니다.

### Daily Report Batch

```bash
npm run batch:daily-report
```

동작:

- Asia/Seoul 기준 오늘이 한국 영업일인지 확인합니다.
- 월요일부터 금요일만 Discord 전송 후보입니다.
- 토요일/일요일, 한국 공휴일, 대체공휴일에는 Discord를 보내지 않고 `status = skipped`로 기록합니다.
- 2026년 공휴일/대체공휴일은 `src/batches/koreanHolidays.ts`에 있습니다. 이 리스트는 매년 갱신해야 합니다.
- 해당 연도 holiday data가 없으면 fail-safe로 Discord 전송을 건너뜁니다.

### Discord webhook

환경 변수:

```bash
DISCORD_WEBHOOK_URL=
```

주의:

- backend-only 값입니다.
- frontend에 노출하지 않습니다.
- `VITE_` prefix를 붙이지 않습니다.
- 값이 없으면 서버 시작은 실패하지 않습니다.
- Daily Report 실행 시 `DISCORD_WEBHOOK_URL not configured` reason으로 `skipped` 기록을 남깁니다.

### Batch API

Manual trigger endpoints는 local/admin/testing 용도입니다. UI 실행 버튼은 추가하지 않습니다.

- `POST /api/batches/nightly-review/run`
- `POST /api/batches/daily-report/run`
- `GET /api/batches/recent`
- `GET /api/batches/latest`

### Suggested schedule

OS-level scheduler는 아직 구현하지 않았습니다. 운영 단계에서 Windows Task Scheduler로 아래 시각에 npm script를 호출하는 방식을 권장합니다.

- Nightly Review: 23:50 KST daily
- Daily Report: 09:00 KST business days only
