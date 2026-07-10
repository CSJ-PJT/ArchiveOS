# Portfolio Bullets - Live Flow / Operational Twin

- ArchiveOS에 Live Flow / Operational Twin을 구현해 Archive-Market, Archive-Nexus, Archive-Logistics, Archive-Ledger, ArchiveOS의 runtime event, outbox, approval, health, callback 상태를 하나의 운영 흐름으로 시각화했습니다.
- 프론트에서 랜덤으로 생성한 애니메이션이 아니라 Spring/PostgreSQL에 저장된 `ecosystem_flow_event`를 기반으로 LIVE/REPLAY 화면을 구성했습니다.
- `correlationId`, `entityId`, `eventType`, `sourceSystemId`, `status`, `severity`를 공통 모델로 정규화해 주문, 출하, 제조, 거래, 승인, 정산, callback 흐름을 추적할 수 있게 했습니다.
- Public/Admin 권한을 분리해 Public은 read-only 관제만 가능하고, Admin만 manual refresh를 수행하도록 구성했습니다.
- 실제 개인정보/금융정보/결제정보를 사용하지 않고 Synthetic Runtime Events만 허용하는 metadata allowlist를 적용했습니다.
