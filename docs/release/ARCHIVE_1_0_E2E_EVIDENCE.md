# Archive 1.0 RC E2E 증거

## 공식 read-only 재조회 기준

| 항목 | 값 |
|---|---|
| correlationId | `CORR-a98d539e-8497-4d0a-9a41-49690c2bf0b0` |
| simulationRunId | `SIM-f43c9ce6-eef0-4eae-98e6-3b143ccecc0d` |
| orderId | `ORD-38623089-57d5-40d6-b557-d11e4ffaa6b5` |
| chain | `COMPLETE_CHAIN` |
| source | 4 |
| event | 35 |
| ROOT_EVENT | 1 |
| EXTERNAL_PARENT_NOT_INGESTED | 0 |
| INVALID_CAUSATION | 0 |
| duplicate eventId | 0 |
| simulationRunId/orderId distinct | 각각 1 |
| background count 증가 | 60초 관찰에서 0 |

## Timeline 재조회

`GET /api/correlation-timeline/{correlationId}`는 인증된 read-only 운영 요청으로 사용한다. 응답에서 `lineage.chainStatus`, `observedServices`, `events`, causation 상태와 eventId 중복을 확인한다. 새 주문이나 새 이벤트를 생성하지 않는다.

## 해석

이 증거는 위 correlation의 Runtime lineage 완결성을 보여 준다. 일반적인 부하, 외부 장애, 모든 historical backlog의 정확성을 보증하는 결과는 아니다.
