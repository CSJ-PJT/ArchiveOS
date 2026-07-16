# 교차 서비스 균형 조정 후속 작업

ArchiveOS는 분석과 권고만 담당한다. 다음 변경은 각 소유 저장소에서 별도 승인 후 수행해야 한다.

| 서비스 | 필요한 후속 작업 | 예시 명령 목적 |
| --- | --- | --- |
| Archive-Market | GMV·인식 매출·반품 준비금 계약 명확화 | Market economy summary 확인 |
| Archive-Nexus | 생산비·품질비·출하 비용 이벤트의 비용 귀속 확인 | outbox 및 cost event 검증 |
| Archive-Logistics | 배송 수수료·지연 비용·Ledger 비용 이벤트 계약 확인 | operations/outbox summary 검증 |
| Archive-Ledger | 수수료·정산·대사 지표와 처리량의 대응 확인 | settlement/reconciliation summary 검증 |

각 변경은 idempotencyKey, correlationId, causationId, hopCount/maxHop 보존과 safe-mode 검증을 전제로 한다.
