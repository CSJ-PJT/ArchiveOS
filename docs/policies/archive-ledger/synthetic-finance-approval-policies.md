# Archive-Ledger Synthetic Finance Approval Policies

이 문서는 실제 금융 약관이 아니라 Archive Suite 포트폴리오 검증용 synthetic policy 문서다.
실사용자 금융 데이터, 실제 카드번호, 실제 계좌번호, 개인식별정보를 포함하지 않는다.

## 제조 운영비 승인 정책

- synthetic 제조 운영비가 3,000,000 KRW 이상이면 Human PM approval 대상이다.
- severity가 `HIGH` 또는 `CRITICAL`이면 금액과 무관하게 승인 대상이다.
- `vendorRisk`가 `WARNING` 또는 `BLOCKED`이면 정산 전 재검토한다.

## 고액 정비비 승인 기준

- 설비 정비비가 3,000,000 KRW 이상이면 운영 책임자와 재무 승인자가 모두 검토해야 한다.
- 배터리 모듈, 전장 검사 장비처럼 생산 품질과 직결되는 설비는 `HIGH` severity로 분류할 수 있다.
- RAG/LLM이 unavailable이어도 이 rule fallback으로 승인 근거를 남긴다.

## 긴급 구매 처리 규칙

- `EMERGENCY_PURCHASE_REQUESTED` 이벤트는 기본적으로 approval required다.
- 긴급 구매는 생산 중단을 줄이기 위한 예외 지출이지만, 사후 정산과 audit log가 필요하다.

## 협력사 지급 보류 조건

- vendor risk가 `WARNING`이면 지급 전 evidence 검토가 필요하다.
- vendor risk가 `BLOCKED`이면 정산 batch에서 제외하고 별도 승인 또는 반려 처리한다.

## 품질 불량 비용 배분 규칙

- `QUALITY_DEFECT_DETECTED`와 `QUALITY_CLAIM_CHARGED`는 품질 손실 또는 chargeback 후보로 처리한다.
- 품질 비용은 생산, 정비, 협력사 원인 분석과 연결해 audit evidence를 보존한다.

## 출하 보류 비용 처리 정책

- `SHIPMENT_HOLD_CREATED`는 매출 인식 지연과 물류 비용 증가로 이어질 수 있다.
- 출하 보류 비용은 정산 전 reconciliation에서 별도 카운트한다.

## 법인카드성 지출 한도 정책

- 실제 법인카드 번호는 저장하지 않고 `corporateCardToken` 같은 synthetic token만 사용한다.
- `CORPORATE_CARD_USED` 금액이 3,000,000 KRW 이상이면 승인 대상이다.
