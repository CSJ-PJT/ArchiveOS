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
## 한국어 PM Daily Report 및 히스토리 저장

Daily Report는 한국 업무일 규칙을 통과한 경우 Discord에 한국어 PM 운영 보고서를 전송합니다. 메시지에는 다음 항목이 포함됩니다.

- 대상일
- 운영 상태: 정상, 주의, 문제
- Runtime queue count
- 최신 Builder/Reviewer 결과 이름과 verdict
- 대기 작업 요약
- Implementer, Reviewer, Loop, Reviewer Bridge 감지 상태
- 경고
- Decisions / Commands 수
- `ARCHIVEOS_PUBLIC_URL`이 설정된 경우 Dashboard 링크

히스토리는 backend service-role 쓰기 경로로 Supabase에 저장됩니다.

- `batch_runs`: 배치 실행 상태
- `daily_reports`: 보고서 본문, 운영 판정, Discord 전송/생략 상태
- `runtime_snapshots`: queue count, 최신 결과 메타데이터, 작업자 상태, 경고

환경 변수:

```bash
DISCORD_WEBHOOK_URL=
ARCHIVEOS_PUBLIC_URL=
```

두 값은 backend-only입니다. Discord webhook은 frontend 코드에 노출하지 않습니다. `ARCHIVEOS_PUBLIC_URL`은 선택 값이며 보고서 하단 Dashboard 링크에만 사용됩니다.

수동 검증:

```bash
npm run batch:nightly-review
npm run batch:daily-report
```

읽기 전용 보고서 API:

- `GET /api/reports/daily/latest`
- `GET /api/reports/daily/recent`
- `GET /api/runtime/snapshots/recent`

Discord Daily Report는 Asia/Seoul 기준 월요일-금요일 중 `src/batches/koreanHolidays.ts`에 정의된 한국 공휴일과 대체공휴일을 제외한 업무일에만 전송됩니다. 로컬 공휴일 목록은 매년 갱신해야 합니다.

## Historian Obsidian Export

Historian은 backend/local-worker 전용 Markdown export 계층입니다. 아직 AI 실행 Agent, Obsidian plugin, bidirectional sync, graph database가 아닙니다.

환경 변수:

```bash
ARCHIVEOS_OBSIDIAN_VAULT_PATH=
```

설정되지 않으면 export는 disabled/skipped로 기록되고 서버 시작이나 Discord 전송을 막지 않습니다. 설정된 경우 배치 실행 후 다음 위치에 Markdown note를 생성합니다.

- `Reports/daily-report-YYYY-MM-DD.md`
- `Batches/nightly_review-YYYY-MM-DD.md`
- 향후 수동/자동 연결 대상: `Decisions/`, `Incidents/`, `Architecture/`

보안 원칙:

- 절대 vault path는 frontend에 반환하지 않습니다.
- metadata에는 상대 note path만 저장합니다.
- 파일명은 sanitize합니다.
- resolved path가 configured vault 밖으로 나가면 export를 거부합니다.

Historian 상태 API:

- `GET /api/historian/status`

## Historian v2 Knowledge Graph MVP

Historian v2는 실행 agent가 아니라 Supabase metadata 관계 저장 계층입니다. ArchiveOS 운영 이벤트, 보고서, 결과, incident, Obsidian note 사이의 보수적인 관계만 저장합니다.

테이블:

- `knowledge_nodes`
- `knowledge_edges`

자동 생성되는 대표 관계:

- `daily_report exported_to obsidian_note`
- `nightly_review exported_to obsidian_note`
- `builder_result reviewed_by reviewer_result`
- `incident mentioned_in daily_report`

API:

- `GET /api/knowledge/overview`
- `GET /api/knowledge/recent`
- `GET /api/knowledge/node/:id`
- `GET /api/knowledge/search?q=`
- `GET /api/knowledge/related?external_ref=`

## Architect Agent MVP

Architect는 backend 내부의 비실행 설계 검토 계층입니다. 이 MVP는 LLM을 호출하지 않고, Codex/MCP/shell을 제어하지 않으며, 외부 자동화도 실행하지 않습니다. 입력된 task/decision/result/report 설명을 deterministic rule로 검사한 뒤 Supabase에 기록합니다.

저장 테이블:

- `architecture_reviews`
- `knowledge_nodes`의 `node_type = architecture_review`
- `knowledge_edges`의 `reviewed_architecture_of`, `references_memory` 등 보수적 관계

검사 규칙:

- Dashboard는 read-only PM overview로 유지해야 합니다.
- 임의 shell, direct MCP execution, Codex control은 차단 위험으로 봅니다.
- Historian/Knowledge MVP에서는 embeddings, vector search, graph database, bidirectional Obsidian sync를 범위 밖으로 봅니다.
- service role key, Discord webhook URL, Obsidian vault path는 frontend에 노출되면 안 됩니다.
- Dashboard / Operators / Timeline / Settings를 한 작업에서 과도하게 섞으면 분해를 권장합니다.
- batch/report/runtime/backend/frontend 작업에는 `npm run build`, backend typecheck, backend build 검증을 요구합니다.

API:

- `POST /api/architect/review`  
  local/admin/manual-test 용도입니다. 외부 명령을 실행하지 않고 Architecture Review만 기록합니다.
- `GET /api/architect/reviews/recent`
- `GET /api/architect/reviews/latest`

Demo:

```bash
npm run architect:review-demo
```

데모 입력은 정적이며, Dashboard에 process control button을 추가하려는 요구를 검토해 read-only 경계 위험을 기록합니다.

## Agent Mesh Overview

Agent Mesh Overview는 backend에서 파생한 read-only 관계 요약입니다. 실행 제어를 제공하지 않으며, Codex/MCP/OpenAI/shell을 호출하지 않습니다.

Endpoint:

```bash
GET /api/mesh/overview
```

응답은 다음 데이터를 포함합니다.

- `agents`: Implementer, Reviewer, Architect, Historian, MCP Loop, Reviewer Bridge 상태
- `links`: 역할 간 관계와 Knowledge Graph에서 파생된 보수적 관계
- `recentInteractions`: 최근 runtime/knowledge_graph interaction
- `health`: mesh 전체 상태와 요약

데이터 출처:

- local runtime status
- latest architecture review
- latest Historian export
- latest Knowledge Graph edges
- latest Daily Report warnings

제한:

- Agent 간 자율 메시징이 아닙니다.
- process start/stop 기능이 아닙니다.
- UI 실행 제어가 아닙니다.
- secret, webhook URL, Obsidian vault 절대 경로를 반환하지 않습니다.

## KPI Overview

KPI Overview는 기존 ArchiveOS 기록에서 계산되는 read-only analytics API입니다. 별도 실행 제어, Codex 제어, MCP 실행, OpenAI API 호출을 하지 않습니다.

Endpoint:

```bash
GET /api/kpi/overview?range=today
GET /api/kpi/overview?range=7d
GET /api/kpi/overview?range=30d
```

계산 출처:

- `daily_reports`
- `batch_runs`
- `runtime_snapshots`
- `command_runs`
- `work_logs`
- `architecture_reviews`
- `knowledge_nodes`
- `knowledge_edges`
- `historian_exports`
- current runtime status

지표 정의:

- `approvalRate = approve / (approve + reject + stop) * 100`
- `graphDensity = knowledge_edges / knowledge_nodes`
- `warningCount = daily report warnings + runtime snapshot warnings + Architect warning/blocked rows`
- `loopDetectedRate`는 runtime snapshot의 operator summary에서 loop 감지 여부가 있는 경우에만 계산합니다.

데이터가 없거나 쿼리할 수 없는 지표는 null로 반환하고 `notes`에 이유를 남깁니다. KPI는 현재 통계 집계이며 LLM 분석, 예측, 자동 의사결정을 포함하지 않습니다.

## Knowledge Graph Visualization API

Knowledge Graph Visualization API는 `knowledge_nodes`와 `knowledge_edges`를 read-only graph payload로 반환합니다. 이 API는 ArchiveOS Knowledge 탭의 SVG/CSS 기반 그래프 시각화에 사용됩니다.

Endpoint:

```bash
GET /api/knowledge/graph?limit=100
```

응답:

- `nodes`: id, type, label, title, summary, source, externalRef, createdAt, metadata
- `edges`: id, from, to, type, label, confidence, createdAt, metadata
- `stats`: nodeCount, edgeCount, type counts

정책:

- default limit 100, max 300
- 최근 node/edge 우선
- 반환 node에 포함된 from/to를 가진 edge만 반환
- 데이터가 없거나 쿼리 실패 시 빈 graph payload를 반환해 frontend 전체가 깨지지 않게 합니다.
- Obsidian note는 relative path만 노출합니다.
- local absolute vault path, webhook URL, secret 성격 metadata는 제거합니다.

이 기능은 vector search, embeddings, graph database, Obsidian plugin, bidirectional sync가 아닙니다. 현재는 운영 기억 관계를 시각적으로 이해하기 위한 MVP입니다.

제한:

- OpenAI API 없음
- embeddings/vector search 없음
- graph database 없음
- recursive traversal 없음
- Obsidian 양방향 sync 없음
- 절대 vault path 노출 없음
