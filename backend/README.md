# ArchiveOS Backend

## Current RAG Boundary

The Node/Express backend keeps PM operations, Agent state, Dashboard, Discord, MCP visibility, and existing Supabase operational data.

RAG and Obsidian ingestion are delegated to the Spring Boot `archiveos-ai` module.

Set:

```bash
ARCHIVEOS_AI_BASE_URL=http://localhost:4100
```

The Node endpoints below proxy to `archiveos-ai`:

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`

If `archiveos-ai` is unavailable or not configured, the backend returns a clear error instead of generating placeholder RAG output.

## AX / Obsidian / RAG APIs

The backend now exposes the AX transition layer defined in `docs/ARCHITECTURE_FULL.md`.

- `GET /api/ax/readiness`
- `GET /api/ax/roadmap`
- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`

Obsidian ingestion uses `OBSIDIAN_VAULT_PATH` or `ARCHIVEOS_OBSIDIAN_VAULT_PATH`.
It stores document metadata in `obsidian_documents` and chunk metadata in `obsidian_chunks`.

RAG MVP is reference-first and does not expose OpenAI calls to the frontend.
`OPENAI_API_KEY` remains backend-only.
ArchiveOS 諛깆뿏?쒕뒗 ?쒕쾭 痢??곌린, 紐낅졊 湲곕줉, 濡쒖뺄 ?고????곹깭 議고쉶瑜??꾪븳 理쒖냼 Express API?낅땲?? ?꾩옱 ?④퀎???곗꽑?쒖쐞???쎄린 ?꾩슜 PM 媛?쒗솕? ?덉쟾??湲곕줉?낅땲??

## 紐⑹쟻

???쒕퉬?ㅻ뒗 ?ν썑 ?덉쟾??Supabase ?쒕쾭 痢??곌린, GitHub Webhook, AI 由щ럭 ?묒뾽, MCP ?곕룞???꾪븳 湲곕컲?낅땲?? ?꾩옱 MVP?먯꽌???꾨줎?몄뿏?쒓? Supabase ?쎄린瑜?怨꾩냽 ?섑뻾?⑸땲??

諛깆뿏?쒕뒗 ?ㅼ쓬???쒓났?섏? ?딆뒿?덈떎.

- ?꾩쓽 ??紐낅졊 ?ㅽ뻾
- Codex ?꾨줈?몄뒪 吏곸젒 ?쒖뼱
- OpenAI API ?몄텧
- GitHub ?먮룞??- MCP 吏곸젒 ?ㅽ뻾

## ?ㅽ뻾 諛⑸쾿

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## ?섍꼍 蹂??
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

`SUPABASE_SERVICE_ROLE_KEY`??諛깆뿏???꾩슜 鍮꾨?媛믪엯?덈떎. Vite ?꾨줎?몄뿏?쒖뿉 ?몄텧?섏? 留먭퀬, `VITE_` ?묐몢?щ? 遺숈씠吏 留먭퀬, 而ㅻ컠?섏? 留덉꽭??

`ARCHIVEOS_PROJECT_PATH`??allowlisted local action???ㅽ뻾??ArchiveOS ??μ냼 猷⑦듃瑜?媛由ы궢?덈떎.

`CODEX_IMPLEMENTER_PID`, `CODEX_REVIEWER_PID`???섎룞?쇰줈 耳?Codex ?곕??먯쓣 ?쎄린 ?꾩슜?쇰줈 媛먯??섍린 ?꾪븳 濡쒖뺄 ?뚰듃?낅땲?? 鍮꾨?媛믪? ?꾨땲吏留??몄뀡蹂?媛믪씠誘濡?`.env`?먮쭔 ?〓땲??

`CORS_ALLOWED_ORIGINS`???대????먭꺽 ?뺤씤??ngrok ?꾨줎?몄뿏??origin???쇳몴濡?異붽??????ъ슜?⑸땲?? ?? `https://your-frontend-ngrok-url`

## 濡쒖뺄 ?≪뀡 蹂댁븞

ArchiveOS???ъ슜???낅젰?쇰줈 ?꾩쓽 ??紐낅졊???ㅽ뻾?섏? ?딆뒿?덈떎. 濡쒖뺄 ?꾨줈?앺듃 ?≪뀡? 誘몃━ ?뺤쓽??action ID瑜?怨좎젙??`spawn` 紐낅졊??留ㅽ븨?⑸땲?? ?붿껌 蹂몃Ц? ?꾩쓽 寃쎈줈???꾩쓽 紐낅졊 臾몄옄?댁쓣 ?쒓났?????놁뒿?덈떎.

## Supabase ?대씪?댁뼵??二쇱쓽?ы빆

諛깆뿏?쒕뒗 service role client濡?Supabase ?뚯씠釉??묒뾽???섑뻾?⑸땲?? service role key???쒕쾭?먯꽌留??ъ슜?댁빞 ?⑸땲??

## ?붾뱶?ъ씤??
### GET /health

諛깆뿏???곹깭瑜?諛섑솚?⑸땲??

### GET /api/work-logs/recent

理쒓렐 ?묒뾽 濡쒓렇 20媛쒕? `created_at` ?대┝李⑥닚?쇰줈 諛섑솚?⑸땲?? 媛?ν븳 寃쎌슦 task title怨?agent name???④퍡 ?ы븿?⑸땲??

### POST /api/work-logs

?쒕쾭 痢?Supabase admin client濡??묒뾽 濡쒓렇瑜??앹꽦?⑸땲??

```json
{
  "task_id": null,
  "agent_id": null,
  "log_type": "summary",
  "content": "吏㏃? ?묒뾽 濡쒓렇"
}
```

寃利??ㅻ쪟??`400`, Supabase ?먮뒗 ?쒕쾭 ?ㅻ쪟??鍮꾨?媛믪쓣 ?몄텧?섏? ?딄퀬 `500`??諛섑솚?⑸땲??

### GET /api/commands/recent

理쒓렐 command run 20媛쒕? `created_at` ?대┝李⑥닚?쇰줈 諛섑솚?⑸땲??

### POST /api/commands

?몃? ?≪뀡???ㅽ뻾?섏? ?딄퀬 紐낅졊 ?섎룄瑜?湲곕줉?⑸땲??

```json
{
  "command": "?꾩옱 ???붿빟",
  "command_type": "typed",
  "status": "pending"
}
```

?꾩옱 ???붾뱶?ъ씤?몃뒗 OpenAI, GitHub, MCP, ?몃? ?먮룞?붾? ?몄텧?섏? ?딆뒿?덈떎.

### GET /api/local-actions/projects

諛깆뿏?쒖뿉 ?뺤쟻?쇰줈 ?ㅼ젙??allowlisted local project瑜?諛섑솚?⑸땲??

### POST /api/local-actions/run

allowlisted local action ?섎굹瑜??ㅽ뻾?섍퀬 寃곌낵瑜?`command_runs`??湲곕줉?⑸땲??

```json
{
  "project_id": "archiveos",
  "action": "git_status"
}
```

?덉슜???≪뀡? `git_status`, `git_branch`, `git_log_recent`, `frontend_build`, `backend_typecheck`, `backend_build`?낅땲??

### GET /api/local-runtime/status

濡쒖뺄 Codex loop, implementer process, reviewer bridge process, queue folder瑜?媛먯? 媛?ν븳 踰붿쐞?먯꽌 ?쎄린 ?꾩슜?쇰줈 諛섑솚?⑸땲?? ???붾뱶?ъ씤?몃뒗 ?꾨줈?몄뒪瑜??쒖뼱?섏? ?딆쑝硫??ъ슜???쒓났 紐낅졊???ㅽ뻾?섏? ?딆뒿?덈떎.

## Nightly Review Batch / Daily Report Batch

ArchiveOS backend?먮뒗 PM ?댁쁺 ?붿빟 batch媛 ?ы븿?⑸땲?? batch??backend/local-worker?먯꽌留??ㅽ뻾?섎ŉ frontend UI??read-only ?곹깭 ?쒖떆留??⑸땲??

### Nightly Review Batch

```bash
npm run batch:nightly-review
```

?숈옉:

- ?꾨궇 湲곗? ?댁쁺 ?붿빟???앹꽦?⑸땲??
- MCP queue counts, 理쒖떊 builder/reviewer 寃곌낵, 理쒓렐 command_runs, 理쒓렐 decision work_logs瑜??쎌뒿?덈떎.
- `batch_runs` ?뚯씠釉붿뿉 `batch_type = nightly_review`, `status = completed`濡?湲곕줉?⑸땲??

### Daily Report Batch

```bash
npm run batch:daily-report
```

?숈옉:

- Asia/Seoul 湲곗? ?ㅻ뒛???쒓뎅 ?곸뾽?쇱씤吏 ?뺤씤?⑸땲??
- ?붿슂?쇰???湲덉슂?쇰쭔 Discord ?꾩넚 ?꾨낫?낅땲??
- ?좎슂???쇱슂?? ?쒓뎅 怨듯쑕?? ?泥닿났?댁씪?먮뒗 Discord瑜?蹂대궡吏 ?딄퀬 `status = skipped`濡?湲곕줉?⑸땲??
- 2026??怨듯쑕???泥닿났?댁씪? `src/batches/koreanHolidays.ts`???덉뒿?덈떎. ??由ъ뒪?몃뒗 留ㅻ뀈 媛깆떊?댁빞 ?⑸땲??
- ?대떦 ?곕룄 holiday data媛 ?놁쑝硫?fail-safe濡?Discord ?꾩넚??嫄대꼫?곷땲??

### Discord webhook

?섍꼍 蹂??

```bash
DISCORD_WEBHOOK_URL=
```

二쇱쓽:

- backend-only 媛믪엯?덈떎.
- frontend???몄텧?섏? ?딆뒿?덈떎.
- `VITE_` prefix瑜?遺숈씠吏 ?딆뒿?덈떎.
- 媛믪씠 ?놁쑝硫??쒕쾭 ?쒖옉? ?ㅽ뙣?섏? ?딆뒿?덈떎.
- Daily Report ?ㅽ뻾 ??`DISCORD_WEBHOOK_URL not configured` reason?쇰줈 `skipped` 湲곕줉???④퉩?덈떎.

### Batch API

Manual trigger endpoints??local/admin/testing ?⑸룄?낅땲?? UI ?ㅽ뻾 踰꾪듉? 異붽??섏? ?딆뒿?덈떎.

- `POST /api/batches/nightly-review/run`
- `POST /api/batches/daily-report/run`
- `GET /api/batches/recent`
- `GET /api/batches/latest`

### Suggested schedule

OS-level scheduler???꾩쭅 援ы쁽?섏? ?딆븯?듬땲?? ?댁쁺 ?④퀎?먯꽌 Windows Task Scheduler濡??꾨옒 ?쒓컖??npm script瑜??몄텧?섎뒗 諛⑹떇??沅뚯옣?⑸땲??

- Nightly Review: 23:50 KST daily
- Daily Report: 09:00 KST business days only
## ?쒓뎅??PM Daily Report 諛??덉뒪?좊━ ???
Daily Report???쒓뎅 ?낅Т??洹쒖튃???듦낵??寃쎌슦 Discord???쒓뎅??PM ?댁쁺 蹂닿퀬?쒕? ?꾩넚?⑸땲?? 硫붿떆吏?먮뒗 ?ㅼ쓬 ??ぉ???ы븿?⑸땲??

- ??곸씪
- ?댁쁺 ?곹깭: ?뺤긽, 二쇱쓽, 臾몄젣
- Runtime queue count
- 理쒖떊 Builder/Reviewer 寃곌낵 ?대쫫怨?verdict
- ?湲??묒뾽 ?붿빟
- Implementer, Reviewer, Loop, Reviewer Bridge 媛먯? ?곹깭
- 寃쎄퀬
- Decisions / Commands ??- `ARCHIVEOS_PUBLIC_URL`???ㅼ젙??寃쎌슦 Dashboard 留곹겕

?덉뒪?좊━??backend service-role ?곌린 寃쎈줈濡?Supabase????λ맗?덈떎.

- `batch_runs`: 諛곗튂 ?ㅽ뻾 ?곹깭
- `daily_reports`: 蹂닿퀬??蹂몃Ц, ?댁쁺 ?먯젙, Discord ?꾩넚/?앸왂 ?곹깭
- `runtime_snapshots`: queue count, 理쒖떊 寃곌낵 硫뷀??곗씠?? ?묒뾽???곹깭, 寃쎄퀬

?섍꼍 蹂??

```bash
DISCORD_WEBHOOK_URL=
ARCHIVEOS_PUBLIC_URL=
```

??媛믪? backend-only?낅땲?? Discord webhook? frontend 肄붾뱶???몄텧?섏? ?딆뒿?덈떎. `ARCHIVEOS_PUBLIC_URL`? ?좏깮 媛믪씠硫?蹂닿퀬???섎떒 Dashboard 留곹겕?먮쭔 ?ъ슜?⑸땲??

?섎룞 寃利?

```bash
npm run batch:nightly-review
npm run batch:daily-report
```

?쎄린 ?꾩슜 蹂닿퀬??API:

- `GET /api/reports/daily/latest`
- `GET /api/reports/daily/recent`
- `GET /api/runtime/snapshots/recent`

Discord Daily Report??Asia/Seoul 湲곗? ?붿슂??湲덉슂??以?`src/batches/koreanHolidays.ts`???뺤쓽???쒓뎅 怨듯쑕?쇨낵 ?泥닿났?댁씪???쒖쇅???낅Т?쇱뿉留??꾩넚?⑸땲?? 濡쒖뺄 怨듯쑕??紐⑸줉? 留ㅻ뀈 媛깆떊?댁빞 ?⑸땲??

## Historian Obsidian Export

Historian? backend/local-worker ?꾩슜 Markdown export 怨꾩링?낅땲?? ?꾩쭅 AI ?ㅽ뻾 Agent, Obsidian plugin, bidirectional sync, graph database媛 ?꾨떃?덈떎.

?섍꼍 蹂??

```bash
ARCHIVEOS_OBSIDIAN_VAULT_PATH=
```

?ㅼ젙?섏? ?딆쑝硫?export??disabled/skipped濡?湲곕줉?섍퀬 ?쒕쾭 ?쒖옉?대굹 Discord ?꾩넚??留됱? ?딆뒿?덈떎. ?ㅼ젙??寃쎌슦 諛곗튂 ?ㅽ뻾 ???ㅼ쓬 ?꾩튂??Markdown note瑜??앹꽦?⑸땲??

- `Reports/daily-report-YYYY-MM-DD.md`
- `Batches/nightly_review-YYYY-MM-DD.md`
- ?ν썑 ?섎룞/?먮룞 ?곌껐 ??? `Decisions/`, `Incidents/`, `Architecture/`

蹂댁븞 ?먯튃:

- ?덈? vault path??frontend??諛섑솚?섏? ?딆뒿?덈떎.
- metadata?먮뒗 ?곷? note path留???ν빀?덈떎.
- ?뚯씪紐낆? sanitize?⑸땲??
- resolved path媛 configured vault 諛뽰쑝濡??섍?硫?export瑜?嫄곕??⑸땲??

Historian ?곹깭 API:

- `GET /api/historian/status`

## Historian v2 Knowledge Graph MVP

Historian v2???ㅽ뻾 agent媛 ?꾨땲??Supabase metadata 愿怨????怨꾩링?낅땲?? ArchiveOS ?댁쁺 ?대깽?? 蹂닿퀬?? 寃곌낵, incident, Obsidian note ?ъ씠??蹂댁닔?곸씤 愿怨꾨쭔 ??ν빀?덈떎.

?뚯씠釉?

- `knowledge_nodes`
- `knowledge_edges`

?먮룞 ?앹꽦?섎뒗 ???愿怨?

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

Architect??backend ?대???鍮꾩떎???ㅺ퀎 寃??怨꾩링?낅땲?? ??MVP??LLM???몄텧?섏? ?딄퀬, Codex/MCP/shell???쒖뼱?섏? ?딆쑝硫? ?몃? ?먮룞?붾룄 ?ㅽ뻾?섏? ?딆뒿?덈떎. ?낅젰??task/decision/result/report ?ㅻ챸??deterministic rule濡?寃?ы븳 ??Supabase??湲곕줉?⑸땲??

????뚯씠釉?

- `architecture_reviews`
- `knowledge_nodes`??`node_type = architecture_review`
- `knowledge_edges`??`reviewed_architecture_of`, `references_memory` ??蹂댁닔??愿怨?
寃??洹쒖튃:

- Dashboard??read-only PM overview濡??좎??댁빞 ?⑸땲??
- ?꾩쓽 shell, direct MCP execution, Codex control? 李⑤떒 ?꾪뿕?쇰줈 遊낅땲??
- Historian/Knowledge MVP?먯꽌??embeddings, vector search, graph database, bidirectional Obsidian sync瑜?踰붿쐞 諛뽰쑝濡?遊낅땲??
- service role key, Discord webhook URL, Obsidian vault path??frontend???몄텧?섎㈃ ???⑸땲??
- Dashboard / Operators / Timeline / Settings瑜????묒뾽?먯꽌 怨쇰룄?섍쾶 ?욎쑝硫?遺꾪빐瑜?沅뚯옣?⑸땲??
- batch/report/runtime/backend/frontend ?묒뾽?먮뒗 `npm run build`, backend typecheck, backend build 寃利앹쓣 ?붽뎄?⑸땲??

API:

- `POST /api/architect/review`  
  local/admin/manual-test ?⑸룄?낅땲?? ?몃? 紐낅졊???ㅽ뻾?섏? ?딄퀬 Architecture Review留?湲곕줉?⑸땲??
- `GET /api/architect/reviews/recent`
- `GET /api/architect/reviews/latest`

Demo:

```bash
npm run architect:review-demo
```

?곕え ?낅젰? ?뺤쟻?대ŉ, Dashboard??process control button??異붽??섎젮???붽뎄瑜?寃?좏빐 read-only 寃쎄퀎 ?꾪뿕??湲곕줉?⑸땲??

## Agent Mesh Overview

Agent Mesh Overview??backend?먯꽌 ?뚯깮??read-only 愿怨??붿빟?낅땲?? ?ㅽ뻾 ?쒖뼱瑜??쒓났?섏? ?딆쑝硫? Codex/MCP/OpenAI/shell???몄텧?섏? ?딆뒿?덈떎.

Endpoint:

```bash
GET /api/mesh/overview
```

?묐떟? ?ㅼ쓬 ?곗씠?곕? ?ы븿?⑸땲??

- `agents`: Implementer, Reviewer, Architect, Historian, MCP Loop, Reviewer Bridge ?곹깭
- `links`: ??븷 媛?愿怨꾩? Knowledge Graph?먯꽌 ?뚯깮??蹂댁닔??愿怨?- `recentInteractions`: 理쒓렐 runtime/knowledge_graph interaction
- `health`: mesh ?꾩껜 ?곹깭? ?붿빟

?곗씠??異쒖쿂:

- local runtime status
- latest architecture review
- latest Historian export
- latest Knowledge Graph edges
- latest Daily Report warnings

?쒗븳:

- Agent 媛??먯쑉 硫붿떆吏뺤씠 ?꾨떃?덈떎.
- process start/stop 湲곕뒫???꾨떃?덈떎.
- UI ?ㅽ뻾 ?쒖뼱媛 ?꾨떃?덈떎.
- secret, webhook URL, Obsidian vault ?덈? 寃쎈줈瑜?諛섑솚?섏? ?딆뒿?덈떎.

## KPI Overview

KPI Overview??湲곗〈 ArchiveOS 湲곕줉?먯꽌 怨꾩궛?섎뒗 read-only analytics API?낅땲?? 蹂꾨룄 ?ㅽ뻾 ?쒖뼱, Codex ?쒖뼱, MCP ?ㅽ뻾, OpenAI API ?몄텧???섏? ?딆뒿?덈떎.

Endpoint:

```bash
GET /api/kpi/overview?range=today
GET /api/kpi/overview?range=7d
GET /api/kpi/overview?range=30d
```

怨꾩궛 異쒖쿂:

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

吏???뺤쓽:

- `approvalRate = approve / (approve + reject + stop) * 100`
- `graphDensity = knowledge_edges / knowledge_nodes`
- `warningCount = daily report warnings + runtime snapshot warnings + Architect warning/blocked rows`
- `loopDetectedRate`??runtime snapshot??operator summary?먯꽌 loop 媛먯? ?щ?媛 ?덈뒗 寃쎌슦?먮쭔 怨꾩궛?⑸땲??

?곗씠?곌? ?녾굅??荑쇰━?????녿뒗 吏?쒕뒗 null濡?諛섑솚?섍퀬 `notes`???댁쑀瑜??④퉩?덈떎. KPI???꾩옱 ?듦퀎 吏묎퀎?대ŉ LLM 遺꾩꽍, ?덉륫, ?먮룞 ?섏궗寃곗젙???ы븿?섏? ?딆뒿?덈떎.

## Knowledge Graph Visualization API

Knowledge Graph Visualization API??`knowledge_nodes`? `knowledge_edges`瑜?read-only graph payload濡?諛섑솚?⑸땲?? ??API??ArchiveOS Knowledge ??쓽 SVG/CSS 湲곕컲 洹몃옒???쒓컖?붿뿉 ?ъ슜?⑸땲??

Endpoint:

```bash
GET /api/knowledge/graph?limit=100
```

?묐떟:

- `nodes`: id, type, label, title, summary, source, externalRef, createdAt, metadata
- `edges`: id, from, to, type, label, confidence, createdAt, metadata
- `stats`: nodeCount, edgeCount, type counts

?뺤콉:

- default limit 100, max 300
- 理쒓렐 node/edge ?곗꽑
- 諛섑솚 node???ы븿??from/to瑜?媛吏?edge留?諛섑솚
- ?곗씠?곌? ?녾굅??荑쇰━ ?ㅽ뙣 ??鍮?graph payload瑜?諛섑솚??frontend ?꾩껜媛 源⑥?吏 ?딄쾶 ?⑸땲??
- Obsidian note??relative path留??몄텧?⑸땲??
- local absolute vault path, webhook URL, secret ?깃꺽 metadata???쒓굅?⑸땲??

??湲곕뒫? vector search, embeddings, graph database, Obsidian plugin, bidirectional sync媛 ?꾨떃?덈떎. ?꾩옱???댁쁺 湲곗뼲 愿怨꾨? ?쒓컖?곸쑝濡??댄빐?섍린 ?꾪븳 MVP?낅땲??

?쒗븳:

- OpenAI API ?놁쓬
- embeddings/vector search ?놁쓬
- graph database ?놁쓬
- recursive traversal ?놁쓬
- Obsidian ?묐갑??sync ?놁쓬
- ?덈? vault path ?몄텧 ?놁쓬
## ArchiveOS v1.0 Hardening Reference

Endpoint Health, Public Access/ngrok runtime sync, and portfolio readiness documentation:

```text
../docs/ARCHIVEOS_V1_HARDENING.md
```

Backend-only environment variables used by this layer:

```bash
ARCHIVEOS_PUBLIC_URL=
ARCHIVEOS_BACKEND_PUBLIC_URL=
```

These values are exposed only as configured yes/no or public URL status. Secrets, service role keys, Discord webhook values, and absolute Obsidian vault paths remain backend-only.
## Knowledge Graph Importance Insights

The backend enriches Knowledge Graph responses with rule-based importance metadata.

Endpoints:

```bash
GET /api/knowledge/graph?limit=100
GET /api/knowledge/graph/insights?limit=100
```

The importance layer is computed from existing Supabase rows only:

- node degree, in-degree, and out-degree
- recent node/edge references
- node type weighting for decisions, architecture reviews, incidents, daily reports, and nightly reviews
- links to decision, Architect, and incident context

This is not vector search, not embeddings, not a graph database, and not LLM reasoning. It is read-only metadata for PM traceability and portfolio visualization.

## Public URL / ngrok Alias

For mobile and portfolio demos, the backend reports the public frontend URL from:

```bash
ARCHIVEOS_PUBLIC_URL=
ARCHIVEOS_NGROK_URL=
```

`ARCHIVEOS_PUBLIC_URL` takes priority. `ARCHIVEOS_NGROK_URL` is accepted as a convenience alias for the latest frontend ngrok URL. Backend public URL still uses `ARCHIVEOS_BACKEND_PUBLIC_URL`.

## Supabase Keep-Alive Batch

무료 티어 Supabase 프로젝트의 inactivity pause를 줄이기 위한 backend/local-worker 전용 배치입니다. UI 실행 제어가 아니며 secret 값은 frontend에 노출하지 않습니다.

```bash
npm run batch:supabase-keepalive
```

필요 env:

```env
RH_HEALTHCARE_SUPABASE_URL=
RH_HEALTHCARE_SUPABASE_PUBLISHABLE_KEY=
RH_HEALTHCARE_PAUSED_SUPABASE_URL=
RH_HEALTHCARE_PAUSED_SUPABASE_PUBLISHABLE_KEY=
```

ArchiveOS 대상은 기존 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다. RH Healthcare 대상은 publishable key로 REST endpoint를 가볍게 호출합니다. 결과는 `batch_runs`에 `batch_type = supabase_keepalive`로 저장됩니다.

권장 스케줄: Windows Task Scheduler에서 매일 10:00 KST에 `npm run batch:supabase-keepalive` 실행.

Repository root에서 실행 가능한 helper:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/run-supabase-keepalive.ps1"
```
