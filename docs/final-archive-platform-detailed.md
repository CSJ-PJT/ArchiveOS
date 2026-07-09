# Archive Platform Ecosystem 통합 최종본 상세

## 1. 전체 아키텍처

Archive-Nexus
  - 제조/출하 이벤트 생성
  - Outbox 저장
  - Logistics 이벤트 → Archive-Logistics
  - 비용/정산성 이벤트 → Archive-Ledger

Archive-Logistics
  - route / ETA / cost 계산
  - Outbox 저장
  - Logistics cost event → Archive-Ledger

Archive-Ledger
  - transaction 생성
  - debit / credit ledger entry 생성
  - settlement
  - reconciliation
  - approval callback 처리

ArchiveOS
  - ecosystem summary
  - topology
  - approval gateway
  - policy evidence
  - callback outbox
  - audit / safe-mode / degraded status

## 2. ArchiveOS 상세

- 저장소: https://github.com/CSJ-PJT/ArchiveOS
- 역할: Archive Platform Ecosystem Control Tower
- UI: React/TypeScript
- API: Spring Boot 중심 운영 API
- Compatibility: Node Compatibility Layer 유지
- AI/RAG: Spring AI/RAG/Fallback Evidence
- Registry: External System Registry
- Health / Summary / Topology: 외부 시스템 상태 통합 관제
- Approval Gateway: 외부 승인 요청 수신, 승인/반려/보류 처리
- Policy Evidence: RAG 가능 시 근거 chunk 저장, 불가 시 rule-based fallback 저장
- Callback Outbox: Ledger callback 전송 상태 및 재시도 관리
- Safe-mode: 기본 external write 차단
- DEGRADED/UNAVAILABLE: 외부 장애를 ArchiveOS 런타임 장애와 분리
- No secret leakage: token, webhook, private key, secret 값 미노출
- Audit-first: 운영자 행위와 상태 변경을 감사 로그로 기록

### 주요 API
- /api/ecosystem/*
- /api/integrations/*
- /api/approvals/external/*
- /api/approvals/callbacks/*

### Smoke 결과
- ecosystem summary / topology 확인
- safe-mode 차단 확인
- 테스트/빌드 통과

### 산출물 파일
- 01-ArchiveOS-ControlTower-요약.pdf
- 01-ArchiveOS-ControlTower-상세.pdf

### 포트폴리오 문구
ArchiveOS는 Archive-Nexus, Archive-Logistics, Archive-Ledger를 외부 운영 대상 시스템으로 관제하며 승인 게이트웨이, 정책 근거, callback outbox, audit log, safe-mode를 통합한 Control Tower입니다.

## 3. Archive-Nexus 상세

- 저장소: https://github.com/CSJ-PJT/Archive-Nexus
- 역할: 제조·출하 이벤트 생성 및 Outbox 라우팅

### 주요 API
- GET /api/outbox/summary
- GET /api/integrations/summary
- POST /api/outbox/events/generate
- POST /api/outbox/events/publish

### 핵심 설계
- Outbox routing policy
- Logistics 대상 이벤트 분기
- Ledger 대상 이벤트 분기
- NONE/SKIPPED 이벤트 분리
- dry-run 지원
- retry / last_error 기반 실패 추적
- disabled 상태 장애 격리
- ArchiveOS가 읽을 수 있는 summary API 제공

### Smoke 결과
- routing dry-run 확인
- outbox summary 확인
- test / bootJar / compose config 통과

### 산출물 파일
- 02-Archive-Nexus-ManufacturingAX-요약.pdf
- 02-Archive-Nexus-ManufacturingAX-상세.pdf

### 포트폴리오 문구
Archive-Nexus는 제조·출하 이벤트를 synthetic domain event로 생성하고, eventType 기반 Outbox routing을 통해 Logistics와 Ledger 대상으로 분기하는 Manufacturing AX 도메인 시스템입니다.

## 4. Archive-Logistics 상세

- 저장소: https://github.com/CSJ-PJT/Archive-Logistics
- 역할: Nexus 물류 이벤트 수신, route/ETA/cost 계산, Ledger 비용 이벤트 발행

### 주요 API
- GET /actuator/health
- GET /api/operations/summary
- POST /api/events/nexus
- POST /api/events/nexus/bulk
- GET /api/routes/summary
- GET /api/routes/plans
- GET /api/outbox/summary
- POST /api/outbox/publish

### 핵심 설계
- Synthetic Data 원칙
- Distance Matrix / deterministic calculator
- route / ETA / cost / riskScore 계산
- approvalRequired 판단
- PostgreSQL Outbox
- Spring Batch Publisher
- Ledger disabled 시 DRY_RUN/SKIPPED

### /api/routes/summary 500 원인과 해결
- 원인: JPQL null parameter / PostgreSQL JDBC type inference
- 조치: 조건 분기형 Repository/Service 로직
- 결과: 기본/factoryId/date/factoryId+date 모두 HTTP 200

### Smoke 결과
- health UP
- operations summary HEALTHY
- /api/routes/summary 200
- simulation 성공
- outbox 정상
- test / build / compose config 통과

### 산출물 파일
- 03-Archive-Logistics-LogisticsBackend-요약.pdf
- 03-Archive-Logistics-LogisticsBackend-상세.pdf

### 포트폴리오 문구
Archive-Logistics는 Archive-Nexus 물류 이벤트를 받아 synthetic route, ETA, 운송비, 지연·우회 비용을 계산하고, Outbox와 Spring Batch Publisher로 Archive-Ledger에 비용 확정 이벤트를 안정적으로 발행하는 물류 백엔드입니다.

## 5. Archive-Ledger 상세

- 저장소: https://github.com/CSJ-PJT/Archive-Ledger
- 역할: 거래 정규화, 복식 원장, 정산, 대사, 승인 callback 처리

### 주요 API
- GET /actuator/health
- GET /api/operations/summary
- POST /api/events/nexus
- POST /api/events/nexus/bulk
- POST /api/events/logistics
- POST /api/events/logistics/bulk
- GET /api/events/received
- GET /api/transactions
- GET /api/transactions?status=APPROVAL_REQUIRED
- GET /api/ledger/entries
- GET /api/ledger/summary
- POST /api/settlements/daily/run
- POST /api/reconciliation/daily
- GET /api/reconciliation/summary
- POST /api/approvals/callback

### 핵심 설계
- Nexus direct event 처리
- Logistics native event 처리
- /api/events/logistics/bulk 지원
- eventType → transactionType 매핑
- debit / credit account 매핑
- idempotency / duplicate 처리
- approvalRequired 판단
- settlement exclusion
- ArchiveOS approval integration

### Reconciliation 계산 보정
- expectedTransactionCount = received - duplicate
- mismatch = expectedTransactionCount - created - failed
- 확인 결과: mismatch=0, status=OK

### Smoke 결과
- health UP
- logistics native event smoke 성공
- duplicate safe 처리
- reconciliation mismatch=0, status=OK
- test / bootJar / compose config 통과

### 산출물 파일
- 04-Archive-Ledger-FinancialLedger-요약.pdf
- 04-Archive-Ledger-FinancialLedger-상세.pdf

### 포트폴리오 문구
Archive-Ledger는 Nexus direct 비용 이벤트와 Logistics 물류비 확정 이벤트를 금융성 synthetic transaction으로 정규화하고, 복식 원장, 정산, 대사, 승인 callback을 처리하는 Java/Spring 기반 Ledger 백엔드입니다.

## 6. End-to-End 흐름

### 시나리오 1: Nexus → Logistics → Ledger → ArchiveOS
1. Nexus가 logistics event 생성
2. Logistics가 route/ETA/cost 계산
3. Logistics가 Ledger로 logistics cost event 발행
4. Ledger가 transaction/ledger entry 생성
5. ArchiveOS가 summary/topology/approval 상태 관제

### 시나리오 2: Nexus → Ledger → ArchiveOS
1. Nexus가 비용/정산성 이벤트 생성
2. Ledger가 direct event를 transaction으로 정규화
3. 승인 필요 거래는 APPROVAL_REQUIRED로 분류
4. ArchiveOS가 approval queue와 policy evidence를 관리

### 시나리오 3: Ledger → ArchiveOS Approval → Ledger Callback
1. Ledger가 승인 필요 요청을 ArchiveOS로 전달
2. ArchiveOS가 RAG 또는 fallback evidence 생성
3. PM/Admin이 승인 또는 반려
4. ArchiveOS가 callback outbox를 통해 Ledger callback 수행
5. Ledger가 거래 상태를 반영

## 7. 검증 매트릭스

| 영역 | 검증 항목 | 결과 | 증빙 파일 | 비고 |
| --- | --- | --- | --- | --- |
| ArchiveOS | ecosystem summary / topology | 통과 | 01-ArchiveOS-ControlTower-상세.pdf | safe-mode 확인 |
| ArchiveOS | test / build / compose config | 통과 | docs/final-submission-package.md | Node/Spring 포함 |
| Archive-Nexus | routing dry-run / outbox summary | 통과 | 02-Archive-Nexus-ManufacturingAX-상세.pdf | disabled 격리 |
| Archive-Logistics | /api/routes/summary | 통과 | 03-Archive-Logistics-LogisticsBackend-상세.pdf | 500 해결 완료 |
| Archive-Logistics | outbox / batch / compose | 통과 | 03-Archive-Logistics-LogisticsBackend-요약.pdf | Ledger disabled 격리 |
| Archive-Ledger | logistics native event | 통과 | 04-Archive-Ledger-FinancialLedger-상세.pdf | bulk endpoint 포함 |
| Archive-Ledger | reconciliation mismatch | 통과 | 04-Archive-Ledger-FinancialLedger-상세.pdf | mismatch=0, OK |

## 8. 리스크와 남은 액션
- integration disabled 상태에서는 publish가 SKIPPED 가능
- safe-mode 기본값에서는 external write 차단
- 운영 데모 시 integration enabled와 allow-external-write 설정 필요
- Archive-Logitics/logitics 내부 호환 표기는 기존 이벤트/설정 호환성을 위해 일부 유지 가능
- 실제 클라우드 배포는 별도 단계
