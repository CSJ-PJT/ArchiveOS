# Archive 1.0 RC 기준선

## 기준

- 기준 브랜치: 각 Runtime 저장소의 `main`
- 기준 시각: 2026-07-16 KST 병합 및 post-merge 검증 완료 시점
- 판정: **ARCHIVE 1.0 RC BASELINE: PASS**
- 의미: 이 문서는 검증된 RC 운영 기준선이다. 일반 공개 배포나 무중단 운영을 보장한다는 선언은 아니다.

| 저장소 | main HEAD | 마지막 main merge | 역할 |
|---|---:|---:|---|
| ArchiveOS | `2c744a6` | `2c744a6` (2026-07-16 15:15:45 KST) | Runtime ingest, timeline, AI/RAG, UI |
| Archive-Ledger | `789b224` | `789b224` (2026-07-16 15:20:41 KST) | 원장·정산과 runtime delivery |
| Archive-Logistics | `e80c61e` | `e80c61e` (2026-07-16 15:22:59 KST) | 물류 lifecycle·outbox·delivery |
| Archive-Nexus | `4838c62` | `4838c62` (2026-07-16 15:26:03 KST) | 서비스 간 routing·outbox·delivery |
| Archive-Market | `352bd17` | `352bd17` (2026-07-16 15:34:49 KST) | 주문·결제·outbox |

모든 위 local `main`은 검증 시점의 `origin/main`과 일치했다. 기존 feature branch는 감사 및 복구 추적을 위해 보존한다.

## 공식 Runtime 증거

- correlation: `CORR-a98d539e-8497-4d0a-9a41-49690c2bf0b0`
- 판정: `COMPLETE_CHAIN`
- source: 4, event: 35, ROOT_EVENT: 1
- external parent gap / invalid causation / duplicate eventId: 모두 0
- simulationRunId와 orderId의 distinct count: 각각 1

자세한 증거는 [E2E Evidence](ARCHIVE_1_0_E2E_EVIDENCE.md)를 따른다.

## 기준선 범위

이 기준선은 ArchiveOS, Market, Nexus, Logistics, Ledger의 Runtime만 다룬다. Archive-World는 별도 저장소·별도 브랜치이며 이 기준선의 병합·빌드·렌더링 범위가 아니다.
