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

## Lane 기반 화면 구조

Live Flow 화면은 자유 배치 bubble graph가 아니라 운영 흐름을 따라 읽을 수 있는 lane 기반 보드로 표시한다.

| Lane | 서비스 | 역할 |
| --- | --- | --- |
| Demand / Order | Archive-Market | 주문, 결제, 매출, 반품, 클레임 이벤트 |
| Manufacturing | Archive-Nexus | 제조, 생산, 출하, 품질 이벤트 |
| Logistics | Archive-Logistics | 배송, 경로, ETA, 물류비, 지연 이벤트 |
| Finance / Ledger | Archive-Ledger | 거래, 원장, 정산, 대사, 승인 필요 거래 |
| Control / Approval | ArchiveOS | 승인 게이트, 정책 근거, callback, 감사 |
| Settlement | Settlement | 일일 정산 배치와 대사 결과 |

기본 흐름은 `Archive-Market -> Archive-Nexus -> Archive-Logistics -> Archive-Ledger -> Settlement`이며, 승인 흐름은 `Archive-Ledger -> ArchiveOS Approval Gate -> Archive-Ledger callback`으로 표시한다.

## Event Token

이벤트 token은 `ecosystem_flow_event`의 실제 저장 이벤트를 기반으로 표시한다. 프론트에서 랜덤 이벤트를 만들지 않는다.

| Token 계열 | 의미 |
| --- | --- |
| order | 주문, 결제, 매출 유입 |
| shipment / route | 배송, 경로, 지연 |
| factory | 제조, 품질, 정비 |
| transaction | 거래, 원장 |
| approval | 승인 요청, 승인/반려 |
| settlement | 정산 배치, 대사 |
| callback | Ledger callback |
| audit | 감사 로그 |

색상은 severity/status 기준으로 구분한다.

- normal: blue
- info: cyan
- warning: amber
- critical/failed: red
- completed/settled: green
- approval_required: purple

동일 edge에 이벤트가 많으면 token cluster count로 묶어 표시한다.

## Edge Legend

| Edge | 표현 |
| --- | --- |
| 주요 비즈니스 흐름 | solid blue |
| 정산/결제 흐름 | solid purple |
| 승인/callback 흐름 | dashed amber |
| 관제/read-only 흐름 | dotted cyan |

## Detail Panel

오른쪽 상세 패널은 raw JSON이 아니라 다음 구조로 표시한다.

1. Event: eventType, domain, source system, entityType, entityId, occurredAt
2. Correlation: correlationId, causationId, trace button
3. Business Context: orderId, shipmentId, transactionId, approvalRequestId, settlementCycleId
4. Operational Impact: 승인 필요, 지연, callback 실패, 적체, degraded system, workforce 영향
5. Metadata: 기본 접힘. secret/token/password/key로 보이는 값은 masking한다.

## Permission

- Public/Operator/PM: Live/Replay 조회 가능, 수동 refresh 비활성
- Admin: manual refresh 가능
- 외부 write는 Live Flow 수집 과정에서 호출하지 않는다.

## Security

- `POST /api/live-flow/refresh`는 Admin Guard를 통과해야 한다.
- metadata는 allowlist 기반으로 저장한다.
- audit metadata에 secret/token/webhook/password를 넣지 않는다.

## Future

- SSE 또는 WebSocket 기반 `/api/live-flow/stream`
- correlationId 기반 상세 chain view 강화
- 외부 서비스별 recent-events endpoint가 생기면 adapter 확장
