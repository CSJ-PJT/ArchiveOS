# ArchiveOS

v1.0 하드닝, Endpoint Health, ngrok 런타임 동기화 절차는 [docs/ARCHIVEOS_V1_HARDENING.md](docs/ARCHIVEOS_V1_HARDENING.md)를 기준으로 확인합니다.

ArchiveOS는 AI 에이전트 작업을 PM 관점에서 관찰하고 기록하기 위한 운영 대시보드입니다. React, Vite, TypeScript, Tailwind CSS, Supabase, Express 기반으로 구성되어 있습니다.

현재 단계의 핵심 방향은 **실행 콘솔이 아니라 읽기 전용 PM 가시화 대시보드**입니다. OpenAI API 호출, GitHub Webhook 자동화, MCP 직접 실행 제어, Codex 직접 제어는 아직 포함하지 않습니다.

## 현재 MVP 범위

- 에이전트 목록: 이름, 역할, 상태, 현재 작업
- 작업 큐: 상태별 작업 흐름과 담당 에이전트
- 작업 로그: 요약, 결정, 오류, 리뷰 기록
- Memory / Decisions: `work_logs` 중 `log_type = 'decision'`인 결정 기록 표시
- Supabase 직접 읽기: 프론트엔드는 현재 MVP 데이터 조회를 위해 Supabase를 직접 읽습니다.
- 백엔드 API: 서버 측 쓰기, 명령 기록, 런타임 상태 조회의 기반
- Command Center: 빠른 액션과 입력 명령을 **실행하지 않고 기록**합니다.
- Event Timeline: MCP 런타임, 백엔드 판단, Supabase 기록을 요약한 읽기 전용 타임라인
- Data Consistency: 프론트엔드 표시값, 백엔드 API, MCP 큐 상태가 일치하는지 확인

## ArchiveOS의 역할

ArchiveOS는 사람이 여러 Git Bash, Codex 세션, 큐 폴더, 로그 파일을 직접 뒤지지 않아도 현재 AI 작업 상태를 볼 수 있게 만드는 PM 운영 화면입니다.

- 현재 어떤 작업이 진행 중인지 확인합니다.
- 구현자와 리뷰어 프로세스가 감지되는지 표시합니다.
- 빌더 결과와 리뷰 결과 파일을 읽기 전용으로 보여줍니다.
- 승인, 반려, 결정은 기록만 하며 실제 자동 실행은 하지 않습니다.
- 빈 inbox 상태를 장애로 오해하지 않도록 idle 상태와 실패 상태를 구분합니다.

## DeepStake3D 연계 설명

DeepStake3D는 ArchiveOS가 관찰하는 대표 작업 프로젝트입니다. Unity 기반 3D 게임 PoC이며, 현재는 ModularConstructionPrototype을 중심으로 배치, 회전, 제거, 저장/복원, chunk/tile 기반 검증, settlement-scale 검증을 확장하는 단계입니다.

ArchiveOS는 DeepStake3D를 직접 실행하거나 Unity를 제어하지 않습니다. 대신 MCP 큐, 빌더 결과, 리뷰 결과, 테스트 요약, 런타임 경고를 읽어 PM이 작업 흐름을 파악할 수 있게 합니다.

현재 DeepStake3D 설명에서 정확히 구분해야 하는 상태는 다음과 같습니다.

- 구현 완료: Unity 프로젝트 구조, 3D PoC 화면, ModularConstructionPrototype의 기본 배치/저장/복원 검증
- PoC 수준: 월드/거점/상호작용 HUD, chunk 기반 건설 데이터 검증
- 향후 확장 예정: AI NPC, 동적 퀘스트, 대규모 한국형 농촌/도시/시설 지역
- 미구현 또는 제한사항: 상용 게임 완성 단계가 아니며, AI NPC와 동적 퀘스트는 아직 구현 완료가 아닙니다.

## Command Center

Command Center는 빠른 액션, 입력 명령, 백엔드 상태, 최근 명령 기록을 보여줍니다. 현재 명령은 백엔드 `command_runs` 행으로만 기록됩니다.

명령은 OpenAI, GitHub, MCP, Codex, 외부 자동화로 전달되지 않습니다. 사용자가 입력한 임의 셸 명령도 실행하지 않습니다.

## Event Timeline

Event Timeline은 `GET /api/runtime/events/recent`를 호출하여 기존 런타임 소스에서 파생된 이벤트를 표시합니다.

사용되는 소스:

- MCP 큐와 런타임 파일
- 최신 빌더/리뷰어 결과
- 백엔드 런타임 판단
- seed/demo가 아닌 Supabase `command_runs`
- seed/demo가 아닌 decision `work_logs`

ArchiveOS는 아직 별도 이벤트 버스를 만들지 않습니다. 타임라인은 PM 맥락을 위한 요약이며, 전체 빌더/리뷰어 로그를 대체하지 않습니다.

## MVP 안정화

ArchiveOS는 E2E PM 가시화 테스트를 위해 Data Consistency 패널과 E2E Test Readiness 체크리스트를 제공합니다.

이 패널은 작업 시작, MCP 명령 실행, OpenAI 호출, Codex 제어를 하지 않습니다. 오직 다음 상태를 표시합니다.

- MCP 큐 카운트
- 백엔드 API 큐 카운트
- 프론트엔드에 표시된 큐 카운트
- 최신 빌더/리뷰어 결과 파일명
- `command_runs` 연결 상태
- `work_logs`와 decision 연결 상태

수동 E2E 가시화 테스트:

```bash
cd /c/Users/dan18/Documents/Codex/2026-05-20/create-a-new-project-named-archiveos/ArchiveOS

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/status.ps1"
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/api/local-runtime/status
npm run build
cd backend && npm run typecheck && npm run build
```

브라우저에서 확인:

```bash
start http://127.0.0.1:5173/
```

성공 기준:

- ArchiveOS 프론트엔드와 백엔드가 실행 중입니다.
- Data Consistency 패널이 큐 카운트를 오류 없이 표시합니다.
- `command_runs`와 `work_logs` 연결 상태가 `error`가 아닙니다.
- `inbox=0` idle 상태와 루프 실패 상태가 구분됩니다.
- Codex 사용량 제한으로 reviewer verdict가 `stop`인 경우 런타임 충돌이 아니라 사용량 제한 중단으로 표시됩니다.
- MCP 결과 파일이 있으면 최신 빌더/리뷰어 파일명이 표시됩니다.

## 실행 방법

의존성 설치:

```bash
npm install
```

프론트엔드 환경 파일 생성:

```bash
cp .env.example .env.local
```

필수 환경 변수:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_BACKEND_URL=http://localhost:4000
```

프론트엔드에는 Supabase publishable/anon key만 넣습니다. secret key나 service role key를 `.env.local`에 넣지 마세요.

Supabase SQL editor에서 다음 순서로 실행합니다.

```sql
-- supabase/schema.sql
-- supabase/seed.sql
```

프론트엔드 실행:

```bash
npm run dev
```

빌드:

```bash
npm run build
```

## 모바일 원격 접속

휴대폰에서 ArchiveOS를 확인하려면 ngrok 같은 HTTPS 터널로 프론트엔드와 백엔드를 각각 노출합니다.

프론트엔드 `.env.local` 예시:

```bash
VITE_BACKEND_URL=https://your-backend-ngrok-url
VITE_REMOTE_FRONTEND_URL=https://your-frontend-ngrok-url
VITE_REMOTE_BACKEND_URL=https://your-backend-ngrok-url
```

백엔드 `.env` 예시:

```bash
CORS_ALLOWED_ORIGINS=https://your-frontend-ngrok-url
```

Settings 탭의 Remote Access 섹션은 현재 프론트엔드 URL, 백엔드 URL, online/offline 상태를 표시합니다. 이 기능은 모바일 가시화용이며 ngrok 시작, MCP 실행, Codex 제어, 임의 명령 실행을 하지 않습니다.

지원 대상으로 보는 화면:

- Galaxy Fold
- Android Chrome
- iPhone Safari

## 백엔드 API

`backend/` 서비스는 서버 측 쓰기와 향후 통합을 위한 기반입니다. 현재 프론트엔드는 Supabase 읽기를 유지하며, 백엔드가 UI 표시를 완전히 대체하지는 않습니다.

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

백엔드 환경 변수:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
ARCHIVEOS_PROJECT_PATH=/absolute/path/to/ArchiveOS
CODEX_IMPLEMENTER_PID=optional-local-codex-pid
CODEX_REVIEWER_PID=optional-local-codex-pid
MCP_REPO_PATH=optional-local-mcp-repo-path
MCP_QUEUE_PATH=optional-local-mcp-queue-path
```

`SUPABASE_SERVICE_ROLE_KEY`는 백엔드 전용입니다. `VITE_` 접두사를 붙이거나 프론트엔드 코드에 노출하면 안 됩니다.

## 로컬 런타임 오케스트레이터

ArchiveOS는 여러 Git Bash 창을 줄이기 위해 로컬 PowerShell 스크립트를 제공합니다. 이 도구는 ArchiveOS 프론트엔드, 백엔드, MCP 큐 루프, reviewer bridge, 선택적 watcher를 시작/중지/조회할 수 있습니다.

ArchiveOS UI에는 프로세스 제어 기능을 노출하지 않습니다. Codex 구현자/리뷰어 세션은 여전히 수동으로 시작하고 PID 힌트로 감지합니다.

설정 복사:

```bash
cp tools/runtime/runtime.config.example.json tools/runtime/runtime.config.json
notepad tools/runtime/runtime.config.json
```

시작:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/start-all.ps1"
```

상태 확인:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/status.ps1"
```

중지:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/stop-all.ps1"
```

git에서 제외되는 로컬 파일:

- `tools/runtime/runtime.config.json`
- `tools/runtime/logs/`
- `tools/runtime/pids/`

## 프로젝트 구조

- `src/lib/supabase.ts`: Supabase 브라우저 클라이언트
- `src/App.tsx`: PM 운영 대시보드 UI
- `src/types/database.ts`: Supabase 테이블 타입
- `supabase/schema.sql`: enum, table, index, RLS, grant 정의
- `supabase/seed.sql`: 샘플 에이전트, 작업, 로그 데이터
- `backend/src/server.ts`: Express API
- `backend/src/lib/supabaseAdmin.ts`: 서버 전용 Supabase admin client
- `backend/src/lib/localRuntime.ts`: 로컬 Codex/MCP 런타임 상태 읽기
- `tools/runtime/`: 로컬 전용 프로세스 오케스트레이션 스크립트

## Nightly Review Batch / Daily Report Batch

ArchiveOS는 PM 가시화 목적의 운영 요약 batch를 제공합니다. 이 기능은 backend/local-worker에서만 동작하며, UI에서 MCP 실행, Codex 제어, 임의 shell 실행을 하지 않습니다.

Nightly Review Batch:

- 전날 ArchiveOS 운영 상태를 읽기 전용으로 요약합니다.
- MCP queue counts, 최신 builder/reviewer 결과, 최근 command_runs, work_logs decisions를 요약합니다.
- 결과는 `batch_runs` 테이블에 `batch_type = nightly_review`로 저장됩니다.

Daily Report Batch:

- Asia/Seoul 기준 오늘이 한국 영업일인지 확인합니다.
- 월요일부터 금요일만 전송 후보입니다.
- 토요일/일요일, 한국 공휴일, 대체공휴일에는 Discord를 보내지 않고 `skipped`로 기록합니다.
- 2026년 한국 공휴일/대체공휴일은 `backend/src/batches/koreanHolidays.ts`에 로컬 리스트로 관리합니다.
- holiday list가 없는 연도는 fail-safe로 Discord를 보내지 않습니다.

Discord webhook 설정은 backend 전용입니다.

```bash
cd backend
cp .env.example .env

# backend/.env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

`DISCORD_WEBHOOK_URL`은 frontend에 노출하지 않습니다. 값이 없으면 Daily Report는 실패하지 않고 `skipped` 상태와 `DISCORD_WEBHOOK_URL not configured` reason을 기록합니다.

수동 테스트:

```bash
cd backend
npm run batch:nightly-review
npm run batch:daily-report
```

권장 스케줄:

- Nightly Review: 매일 23:50 KST
- Daily Report: 매 영업일 09:00 KST

현재 OS-level scheduler는 구현하지 않았습니다. Windows Task Scheduler 설정은 추후 운영 단계에서 별도로 연결합니다.
## 한국어 PM Daily Report 및 히스토리 저장

Daily Report Discord 메시지는 한국어 PM 운영 보고서 형식으로 전송됩니다. 보고서에는 대상일, 운영 상태 판정, queue count, 최신 Builder/Reviewer 결과, 대기 작업, 작업자 감지 상태, 경고, Decisions/Commands 수, `ARCHIVEOS_PUBLIC_URL`이 설정된 경우 Dashboard 링크가 포함됩니다.

Daily Report 전송은 backend-only입니다. Discord는 Asia/Seoul 기준 월요일-금요일 중 `backend/src/batches/koreanHolidays.ts`에 정의된 한국 공휴일과 대체공휴일을 제외한 업무일에만 전송됩니다. 웹훅이 없거나 전송을 생략한 경우 서버 시작을 실패시키지 않고 사유를 기록합니다.

운영 히스토리는 Supabase에 누적됩니다.

- `batch_runs`: 배치 실행 상태
- `daily_reports`: 한국어 보고서 본문, 운영 상태, Discord 전송/생략 상태
- `runtime_snapshots`: queue count, 최신 결과 메타데이터, 작업자 요약, 경고

수동 검증 명령:

```bash
cd backend
npm run batch:nightly-review
npm run batch:daily-report
```

Backend-only 환경 변수:

```bash
DISCORD_WEBHOOK_URL=
ARCHIVEOS_PUBLIC_URL=
```

## Historian Obsidian Markdown Export

Historian은 아직 AI 실행 Agent가 아닙니다. 현재 버전의 Historian은 ArchiveOS 운영 기억을 로컬 Obsidian vault용 Markdown 파일로 export하는 backend/local-only 기능입니다.

역할 분리:

- ArchiveOS: 현재 runtime 상태, queue, decisions, batch, PM dashboard
- Obsidian vault: 장기 기억, 운영 보고서, 결정 기록, incident, architecture note

Backend-only 환경 변수:

```bash
ARCHIVEOS_OBSIDIAN_VAULT_PATH=
```

설정되지 않으면 Historian은 disabled 상태가 되며 서버 시작과 배치 실행은 실패하지 않습니다. frontend에는 configured yes/no와 마지막 export 상대 경로만 표시하고, 절대 vault path는 노출하지 않습니다.

Markdown export 대상 폴더:

- `Daily/`
- `Decisions/`
- `Incidents/`
- `Architecture/`
- `Reports/`
- `Batches/`

현재 자동 연결:

- Daily Report Batch 완료 후 `Reports/daily-report-YYYY-MM-DD.md` export
- Nightly Review Batch 완료 후 `Batches/nightly_review-YYYY-MM-DD.md` export

명시적 제한:

- Obsidian bidirectional sync 없음
- Obsidian plugin 없음
- graph database 없음
- UI file browser/edit 없음
- OpenAI API, Codex 직접 제어, MCP 실행 제어 없음

## Historian v2 Knowledge Graph MVP

Historian v2는 전체 graph database가 아니라 Supabase metadata 관계 테이블 기반의 Knowledge Graph MVP입니다. 목적은 PM이 "왜 이런 일이 발생했는가"와 "어떤 기록이 연결되어 있는가"를 빠르게 확인하는 것입니다.

저장 모델:

- `knowledge_nodes`: task, builder_result, reviewer_result, decision, incident, daily_report, nightly_review, batch_run, command, obsidian_note, architecture_note
- `knowledge_edges`: exported_to, reviewed_by, mentioned_in, relates_to 등 보수적인 관계

자동 연결:

- Daily Report → Obsidian note: `exported_to`
- Nightly Review → Obsidian note: `exported_to`
- Builder result → Reviewer result: `reviewed_by`
- Warning/incident → report/review: `mentioned_in`

명시적 제한:

- vector search 없음
- embeddings 없음
- graph database 없음
- recursive graph traversal 없음
- Obsidian bidirectional sync 없음
- 절대 vault path frontend 노출 없음

읽기 전용 API:

- `GET /api/knowledge/overview`
- `GET /api/knowledge/recent`
- `GET /api/knowledge/node/:id`
- `GET /api/knowledge/search?q=`
- `GET /api/knowledge/related?external_ref=`

## Architect Agent MVP

Architect는 실행 Agent가 아니라 비실행 설계 검토 역할입니다. 현재 MVP는 OpenAI API, Codex 제어, MCP 실행, shell 실행을 전혀 사용하지 않고, 기존 런타임 데이터와 작업 설명을 규칙 기반으로 검사해 `architecture_reviews`에 기록합니다.

Architect가 확인하는 주요 위험:

- Dashboard에 실행/프로세스 제어가 섞이는 경계 위반
- 임의 shell, MCP 직접 실행, Codex 직접 제어 같은 실행 위험
- Historian/Knowledge 범위에서 bidirectional sync, graph database, embeddings 같은 MVP 외 확장
- webhook URL, service role key, Obsidian vault 절대 경로의 frontend 노출 위험
- Dashboard / Operators / Timeline / Settings 책임이 한 작업에 과도하게 섞이는 경우
- batch/report/runtime 변경에서 빌드와 backend 검증 누락

결과는 Supabase `architecture_reviews`에 저장되고, Knowledge Graph에는 `architecture_review` 노드로 연결됩니다. 가능한 경우 관련 Knowledge node와 `reviewed_architecture_of`, `references_memory` edge를 생성합니다.

읽기 전용 API:

- `GET /api/architect/reviews/latest`
- `GET /api/architect/reviews/recent`

수동 테스트용 기록 API:

- `POST /api/architect/review`

Backend demo:

```bash
cd backend
npm run architect:review-demo
```

이 데모는 `Add process control buttons to Dashboard`라는 안전한 정적 입력을 기록하고, Dashboard read-only 원칙 위반을 warning/blocked 성격의 Architecture Review로 남깁니다.

## Agent Mesh View MVP

Agent Mesh View는 ArchiveOS 역할들이 서로 어떤 관계로 운영되는지 보여주는 read-only 가시화 화면입니다. 이것은 Agent 간 자율 대화, MCP 실행, Codex 직접 제어, 프로세스 start/stop 기능이 아닙니다.

Mesh 탭은 다음 정보를 backend에서 파생해 표시합니다.

- Implementer, Reviewer, Architect, Historian, MCP Loop, Reviewer Bridge 상태
- Human PM을 중심으로 한 역할 관계
- builder result -> reviewer result, daily report -> Obsidian note, architecture review -> related memory 같은 Knowledge Graph 기반 관계
- 최근 interaction과 link source
- Mesh health, active agents, warning count

API:

```bash
GET /api/mesh/overview
```

Mesh View의 목적은 PM이 "누가 어떤 역할을 하고 있고, 어떤 기억/검토/결과가 연결되어 있는지"를 빠르게 보는 것입니다. 향후 실제 multi-agent coordination이나 agent message bus를 붙일 수 있지만, 현재 MVP는 metadata-only visibility layer입니다.

## KPI Dashboard MVP

KPI Dashboard는 ArchiveOS 운영 상태를 정량화하는 read-only analytics 화면입니다. OpenAI API, MCP 실행, Codex 직접 제어, shell 실행, process start/stop 기능을 추가하지 않습니다.

지원 범위:

- `today`
- `7d`
- `30d`

데이터 출처:

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

주요 지표:

- Productivity: completed tasks, completed reviews, recorded decisions, recorded commands, sent daily reports, completed nightly reviews
- Quality: approval rate, approve/reject/stop count, Architect warning/blocked count
- Runtime: latest queue state, warning count, loop detected rate
- Knowledge: total nodes/edges, nodes/edges created in range, Obsidian exports, graph density
- Trends: daily reports, decisions, knowledge nodes, warnings

데이터가 부족하거나 해당 source가 없으면 값을 조작하지 않고 `insufficient data` 또는 `null` 성격의 note로 표시합니다. KPI는 현재 규칙 기반 집계이며 LLM 분석이나 예측 모델은 포함하지 않습니다.

API:

```bash
GET /api/kpi/overview?range=today
GET /api/kpi/overview?range=7d
GET /api/kpi/overview?range=30d
```

## Knowledge Graph Visualization MVP

Knowledge Graph Visualization은 Supabase의 `knowledge_nodes`와 `knowledge_edges`를 read-only로 시각화합니다. Historian/Obsidian export, Daily/Nightly batch, Architect Review, Reviewer/Builder 결과가 어떤 관계로 연결되는지 PM이 한 화면에서 확인하기 위한 포트폴리오/운영 가시화 기능입니다.

포함 기능:

- Knowledge 탭의 `Knowledge Graph` 섹션
- SVG/CSS 기반 경량 그래프
- node type / edge type / limit / text filter
- selected node detail panel
- edge list fallback
- 모바일에서는 그래프 영역 horizontal scroll

Backend API:

```bash
GET /api/knowledge/graph?limit=100
```

제한:

- vector search 없음
- embeddings 없음
- graph database 없음
- Obsidian bidirectional sync 없음
- OpenAI/LLM reasoning 없음
- Codex/MCP/process 제어 없음
- Obsidian vault 절대 경로와 secret 값 노출 없음
## Knowledge Graph Importance Insights

ArchiveOS now adds a rule-based importance layer to the Knowledge Graph view.

- The graph still uses the existing Supabase `knowledge_nodes` and `knowledge_edges` tables.
- No embeddings, vector search, graph database, or LLM reasoning are used.
- Node importance is derived from degree, recency, node type, and links to decisions, architecture reviews, and incidents.
- Edge importance is derived from edge type, recency, and whether the edge participates in a decision, Architect, or incident path.
- The Knowledge tab visualizes importance with node size, node border, glow, edge thickness, and path colors.
- Graph Insights highlights important nodes, hubs, recent memories, isolated nodes, and decision chains.

Useful endpoints:

```bash
GET /api/knowledge/graph?limit=100
GET /api/knowledge/graph/insights?limit=100
```

This layer is read-only and helps the PM understand why a decision, review, incident, command, or report matters without adding execution controls.

## Portfolio Productization Notes

ArchiveOS is presented as an AI Agent Operations Platform, not a raw developer debug console.

- Dashboard prioritizes current status, risk, active work, achievements, and portfolio snapshot signals.
- Knowledge Graph uses rule-based importance so PMs can see which memory, decision, review, or incident matters most.
- Operators keeps PID/CPU/process details under technical diagnostics instead of making them the primary story.
- KPI cards include top-contributor interpretation so raw counts have operational meaning.
- Mesh relationships are read-only and expandable for traceability from agent relationship to related knowledge.
- Remote access can use `ARCHIVEOS_PUBLIC_URL` or `ARCHIVEOS_NGROK_URL` for the latest public frontend URL.
