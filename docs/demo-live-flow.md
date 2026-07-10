# 실시간 관제 Demo

## 실행 전제

1. ArchiveOS를 실행한다.
2. 가능한 경우 Archive-Market, Archive-Nexus, Archive-Logistics, Archive-Ledger를 함께 실행한다.
3. ArchiveOS frontend/API proxy 기본 주소는 `http://localhost:5173`이다.

외부 서비스가 일부 꺼져 있어도 실시간 관제 화면은 실패하지 않고 해당 노드를 `DEGRADED` 또는 `UNAVAILABLE` 상태로 표시해야 한다.

## 기본 API 확인

```powershell
curl.exe http://localhost:5173/api/live-flow/summary
curl.exe http://localhost:5173/api/live-flow/topology
curl.exe http://localhost:5173/api/live-flow/events/recent
curl.exe http://localhost:5173/api/live-flow/replay
```

Admin 세션에서는 manual refresh를 실행할 수 있다.

```powershell
curl.exe -X POST http://localhost:5173/api/live-flow/refresh
```

Public mode에서는 refresh가 차단되어야 한다.

## 화면 시연 순서

1. ArchiveOS UI에서 `실시간 관제` 메뉴를 연다.
2. 상단에서 실시간/재생/데모 모드, 합성 이벤트 배지, safe-mode 안내 문구를 확인한다.
3. Summary Cards에서 active flows, recent events, pending approvals, delayed shipments, failed callbacks, degraded systems를 확인한다.
4. 중앙 lane board에서 다음 흐름을 확인한다.
   - Archive-Market -> Archive-Nexus
   - Archive-Nexus -> Archive-Logistics
   - Archive-Logistics -> Archive-Ledger
   - Archive-Ledger -> Settlement
   - Archive-Ledger -> ArchiveOS Approval Gate -> Archive-Ledger
5. 이벤트 토큰을 클릭해 오른쪽 Detail Panel을 확인한다.
6. Detail Panel에서 event type, domain, source system, entity id, correlationId, business context, operational impact를 확인한다.
7. correlationId가 있는 이벤트는 Trace correlation 버튼으로 동일 흐름의 이벤트를 추적한다.
8. 하단 Replay Bar에서 domain, severity, correlationId 필터를 적용한다.

## Market review event 연동 확인

Archive-Market이 다음 eventType을 ArchiveOS로 전달하면 External Approval Queue와 실시간 관제 화면에 반영될 수 있다.

- `ORDER_REQUIRES_REVIEW`
- `LOW_MARGIN_ORDER_DETECTED`
- `HIGH_RISK_ORDER_DETECTED`

```powershell
$payload = @{
  eventType = "HIGH_RISK_ORDER_DETECTED"
  eventId = "MKT-EVT-DEMO-001"
  orderId = "ORD-SYN-DEMO-001"
  correlationId = "corr-demo-001"
  amount = 4800000
  currency = "KRW"
  metadata = @{ syntheticData = $true; riskLevel = "HIGH" }
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:5173/api/integrations/market/events/review" -ContentType "application/json" -Body $payload
```

그 다음 실시간 관제 refresh를 수행하면 approval token이 `Archive-Market / Archive-Ledger -> ArchiveOS` 승인 흐름에 표시된다.

## Degraded 상태 설명

- 외부 서비스가 꺼져 있으면 해당 service card만 `UNAVAILABLE` 또는 `DEGRADED`로 표시한다.
- Collector 실패는 전체 실시간 관제 화면 장애로 전파하지 않는다.
- 실패 원인은 Detail Panel 또는 warning 영역에서 확인한다.

## 주의

- 실제 고객, 결제, 계좌, 금융 데이터는 사용하지 않는다.
- Demo mode도 프론트에서 임의로 만든 random fake animation이 아니라 저장된 synthetic runtime event 또는 dry-run event를 재생한다.
- 외부 write는 safe-mode와 Admin approval 정책을 따른다.
- secret, token, webhook, password, private key 값은 화면과 audit metadata에 노출하지 않는다.
