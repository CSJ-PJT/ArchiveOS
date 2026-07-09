# Portfolio Bullets

## ArchiveOS · Archive Platform Control Tower

Archive Platform Ecosystem은 Archive-Nexus, Archive-Logistics, Archive-Ledger, ArchiveOS를 연결해 제조 이벤트 생성, 물류 경로·비용 계산, 금융성 원장·정산·대사, 승인·정책 근거·장애 관제를 하나의 이벤트 드리븐 AX 백엔드 흐름으로 구현한 프로젝트입니다. 각 서비스는 Outbox, idempotency, retry, safe-mode, DEGRADED 상태 분리를 통해 외부 장애가 전체 런타임으로 전파되지 않도록 설계했습니다.

Archive-Nexus, Archive-Logistics, and Archive-Ledger are observed as external operating targets and orchestrated from ArchiveOS as a single control tower.  
ArchiveOS aggregates cross-system health/operations summaries, renders topology, and records Ledger-related external approvals with policy evidence (RAG or synthetic fallback), audit trails, and callback outbox/retry handling.

- Nexus manufacturing/event outbox, Logistics route/cost calculation, and Ledger transaction/settlement/reconciliation are observed without collapsing runtime ownership.
- Outbox-driven flow is maintained with idempotency, retry, and SAFE_MODE_BLOCKED guard behavior.
- Approval requirements are surfaced as PM-inbox items and can be acted on in ArchiveOS; callback retries are tracked with status transitions (`PENDING`/`RETRY`/`FAILED`/`SENT`).
- ArchiveOS isolates external failures using `HEALTHY`, `DEGRADED`, and `UNAVAILABLE` states so one service failure does not terminate the control plane.
