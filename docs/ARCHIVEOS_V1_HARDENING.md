# ArchiveOS v1.0 Hardening / ngrok Runtime Sync

ArchiveOS UI는 read-only 운영 가시화 도구입니다. OpenAI API, MCP 실행, Codex 직접 제어, 임의 shell 실행, GitHub write action, Obsidian 양방향 동기화는 포함하지 않습니다.

## 화면 책임

- Dashboard: 5초 안에 보는 PM 운영 요약
- Decisions: 승인/반려 및 의사결정 기록
- Operators: Implementer, Reviewer, Architect, Historian, MCP Loop, Reviewer Bridge 상세 상태
- Timeline: Runtime, Batch, Architect, Knowledge 이벤트 이력
- GitHub: 향후 GitHub 연동 상태와 placeholder
- Knowledge: Historian, Obsidian Export, Knowledge Graph, Related Context
- Mesh: Agent 관계와 최근 상호작용
- KPI: 생산성, 품질, 런타임, 지식 축적 지표
- Settings: URL, endpoint health, remote access, Supabase, Discord, Obsidian 설정 상태

## Endpoint Health

Backend는 다음 read-only 상태 API를 제공합니다.

```bash
GET /api/health
GET /api/health/endpoints
GET /api/platform/readiness
GET /api/runtime/public-access
```

Dashboard는 요약만 보여주고, Settings의 `Endpoint Health Matrix`에서 전체 endpoint 상태를 확인합니다. 오래된 backend process가 떠 있으면 `/api/health/endpoints`가 404가 될 수 있으므로 backend를 최신 main으로 재시작해야 합니다.

## ngrok 권장 개발 흐름

1. 최신 main에서 backend를 실행합니다.
2. 최신 main에서 frontend를 실행합니다.
3. backend port 4000용 ngrok URL을 만듭니다.
4. frontend port 5173용 ngrok URL을 만듭니다.
5. frontend `.env`에 설정합니다.

```bash
VITE_BACKEND_URL=https://your-backend-ngrok-url
VITE_REMOTE_FRONTEND_URL=https://your-frontend-ngrok-url
VITE_REMOTE_BACKEND_URL=https://your-backend-ngrok-url
```

6. backend `.env`에 설정합니다.

```bash
CORS_ALLOWED_ORIGINS=https://your-frontend-ngrok-url
ARCHIVEOS_PUBLIC_URL=https://your-frontend-ngrok-url
ARCHIVEOS_BACKEND_PUBLIC_URL=https://your-backend-ngrok-url
```

7. `.env` 변경 후 frontend를 재시작합니다.
8. Settings > Remote Access에서 frontend/backend public URL 설정 여부를 확인합니다.
9. Settings > Endpoint Health Matrix가 모두 `ok`인지 확인합니다.

설정 점검만 하려면:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools/runtime/check-ngrok-sync.ps1"
```

이 스크립트는 프로세스를 시작하거나 종료하지 않습니다. 현재 `.env`와 `backend/.env`의 URL 설정만 읽고 경고를 출력합니다.
