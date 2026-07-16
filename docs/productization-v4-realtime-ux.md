# ArchiveOS Productization V4 Realtime UX

## Live Mesh

메쉬는 Archive-Market, Archive-Nexus, Archive-Logistics, Archive-Ledger, ArchiveOS, Settlement의 다중 경로를 SVG 좌표로 표시한다. 작은 화면에서는 가로 스크롤을 사용하여 노드를 억지로 축소하지 않는다.

## 실제 이벤트만 사용

최근 SSE/runtime event의 `eventId`, `from_node`, `to_node`, `status`, `severity`를 사용한다.

1. 이벤트가 수신되면 source node와 해당 edge를 강조한다.
2. 동일 `eventId`는 bounded cache로 중복을 막는다.
3. token은 실제 이벤트 한 건에 대해 source에서 target으로 한 번만 이동한다.
4. 많은 이벤트는 edge별 `+N` cluster로 묶는다.
5. 이벤트가 없으면 `최근 이벤트 없음`을 표시한다.

## 연결 상태

- SSE 연결: `실시간 연결`과 UI 수신 지연 시간을 표시한다.
- 재연결: exponential backoff와 fallback polling을 사용한다.
- 정상 SSE 연결: recent-event polling 0회가 원칙이다.
- 요약의 latest event가 오래되면 runtime 상태가 `SLOW`, `STALE`, `NO_RUNTIME_EVENTS`로 분리된다.

Live Flow replay API는 기존 계약 호환성을 위해 유지하지만 일반 운영 화면에서는 노출하지 않는다.
