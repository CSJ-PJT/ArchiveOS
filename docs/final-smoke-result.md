## ArchiveOS Ecosystem Final Smoke Result (2026-07-09)

### 실행 일시
- 실행일시: 2026-07-09 (KST)
- 스크립트:
  - Read-only: `.\scripts\smoke-ecosystem.ps1`
  - Write smoke: `.\scripts\smoke-ecosystem.ps1 -WriteSmoke`
- 산출 로그:
  - `smoke-readonly-20260709_145207.log`
  - `smoke-write-20260709_145211.log`

### 사용 URL
- Nexus: `http://localhost:8080`
- Archive-Logistics: `http://localhost:8092`
- Archive-Ledger: `http://localhost:18080`
- ArchiveOS Frontend/API: `http://localhost:5173`

### Nexus 상태
- `GET /api/outbox/summary` → 200
- 주요 값: `total=440`, `pending=435`, `published=0`, `status: pending=435`
- 운영 지표: outbox 대상 `LOGITICS=187`, `LEDGER=241`

### Archive-Logistics 상태
- `GET /api/operations/summary` → 200
- 처리량: `received=100`, `processed=100`, `routePlans=100`, `outbox published=100`
- `GET /api/routes/summary` → **500** (JDBC type-binding 이슈)
  - 메시지: `could not determine data type of parameter $3`
  - 원인 후보: `createdAt` 필터 바인딩/SQL 타입 캐스팅 문제

### Archive-Ledger 상태
- `GET /api/operations/summary` → 200
- `status=HEALTHY`, `receivedEvents=108`, `transactions=108`, `approvalRequired=61`, `settled=41`
- `GET /api/reconciliation/summary` → 200 (`status=CRITICAL`, mismatch=102)
- `GET /api/transactions?status=APPROVAL_REQUIRED` → 200 (결과 존재)

### ArchiveOS 상태
- `GET /api/ecosystem/services` → 200
- `GET /api/ecosystem/summary` → 200
  - service state: Nexus=HEALTHY / Logistics=HEALTHY / Ledger=HEALTHY
  - overall status: HEALTHY
- `GET /api/ecosystem/topology` → 200
  - edges:  
    - `archive-nexus -> archive-logitics : shipment event`
    - `archive-logitics -> archive-ledger : logistics cost event`
    - `archive-ledger -> archive-os : approval request`
    - `archive-os -> archive-ledger : approval callback`
- `GET /api/integrations/ledger/approval-required` → 200
- `GET /api/integrations/logitics/routes` → 500 (Archive-Logistics routes endpoint 연동 실패와 동일)

### Write smoke 수행 결과
- 수행 여부: 수행 (`-WriteSmoke`)
- 핵심 동작:
  - `Nexus generate logistics (10)` / `Nexus publish logistics`
  - `Logistics outbox publish`
  - `Nexus generate ledger (10)` / `Nexus publish ledger`
  - `Nexus generate approval-risk (5)` / `Nexus publish approval-risk to ledger`
- 결과:
  - publish 처리 건수는 핵심적으로 `published=0` 또는 `status=SKIPPED`
  - `Nexus publish logistics` attempted=6, published=0, skipped=6
  - `Nexus publish ledger` attempted=44, published=0, skipped=44
  - `Nexus publish approval-risk` attempted=44, published=0, skipped=44
  - `Logistics outbox publish` 상태 `SKIPPED` (`No publishable outbox events.`)
- 판단:
  - 기존 환경 변수(`ARCHIVE_INTEGRATION_SAFE_MODE=true`, `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=false`) + 각 서비스 integration enabled=false에 의해 write가 제어됨
  - 기능이 막혀도 런타임 안정성은 유지됨

### Logs 정리
- Read-only summary: Total 19, Success 18, Fail/Blocked 1
- Write summary: Total 33, Success 32, Fail/Blocked 1
- 공통 Fail: `Logistics routes summary => 500`

### 남은 이슈
1. `Archive-Logistics routes summary` SQL 타입 바인딩 버그 (JDBC 파라미터 `$3` 타입 미추론)
2. write smoke에서 발행 건수가 `0` 또는 `SKIPPED`로 나오는 부분은 현재 safe-mode/allow-external-write=false 및 integration disabled 상태 의도 동작 검증 완료

### 다음 액션
1. Archive-Logistics routes summary SQL 파라미터 바인딩(타입 캐스팅) 수정
2. write smoke는 통합 환경에서 `ARCHIVE_INTEGRATION_ALLOW_EXTERNAL_WRITE=true` + 필요한 integration enabled=true 상태에서 재실행해 정상 publish 경로 확인
3. write 테스트용 이벤트 생성/발행이 필요한 경우 사전 스크립트/스냅샷 정리 명시
