# ArchiveOS

## Current AX RAG Implementation

ArchiveOS now separates operational PM visibility from AI/RAG execution.

- Node/Express backend: PM dashboard, runtime visibility, Discord, MCP status, existing Supabase operational data.
- `archiveos-ai`: Spring Boot + Spring AI service for Obsidian ingestion, embeddings, pgvector search, and RAG answers.
- Default Vector DB: Supabase PostgreSQL with pgvector.
- Local fallback Vector DB: `docker-compose.yml` postgres service using `pgvector/pgvector:pg16`.

Key APIs:

- `POST /api/obsidian/sync`
- `GET /api/obsidian/documents`
- `GET /api/rag/search?query=...`
- `POST /api/rag/ask`
- `GET /api/ai/runtime` on `archiveos-ai`

`OPENAI_API_KEY`, Supabase service role keys, Discord webhooks, and local vault paths remain backend-only. If `OPENAI_API_KEY` is missing, RAG endpoints return HTTP 503 instead of fake success.

Run Java tests:

```bash
cd archiveos-ai
.\gradlew.bat test --no-daemon
```

## AX Platform Extension

ArchiveOS now includes an AX roadmap implementation layer based on `docs/ARCHITECTURE_FULL.md`.

- Status document: [docs/AX_IMPLEMENTATION_STATUS.md](docs/AX_IMPLEMENTATION_STATUS.md)
- AX readiness API: `GET /api/ax/readiness`
- AX roadmap API: `GET /api/ax/roadmap`
- Obsidian sync API: `POST /api/obsidian/sync`
- RAG search API: `GET /api/rag/search?query=...`
- RAG ask API: `POST /api/rag/ask`
- Spring Boot module skeleton: `archiveos-ai`
- Docker Compose entrypoint: `docker-compose.yml`

The AX extension remains backend-controlled. OpenAI keys, Discord webhooks, Supabase service role keys, and local Obsidian vault paths are never exposed to the frontend.
v1.0 ?섎뱶?? Endpoint Health, ngrok ?고????숆린???덉감??[docs/ARCHIVEOS_V1_HARDENING.md](docs/ARCHIVEOS_V1_HARDENING.md)瑜?湲곗??쇰줈 ?뺤씤?⑸땲??

ArchiveOS??AI ?먯씠?꾪듃 ?묒뾽??PM 愿?먯뿉??愿李고븯怨?湲곕줉?섍린 ?꾪븳 ?댁쁺 ??쒕낫?쒖엯?덈떎. React, Vite, TypeScript, Tailwind CSS, Supabase, Express 湲곕컲?쇰줈 援ъ꽦?섏뼱 ?덉뒿?덈떎.

?꾩옱 ?④퀎???듭떖 諛⑺뼢? **?ㅽ뻾 肄섏넄???꾨땲???쎄린 ?꾩슜 PM 媛?쒗솕 ??쒕낫??*?낅땲?? OpenAI API ?몄텧, GitHub Webhook ?먮룞?? MCP 吏곸젒 ?ㅽ뻾 ?쒖뼱, Codex 吏곸젒 ?쒖뼱???꾩쭅 ?ы븿?섏? ?딆뒿?덈떎.

## ?꾩옱 MVP 踰붿쐞

- ?먯씠?꾪듃 紐⑸줉: ?대쫫, ??븷, ?곹깭, ?꾩옱 ?묒뾽
- ?묒뾽 ?? ?곹깭蹂??묒뾽 ?먮쫫怨??대떦 ?먯씠?꾪듃
- ?묒뾽 濡쒓렇: ?붿빟, 寃곗젙, ?ㅻ쪟, 由щ럭 湲곕줉
- Memory / Decisions: `work_logs` 以?`log_type = 'decision'`??寃곗젙 湲곕줉 ?쒖떆
- Supabase 吏곸젒 ?쎄린: ?꾨줎?몄뿏?쒕뒗 ?꾩옱 MVP ?곗씠??議고쉶瑜??꾪빐 Supabase瑜?吏곸젒 ?쎌뒿?덈떎.
- 諛깆뿏??API: ?쒕쾭 痢??곌린, 紐낅졊 湲곕줉, ?고????곹깭 議고쉶??湲곕컲
- Command Center: 鍮좊Ⅸ ?≪뀡怨??낅젰 紐낅졊??**?ㅽ뻾?섏? ?딄퀬 湲곕줉**?⑸땲??
- Event Timeline: MCP ?고??? 諛깆뿏???먮떒, Supabase 湲곕줉???붿빟???쎄린 ?꾩슜 ??꾨씪??- Data Consistency: ?꾨줎?몄뿏???쒖떆媛? 諛깆뿏??API, MCP ???곹깭媛 ?쇱튂?섎뒗吏 ?뺤씤

## ArchiveOS????븷

ArchiveOS???щ엺???щ윭 Git Bash, Codex ?몄뀡, ???대뜑, 濡쒓렇 ?뚯씪??吏곸젒 ?ㅼ?吏 ?딆븘???꾩옱 AI ?묒뾽 ?곹깭瑜?蹂????덇쾶 留뚮뱶??PM ?댁쁺 ?붾㈃?낅땲??

- ?꾩옱 ?대뼡 ?묒뾽??吏꾪뻾 以묒씤吏 ?뺤씤?⑸땲??
- 援ы쁽?먯? 由щ럭???꾨줈?몄뒪媛 媛먯??섎뒗吏 ?쒖떆?⑸땲??
- 鍮뚮뜑 寃곌낵? 由щ럭 寃곌낵 ?뚯씪???쎄린 ?꾩슜?쇰줈 蹂댁뿬以띾땲??
- ?뱀씤, 諛섎젮, 寃곗젙? 湲곕줉留??섎ŉ ?ㅼ젣 ?먮룞 ?ㅽ뻾? ?섏? ?딆뒿?덈떎.
- 鍮?inbox ?곹깭瑜??μ븷濡??ㅽ빐?섏? ?딅룄濡?idle ?곹깭? ?ㅽ뙣 ?곹깭瑜?援щ텇?⑸땲??

## DeepStake3D ?곌퀎 ?ㅻ챸

DeepStake3D??ArchiveOS媛 愿李고븯??????묒뾽 ?꾨줈?앺듃?낅땲?? Unity 湲곕컲 3D 寃뚯엫 PoC?대ŉ, ?꾩옱??ModularConstructionPrototype??以묒떖?쇰줈 諛곗튂, ?뚯쟾, ?쒓굅, ???蹂듭썝, chunk/tile 湲곕컲 寃利? settlement-scale 寃利앹쓣 ?뺤옣?섎뒗 ?④퀎?낅땲??

ArchiveOS??DeepStake3D瑜?吏곸젒 ?ㅽ뻾?섍굅??Unity瑜??쒖뼱?섏? ?딆뒿?덈떎. ???MCP ?? 鍮뚮뜑 寃곌낵, 由щ럭 寃곌낵, ?뚯뒪???붿빟, ?고???寃쎄퀬瑜??쎌뼱 PM???묒뾽 ?먮쫫???뚯븙?????덇쾶 ?⑸땲??

?꾩옱 DeepStake3D ?ㅻ챸?먯꽌 ?뺥솗??援щ텇?댁빞 ?섎뒗 ?곹깭???ㅼ쓬怨?媛숈뒿?덈떎.

- 援ы쁽 ?꾨즺: Unity ?꾨줈?앺듃 援ъ“, 3D PoC ?붾㈃, ModularConstructionPrototype??湲곕낯 諛곗튂/???蹂듭썝 寃利?- PoC ?섏?: ?붾뱶/嫄곗젏/?곹샇?묒슜 HUD, chunk 湲곕컲 嫄댁꽕 ?곗씠??寃利?- ?ν썑 ?뺤옣 ?덉젙: AI NPC, ?숈쟻 ?섏뒪?? ?洹쒕え ?쒓뎅???띿큿/?꾩떆/?쒖꽕 吏??- 誘멸뎄???먮뒗 ?쒗븳?ы빆: ?곸슜 寃뚯엫 ?꾩꽦 ?④퀎媛 ?꾨땲硫? AI NPC? ?숈쟻 ?섏뒪?몃뒗 ?꾩쭅 援ы쁽 ?꾨즺媛 ?꾨떃?덈떎.

## Command Center

Command Center??鍮좊Ⅸ ?≪뀡, ?낅젰 紐낅졊, 諛깆뿏???곹깭, 理쒓렐 紐낅졊 湲곕줉??蹂댁뿬以띾땲?? ?꾩옱 紐낅졊? 諛깆뿏??`command_runs` ?됱쑝濡쒕쭔 湲곕줉?⑸땲??

紐낅졊? OpenAI, GitHub, MCP, Codex, ?몃? ?먮룞?붾줈 ?꾨떖?섏? ?딆뒿?덈떎. ?ъ슜?먭? ?낅젰???꾩쓽 ??紐낅졊???ㅽ뻾?섏? ?딆뒿?덈떎.

## Event Timeline

Event Timeline? `GET /api/runtime/events/recent`瑜??몄텧?섏뿬 湲곗〈 ?고????뚯뒪?먯꽌 ?뚯깮???대깽?몃? ?쒖떆?⑸땲??

?ъ슜?섎뒗 ?뚯뒪:

- MCP ?먯? ?고????뚯씪
- 理쒖떊 鍮뚮뜑/由щ럭??寃곌낵
- 諛깆뿏???고????먮떒
- seed/demo媛 ?꾨땶 Supabase `command_runs`
- seed/demo媛 ?꾨땶 decision `work_logs`

ArchiveOS???꾩쭅 蹂꾨룄 ?대깽??踰꾩뒪瑜?留뚮뱾吏 ?딆뒿?덈떎. ??꾨씪?몄? PM 留λ씫???꾪븳 ?붿빟?대ŉ, ?꾩껜 鍮뚮뜑/由щ럭??濡쒓렇瑜??泥댄븯吏 ?딆뒿?덈떎.

## MVP ?덉젙??
ArchiveOS??E2E PM 媛?쒗솕 ?뚯뒪?몃? ?꾪빐 Data Consistency ?⑤꼸怨?E2E Test Readiness 泥댄겕由ъ뒪?몃? ?쒓났?⑸땲??

???⑤꼸? ?묒뾽 ?쒖옉, MCP 紐낅졊 ?ㅽ뻾, OpenAI ?몄텧, Codex ?쒖뼱瑜??섏? ?딆뒿?덈떎. ?ㅼ쭅 ?ㅼ쓬 ?곹깭瑜??쒖떆?⑸땲??

- MCP ??移댁슫??- 諛깆뿏??API ??移댁슫??- ?꾨줎?몄뿏?쒖뿉 ?쒖떆????移댁슫??- 理쒖떊 鍮뚮뜑/由щ럭??寃곌낵 ?뚯씪紐?- `command_runs` ?곌껐 ?곹깭
- `work_logs`? decision ?곌껐 ?곹깭

?섎룞 E2E 媛?쒗솕 ?뚯뒪??

```bash
cd /c/Users/dan18/Documents/Codex/2026-05-20/create-a-new-project-named-archiveos/ArchiveOS

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/status.ps1"
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/api/local-runtime/status
npm run build
cd backend && npm run typecheck && npm run build
```

釉뚮씪?곗??먯꽌 ?뺤씤:

```bash
start http://127.0.0.1:5173/
```

?깃났 湲곗?:

- ArchiveOS ?꾨줎?몄뿏?쒖? 諛깆뿏?쒓? ?ㅽ뻾 以묒엯?덈떎.
- Data Consistency ?⑤꼸????移댁슫?몃? ?ㅻ쪟 ?놁씠 ?쒖떆?⑸땲??
- `command_runs`? `work_logs` ?곌껐 ?곹깭媛 `error`媛 ?꾨떃?덈떎.
- `inbox=0` idle ?곹깭? 猷⑦봽 ?ㅽ뙣 ?곹깭媛 援щ텇?⑸땲??
- Codex ?ъ슜???쒗븳?쇰줈 reviewer verdict媛 `stop`??寃쎌슦 ?고???異⑸룎???꾨땲???ъ슜???쒗븳 以묐떒?쇰줈 ?쒖떆?⑸땲??
- MCP 寃곌낵 ?뚯씪???덉쑝硫?理쒖떊 鍮뚮뜑/由щ럭???뚯씪紐낆씠 ?쒖떆?⑸땲??

## ?ㅽ뻾 諛⑸쾿

?섏〈???ㅼ튂:

```bash
npm install
```

?꾨줎?몄뿏???섍꼍 ?뚯씪 ?앹꽦:

```bash
cp .env.example .env.local
```

?꾩닔 ?섍꼍 蹂??

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_BACKEND_URL=http://localhost:4000
```

?꾨줎?몄뿏?쒖뿉??Supabase publishable/anon key留??ｌ뒿?덈떎. secret key??service role key瑜?`.env.local`???ｌ? 留덉꽭??

Supabase SQL editor?먯꽌 ?ㅼ쓬 ?쒖꽌濡??ㅽ뻾?⑸땲??

```sql
-- supabase/schema.sql
-- supabase/seed.sql
```

?꾨줎?몄뿏???ㅽ뻾:

```bash
npm run dev
```

鍮뚮뱶:

```bash
npm run build
```

## 紐⑤컮???먭꺽 ?묒냽

?대??곗뿉??ArchiveOS瑜??뺤씤?섎젮硫?ngrok 媛숈? HTTPS ?곕꼸濡??꾨줎?몄뿏?쒖? 諛깆뿏?쒕? 媛곴컖 ?몄텧?⑸땲??

?꾨줎?몄뿏??`.env.local` ?덉떆:

```bash
VITE_BACKEND_URL=https://your-backend-ngrok-url
VITE_REMOTE_FRONTEND_URL=https://your-frontend-ngrok-url
VITE_REMOTE_BACKEND_URL=https://your-backend-ngrok-url
```

諛깆뿏??`.env` ?덉떆:

```bash
CORS_ALLOWED_ORIGINS=https://your-frontend-ngrok-url
```

Settings ??쓽 Remote Access ?뱀뀡? ?꾩옱 ?꾨줎?몄뿏??URL, 諛깆뿏??URL, online/offline ?곹깭瑜??쒖떆?⑸땲?? ??湲곕뒫? 紐⑤컮??媛?쒗솕?⑹씠硫?ngrok ?쒖옉, MCP ?ㅽ뻾, Codex ?쒖뼱, ?꾩쓽 紐낅졊 ?ㅽ뻾???섏? ?딆뒿?덈떎.

吏????곸쑝濡?蹂대뒗 ?붾㈃:

- Galaxy Fold
- Android Chrome
- iPhone Safari

## 諛깆뿏??API

`backend/` ?쒕퉬?ㅻ뒗 ?쒕쾭 痢??곌린? ?ν썑 ?듯빀???꾪븳 湲곕컲?낅땲?? ?꾩옱 ?꾨줎?몄뿏?쒕뒗 Supabase ?쎄린瑜??좎??섎ŉ, 諛깆뿏?쒓? UI ?쒖떆瑜??꾩쟾???泥댄븯吏???딆뒿?덈떎.

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

諛깆뿏???섍꼍 蹂??

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

`SUPABASE_SERVICE_ROLE_KEY`??諛깆뿏???꾩슜?낅땲?? `VITE_` ?묐몢?щ? 遺숈씠嫄곕굹 ?꾨줎?몄뿏??肄붾뱶???몄텧?섎㈃ ???⑸땲??

## 濡쒖뺄 ?고????ㅼ??ㅽ듃?덉씠??
ArchiveOS???щ윭 Git Bash 李쎌쓣 以꾩씠湲??꾪빐 濡쒖뺄 PowerShell ?ㅽ겕由쏀듃瑜??쒓났?⑸땲?? ???꾧뎄??ArchiveOS ?꾨줎?몄뿏?? 諛깆뿏?? MCP ??猷⑦봽, reviewer bridge, ?좏깮??watcher瑜??쒖옉/以묒?/議고쉶?????덉뒿?덈떎.

ArchiveOS UI?먮뒗 ?꾨줈?몄뒪 ?쒖뼱 湲곕뒫???몄텧?섏? ?딆뒿?덈떎. Codex 援ы쁽??由щ럭???몄뀡? ?ъ쟾???섎룞?쇰줈 ?쒖옉?섍퀬 PID ?뚰듃濡?媛먯??⑸땲??

?ㅼ젙 蹂듭궗:

```bash
cp tools/runtime/runtime.config.example.json tools/runtime/runtime.config.json
notepad tools/runtime/runtime.config.json
```

?쒖옉:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/start-all.ps1"
```

?곹깭 ?뺤씤:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/status.ps1"
```

以묒?:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/stop-all.ps1"
```

git?먯꽌 ?쒖쇅?섎뒗 濡쒖뺄 ?뚯씪:

- `tools/runtime/runtime.config.json`
- `tools/runtime/logs/`
- `tools/runtime/pids/`

## ?꾨줈?앺듃 援ъ“

- `src/lib/supabase.ts`: Supabase 釉뚮씪?곗? ?대씪?댁뼵??- `src/App.tsx`: PM ?댁쁺 ??쒕낫??UI
- `src/types/database.ts`: Supabase ?뚯씠釉????- `supabase/schema.sql`: enum, table, index, RLS, grant ?뺤쓽
- `supabase/seed.sql`: ?섑뵆 ?먯씠?꾪듃, ?묒뾽, 濡쒓렇 ?곗씠??- `backend/src/server.ts`: Express API
- `backend/src/lib/supabaseAdmin.ts`: ?쒕쾭 ?꾩슜 Supabase admin client
- `backend/src/lib/localRuntime.ts`: 濡쒖뺄 Codex/MCP ?고????곹깭 ?쎄린
- `tools/runtime/`: 濡쒖뺄 ?꾩슜 ?꾨줈?몄뒪 ?ㅼ??ㅽ듃?덉씠???ㅽ겕由쏀듃

## Nightly Review Batch / Daily Report Batch

ArchiveOS??PM 媛?쒗솕 紐⑹쟻???댁쁺 ?붿빟 batch瑜??쒓났?⑸땲?? ??湲곕뒫? backend/local-worker?먯꽌留??숈옉?섎ŉ, UI?먯꽌 MCP ?ㅽ뻾, Codex ?쒖뼱, ?꾩쓽 shell ?ㅽ뻾???섏? ?딆뒿?덈떎.

Nightly Review Batch:

- ?꾨궇 ArchiveOS ?댁쁺 ?곹깭瑜??쎄린 ?꾩슜?쇰줈 ?붿빟?⑸땲??
- MCP queue counts, 理쒖떊 builder/reviewer 寃곌낵, 理쒓렐 command_runs, work_logs decisions瑜??붿빟?⑸땲??
- 寃곌낵??`batch_runs` ?뚯씠釉붿뿉 `batch_type = nightly_review`濡???λ맗?덈떎.

Daily Report Batch:

- Asia/Seoul 湲곗? ?ㅻ뒛???쒓뎅 ?곸뾽?쇱씤吏 ?뺤씤?⑸땲??
- ?붿슂?쇰???湲덉슂?쇰쭔 ?꾩넚 ?꾨낫?낅땲??
- ?좎슂???쇱슂?? ?쒓뎅 怨듯쑕?? ?泥닿났?댁씪?먮뒗 Discord瑜?蹂대궡吏 ?딄퀬 `skipped`濡?湲곕줉?⑸땲??
- 2026???쒓뎅 怨듯쑕???泥닿났?댁씪? `backend/src/batches/koreanHolidays.ts`??濡쒖뺄 由ъ뒪?몃줈 愿由ы빀?덈떎.
- holiday list媛 ?녿뒗 ?곕룄??fail-safe濡?Discord瑜?蹂대궡吏 ?딆뒿?덈떎.

Discord webhook ?ㅼ젙? backend ?꾩슜?낅땲??

```bash
cd backend
cp .env.example .env

# backend/.env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

`DISCORD_WEBHOOK_URL`? frontend???몄텧?섏? ?딆뒿?덈떎. 媛믪씠 ?놁쑝硫?Daily Report???ㅽ뙣?섏? ?딄퀬 `skipped` ?곹깭? `DISCORD_WEBHOOK_URL not configured` reason??湲곕줉?⑸땲??

?섎룞 ?뚯뒪??

```bash
cd backend
npm run batch:nightly-review
npm run batch:daily-report
```

沅뚯옣 ?ㅼ?以?

- Nightly Review: 留ㅼ씪 23:50 KST
- Daily Report: 留??곸뾽??09:00 KST

?꾩옱 OS-level scheduler??援ы쁽?섏? ?딆븯?듬땲?? Windows Task Scheduler ?ㅼ젙? 異뷀썑 ?댁쁺 ?④퀎?먯꽌 蹂꾨룄濡??곌껐?⑸땲??
## ?쒓뎅??PM Daily Report 諛??덉뒪?좊━ ???
Daily Report Discord 硫붿떆吏???쒓뎅??PM ?댁쁺 蹂닿퀬???뺤떇?쇰줈 ?꾩넚?⑸땲?? 蹂닿퀬?쒖뿉????곸씪, ?댁쁺 ?곹깭 ?먯젙, queue count, 理쒖떊 Builder/Reviewer 寃곌낵, ?湲??묒뾽, ?묒뾽??媛먯? ?곹깭, 寃쎄퀬, Decisions/Commands ?? `ARCHIVEOS_PUBLIC_URL`???ㅼ젙??寃쎌슦 Dashboard 留곹겕媛 ?ы븿?⑸땲??

Daily Report ?꾩넚? backend-only?낅땲?? Discord??Asia/Seoul 湲곗? ?붿슂??湲덉슂??以?`backend/src/batches/koreanHolidays.ts`???뺤쓽???쒓뎅 怨듯쑕?쇨낵 ?泥닿났?댁씪???쒖쇅???낅Т?쇱뿉留??꾩넚?⑸땲?? ?뱁썒???녾굅???꾩넚???앸왂??寃쎌슦 ?쒕쾭 ?쒖옉???ㅽ뙣?쒗궎吏 ?딄퀬 ?ъ쑀瑜?湲곕줉?⑸땲??

?댁쁺 ?덉뒪?좊━??Supabase???꾩쟻?⑸땲??

- `batch_runs`: 諛곗튂 ?ㅽ뻾 ?곹깭
- `daily_reports`: ?쒓뎅??蹂닿퀬??蹂몃Ц, ?댁쁺 ?곹깭, Discord ?꾩넚/?앸왂 ?곹깭
- `runtime_snapshots`: queue count, 理쒖떊 寃곌낵 硫뷀??곗씠?? ?묒뾽???붿빟, 寃쎄퀬

?섎룞 寃利?紐낅졊:

```bash
cd backend
npm run batch:nightly-review
npm run batch:daily-report
```

Backend-only ?섍꼍 蹂??

```bash
DISCORD_WEBHOOK_URL=
ARCHIVEOS_PUBLIC_URL=
```

## Historian Obsidian Markdown Export

Historian? ?꾩쭅 AI ?ㅽ뻾 Agent媛 ?꾨떃?덈떎. ?꾩옱 踰꾩쟾??Historian? ArchiveOS ?댁쁺 湲곗뼲??濡쒖뺄 Obsidian vault??Markdown ?뚯씪濡?export?섎뒗 backend/local-only 湲곕뒫?낅땲??

??븷 遺꾨━:

- ArchiveOS: ?꾩옱 runtime ?곹깭, queue, decisions, batch, PM dashboard
- Obsidian vault: ?κ린 湲곗뼲, ?댁쁺 蹂닿퀬?? 寃곗젙 湲곕줉, incident, architecture note

Backend-only ?섍꼍 蹂??

```bash
ARCHIVEOS_OBSIDIAN_VAULT_PATH=
```

?ㅼ젙?섏? ?딆쑝硫?Historian? disabled ?곹깭媛 ?섎ŉ ?쒕쾭 ?쒖옉怨?諛곗튂 ?ㅽ뻾? ?ㅽ뙣?섏? ?딆뒿?덈떎. frontend?먮뒗 configured yes/no? 留덉?留?export ?곷? 寃쎈줈留??쒖떆?섍퀬, ?덈? vault path???몄텧?섏? ?딆뒿?덈떎.

Markdown export ????대뜑:

- `Daily/`
- `Decisions/`
- `Incidents/`
- `Architecture/`
- `Reports/`
- `Batches/`

?꾩옱 ?먮룞 ?곌껐:

- Daily Report Batch ?꾨즺 ??`Reports/daily-report-YYYY-MM-DD.md` export
- Nightly Review Batch ?꾨즺 ??`Batches/nightly_review-YYYY-MM-DD.md` export

紐낆떆???쒗븳:

- Obsidian bidirectional sync ?놁쓬
- Obsidian plugin ?놁쓬
- graph database ?놁쓬
- UI file browser/edit ?놁쓬
- OpenAI API, Codex 吏곸젒 ?쒖뼱, MCP ?ㅽ뻾 ?쒖뼱 ?놁쓬

## Historian v2 Knowledge Graph MVP

Historian v2???꾩껜 graph database媛 ?꾨땲??Supabase metadata 愿怨??뚯씠釉?湲곕컲??Knowledge Graph MVP?낅땲?? 紐⑹쟻? PM??"???대윴 ?쇱씠 諛쒖깮?덈뒗媛"? "?대뼡 湲곕줉???곌껐?섏뼱 ?덈뒗媛"瑜?鍮좊Ⅴ寃??뺤씤?섎뒗 寃껋엯?덈떎.

???紐⑤뜽:

- `knowledge_nodes`: task, builder_result, reviewer_result, decision, incident, daily_report, nightly_review, batch_run, command, obsidian_note, architecture_note
- `knowledge_edges`: exported_to, reviewed_by, mentioned_in, relates_to ??蹂댁닔?곸씤 愿怨?
?먮룞 ?곌껐:

- Daily Report ??Obsidian note: `exported_to`
- Nightly Review ??Obsidian note: `exported_to`
- Builder result ??Reviewer result: `reviewed_by`
- Warning/incident ??report/review: `mentioned_in`

紐낆떆???쒗븳:

- vector search ?놁쓬
- embeddings ?놁쓬
- graph database ?놁쓬
- recursive graph traversal ?놁쓬
- Obsidian bidirectional sync ?놁쓬
- ?덈? vault path frontend ?몄텧 ?놁쓬

?쎄린 ?꾩슜 API:

- `GET /api/knowledge/overview`
- `GET /api/knowledge/recent`
- `GET /api/knowledge/node/:id`
- `GET /api/knowledge/search?q=`
- `GET /api/knowledge/related?external_ref=`

## Architect Agent MVP

Architect???ㅽ뻾 Agent媛 ?꾨땲??鍮꾩떎???ㅺ퀎 寃????븷?낅땲?? ?꾩옱 MVP??OpenAI API, Codex ?쒖뼱, MCP ?ㅽ뻾, shell ?ㅽ뻾???꾪? ?ъ슜?섏? ?딄퀬, 湲곗〈 ?고????곗씠?곗? ?묒뾽 ?ㅻ챸??洹쒖튃 湲곕컲?쇰줈 寃?ы빐 `architecture_reviews`??湲곕줉?⑸땲??

Architect媛 ?뺤씤?섎뒗 二쇱슂 ?꾪뿕:

- Dashboard???ㅽ뻾/?꾨줈?몄뒪 ?쒖뼱媛 ?욎씠??寃쎄퀎 ?꾨컲
- ?꾩쓽 shell, MCP 吏곸젒 ?ㅽ뻾, Codex 吏곸젒 ?쒖뼱 媛숈? ?ㅽ뻾 ?꾪뿕
- Historian/Knowledge 踰붿쐞?먯꽌 bidirectional sync, graph database, embeddings 媛숈? MVP ???뺤옣
- webhook URL, service role key, Obsidian vault ?덈? 寃쎈줈??frontend ?몄텧 ?꾪뿕
- Dashboard / Operators / Timeline / Settings 梨낆엫?????묒뾽??怨쇰룄?섍쾶 ?욎씠??寃쎌슦
- batch/report/runtime 蹂寃쎌뿉??鍮뚮뱶? backend 寃利??꾨씫

寃곌낵??Supabase `architecture_reviews`????λ릺怨? Knowledge Graph?먮뒗 `architecture_review` ?몃뱶濡??곌껐?⑸땲?? 媛?ν븳 寃쎌슦 愿??Knowledge node? `reviewed_architecture_of`, `references_memory` edge瑜??앹꽦?⑸땲??

?쎄린 ?꾩슜 API:

- `GET /api/architect/reviews/latest`
- `GET /api/architect/reviews/recent`

?섎룞 ?뚯뒪?몄슜 湲곕줉 API:

- `POST /api/architect/review`

Backend demo:

```bash
cd backend
npm run architect:review-demo
```

???곕え??`Add process control buttons to Dashboard`?쇰뒗 ?덉쟾???뺤쟻 ?낅젰??湲곕줉?섍퀬, Dashboard read-only ?먯튃 ?꾨컲??warning/blocked ?깃꺽??Architecture Review濡??④퉩?덈떎.

## Agent Mesh View MVP

Agent Mesh View??ArchiveOS ??븷?ㅼ씠 ?쒕줈 ?대뼡 愿怨꾨줈 ?댁쁺?섎뒗吏 蹂댁뿬二쇰뒗 read-only 媛?쒗솕 ?붾㈃?낅땲?? ?닿쾬? Agent 媛??먯쑉 ??? MCP ?ㅽ뻾, Codex 吏곸젒 ?쒖뼱, ?꾨줈?몄뒪 start/stop 湲곕뒫???꾨떃?덈떎.

Mesh ??? ?ㅼ쓬 ?뺣낫瑜?backend?먯꽌 ?뚯깮???쒖떆?⑸땲??

- Implementer, Reviewer, Architect, Historian, MCP Loop, Reviewer Bridge ?곹깭
- Human PM??以묒떖?쇰줈 ????븷 愿怨?- builder result -> reviewer result, daily report -> Obsidian note, architecture review -> related memory 媛숈? Knowledge Graph 湲곕컲 愿怨?- 理쒓렐 interaction怨?link source
- Mesh health, active agents, warning count

API:

```bash
GET /api/mesh/overview
```

Mesh View??紐⑹쟻? PM??"?꾧? ?대뼡 ??븷???섍퀬 ?덇퀬, ?대뼡 湲곗뼲/寃??寃곌낵媛 ?곌껐?섏뼱 ?덈뒗吏"瑜?鍮좊Ⅴ寃?蹂대뒗 寃껋엯?덈떎. ?ν썑 ?ㅼ젣 multi-agent coordination?대굹 agent message bus瑜?遺숈씪 ???덉?留? ?꾩옱 MVP??metadata-only visibility layer?낅땲??

## KPI Dashboard MVP

KPI Dashboard??ArchiveOS ?댁쁺 ?곹깭瑜??뺣웾?뷀븯??read-only analytics ?붾㈃?낅땲?? OpenAI API, MCP ?ㅽ뻾, Codex 吏곸젒 ?쒖뼱, shell ?ㅽ뻾, process start/stop 湲곕뒫??異붽??섏? ?딆뒿?덈떎.

吏??踰붿쐞:

- `today`
- `7d`
- `30d`

?곗씠??異쒖쿂:

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

二쇱슂 吏??

- Productivity: completed tasks, completed reviews, recorded decisions, recorded commands, sent daily reports, completed nightly reviews
- Quality: approval rate, approve/reject/stop count, Architect warning/blocked count
- Runtime: latest queue state, warning count, loop detected rate
- Knowledge: total nodes/edges, nodes/edges created in range, Obsidian exports, graph density
- Trends: daily reports, decisions, knowledge nodes, warnings

?곗씠?곌? 遺議깊븯嫄곕굹 ?대떦 source媛 ?놁쑝硫?媛믪쓣 議곗옉?섏? ?딄퀬 `insufficient data` ?먮뒗 `null` ?깃꺽??note濡??쒖떆?⑸땲?? KPI???꾩옱 洹쒖튃 湲곕컲 吏묎퀎?대ŉ LLM 遺꾩꽍?대굹 ?덉륫 紐⑤뜽? ?ы븿?섏? ?딆뒿?덈떎.

API:

```bash
GET /api/kpi/overview?range=today
GET /api/kpi/overview?range=7d
GET /api/kpi/overview?range=30d
```

## Knowledge Graph Visualization MVP

Knowledge Graph Visualization? Supabase??`knowledge_nodes`? `knowledge_edges`瑜?read-only濡??쒓컖?뷀빀?덈떎. Historian/Obsidian export, Daily/Nightly batch, Architect Review, Reviewer/Builder 寃곌낵媛 ?대뼡 愿怨꾨줈 ?곌껐?섎뒗吏 PM?????붾㈃?먯꽌 ?뺤씤?섍린 ?꾪븳 ?ы듃?대━???댁쁺 媛?쒗솕 湲곕뒫?낅땲??

?ы븿 湲곕뒫:

- Knowledge ??쓽 `Knowledge Graph` ?뱀뀡
- SVG/CSS 湲곕컲 寃쎈웾 洹몃옒??- node type / edge type / limit / text filter
- selected node detail panel
- edge list fallback
- 紐⑤컮?쇱뿉?쒕뒗 洹몃옒???곸뿭 horizontal scroll

Backend API:

```bash
GET /api/knowledge/graph?limit=100
```

?쒗븳:

- vector search ?놁쓬
- embeddings ?놁쓬
- graph database ?놁쓬
- Obsidian bidirectional sync ?놁쓬
- OpenAI/LLM reasoning ?놁쓬
- Codex/MCP/process ?쒖뼱 ?놁쓬
- Obsidian vault ?덈? 寃쎈줈? secret 媛??몄텧 ?놁쓬
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

## Supabase Keep-Alive Batch

ArchiveOS와 RH Healthcare Supabase 프로젝트가 free-tier inactivity pause에 걸리지 않도록 backend/local-worker 전용 keep-alive batch를 제공합니다.

```bash
cd backend
npm run batch:supabase-keepalive
```

동작:

- ArchiveOS Supabase는 `batch_runs`를 가볍게 조회합니다.
- RH Healthcare Supabase는 REST endpoint를 가볍게 조회합니다.
- 결과는 `batch_runs`에 `batch_type = supabase_keepalive`로 기록됩니다.
- service role, publishable key, webhook 값은 frontend에 노출하지 않습니다.

Backend env:

```env
RH_HEALTHCARE_SUPABASE_URL=
RH_HEALTHCARE_SUPABASE_PUBLISHABLE_KEY=
RH_HEALTHCARE_PAUSED_SUPABASE_URL=
RH_HEALTHCARE_PAUSED_SUPABASE_PUBLISHABLE_KEY=
```

권장 Windows Task Scheduler 실행 예:

```powershell
-NoProfile -ExecutionPolicy Bypass -Command "cd 'C:\Users\dan18\Documents\Codex\2026-05-20\create-a-new-project-named-archiveos\ArchiveOS\backend'; npm run batch:supabase-keepalive"
```

권장 주기: 매일 10:00 KST 1회.

로컬 실행 스크립트:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/run-supabase-keepalive.ps1"
```
