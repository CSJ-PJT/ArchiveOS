# Archive-Ledger Resume Bullets

## 현대오토에버 AX 백엔드용

- ArchiveOS와 Archive-Ledger를 분리 설계하여 제조/모빌리티 이벤트가 synthetic transaction event로 확장되는 승인 게이트웨이를 구현했다. ArchiveOS는 idempotency 기반 approval gate, policy evidence, PM decision, audit trail을 담당하고, settlement/reconciliation은 Ledger가 담당하도록 책임 경계를 명확히 분리했다.

## 뱅크샐러드류 데이터/금융 백엔드용

- synthetic transaction event 승인 요청에 대해 correlationId/transactionId 기반 idempotency를 적용하고, 고액·고위험 조건을 PM approval gate로 전환하는 백엔드 흐름을 설계했다. 실제 금융 데이터 없이 RAG/fallback policy evidence, audit log, callback 상태를 기록해 데이터 정합성과 운영 추적성을 확보했다.

## 현대카드류 금융/LLM 백엔드용

- Archive-Ledger 승인 요청을 ArchiveOS에서 수신해 policyQuestion 기반 RAG evidence를 시도하고, LLM/RAG가 unavailable일 때도 rule-based fallback evidence를 저장하도록 구현했다. ArchiveOS는 approval/audit/RAG evidence를 담당하고, Ledger는 settlement/reconciliation 및 원장 상태 전이를 담당하도록 금융성 백엔드 책임을 분리했다.
