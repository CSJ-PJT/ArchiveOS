# Live Flow Demo

## 실행 전제

1. ArchiveOS 실행
2. Archive-Market, Archive-Nexus, Archive-Logistics, Archive-Ledger 중 가능한 서비스 실행
3. ArchiveOS frontend: `http://localhost:5173`

## 확인 절차

```powershell
curl.exe http://localhost:5173/api/live-flow/summary
curl.exe http://localhost:5173/api/live-flow/topology
curl.exe http://localhost:5173/api/live-flow/events/recent
```

Admin 세션에서는 manual refresh를 실행할 수 있다.

```powershell
curl.exe -X POST http://localhost:5173/api/live-flow/refresh
```

Public mode에서는 refresh가 차단되어야 한다.

## Market review event 연동 확인

Archive-Market이 다음 eventType을 ArchiveOS로 전달하면 External Approval Queue에 들어간다.

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

그 다음 Live Flow refresh를 수행하면 approval token이 `Ledger/Market -> ArchiveOS` 흐름에 표시된다.

## 주의

- 실제 고객/결제/계좌/금융 데이터는 사용하지 않는다.
- demo mode도 프론트 랜덤 데이터가 아니라 저장된 synthetic runtime event를 사용한다.
- 외부 write는 safe-mode와 Admin approval 정책을 따른다.
