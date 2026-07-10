# Live Flow / Operational Twin

ArchiveOS Live Flow는 Archive-Market, Archive-Logistics, Archive-Nexus, Archive-Ledger, ArchiveOS에서 실제로 관측한 runtime event, outbox, approval, health, callback 데이터를 하나의 운영 흐름으로 정규화해 보여주는 Control Tower 화면이다.

## 원칙

- Real runtime data 기반으로 표시한다.
- 비즈니스 값은 Synthetic Runtime Events / Demo Data만 사용한다.
- 실제 고객명, 전화번호, 주소, 카드번호, 계좌번호, 주민번호, 결제 토큰, secret, webhook, private key는 저장하거나 표시하지 않는다.
- 외부 서비스에는 read-only endpoint만 호출한다.
- 외부 서비스가 꺼져 있으면 `unavailable` flow event로 기록하고 ArchiveOS 런타임은 유지한다.
- Public은 read-only이고, manual refresh는 Admin만 가능하다.

## Architecture

```text
Archive-Market    -> Archive-Logistics -> Archive-Ledger -> ArchiveOS
Archive-Market    -> Archive-Ledger
Archive-Nexus     -> Archive-Ledger
ArchiveOS         -> ecosystem_flow_event
React Live Flow   -> /api/live-flow/*
```

## Event Collector

ArchiveOS의 Live Flow collector는 다음 source를 정규화한다.

- Ecosystem health/summary snapshot
- Archive-Market order/economy/outbox summary
- Archive-Logistics route/risk/outbox summary
- Archive-Nexus outbox summary
- Archive-Ledger approval/transaction summary
- ArchiveOS external approval queue
- ArchiveOS approval callback outbox

Collector는 POST publish/generate/run을 호출하지 않는다.

## API

- `GET /api/live-flow/summary`
- `GET /api/live-flow/topology`
- `GET /api/live-flow/events/recent?limit=100`
- `GET /api/live-flow/replay?from=&to=`
- `GET /api/live-flow/correlation/{correlationId}`
- `GET /api/live-flow/entity/{entityId}`
- `POST /api/live-flow/refresh` - Admin only

## UI Modes

- `LIVE`: 저장된 최신 runtime flow event를 3~5초 polling 주기로 표시한다.
- `REPLAY`: `ecosystem_flow_event`에 저장된 이벤트를 시간순으로 보여준다.
- `DEMO`: 프론트 랜덤 생성이 아니라 이미 저장된 synthetic event 또는 dry-run 결과만 사용한다.

## Security

- `POST /api/live-flow/refresh`는 Admin Guard를 통과해야 한다.
- metadata는 allowlist 기반으로 저장한다.
- audit metadata에 secret/token/webhook/password를 넣지 않는다.

## Future

- SSE 또는 WebSocket 기반 `/api/live-flow/stream`
- correlationId 기반 상세 chain view 강화
- 외부 서비스별 recent-events endpoint가 생기면 adapter 확장
