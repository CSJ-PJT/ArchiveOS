# Portfolio Bullets

## ArchiveOS · Archive Platform Control Tower

Archive-Nexus, Archive-Logistics, Archive-Ledger를 외부 서비스로 연동해 제조 이벤트, 물류 비용, 금융 정산, 승인 흐름을 하나의 운영 콘솔과 API에서 관제하도록 확장했습니다. 각 서비스의 health/operations summary를 통합하고, Ledger 승인 요청에 대해 RAG 또는 fallback policy evidence를 생성하며, 승인/반려 결과를 callback outbox와 retry 구조로 Ledger에 전달하도록 구현했습니다. 외부 서비스 장애가 ArchiveOS 런타임으로 전파되지 않도록 HEALTHY/DEGRADED/UNAVAILABLE 상태를 분리했습니다.
