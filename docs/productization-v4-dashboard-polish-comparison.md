# Dashboard Phase 1.2 visual polish

## 비교 기준

Phase 1.1의 승인된 구조(KPI 5개, 2행 6노드 메쉬, 실제 SSE 토큰, 최근 이벤트, 단일 상세 drawer)는 유지하고, 1440×900에서의 판독성과 첫 화면 완결성만 보정했다.

| 항목 | Pass 1 | Pass 2 / 최종 |
| --- | --- | --- |
| KPI | 값·보조 정보·추세의 위계를 확대 | 주요 값, 상태 배지, 실제 추세와 이동 링크의 간격을 분리 |
| 메쉬 | 노드와 연결선의 대비를 높임 | 활성 경로와 비활성 경로, 카운트와 토큰의 역할을 분리 |
| 최근 이벤트 | 기존 카드형 목록을 정렬된 행으로 전환 | 4개 실제 런타임 이벤트를 1440×900 첫 화면에 모두 노출 |
| 첫 화면 | 이벤트 영역의 행 높이를 점검 | 다음 섹션을 제거해 이벤트 카드 하단으로 명확히 마감 |
| 모바일 | 공통 반응형 규칙의 KPI 열 수 회귀 확인 | 2열 KPI와 전체폭 생태계 균형 카드로 복구, SVG 대신 기존 흐름 목록 유지 |

## 확인 결과

- 실제 Synthetic Runtime Data와 SSE 이벤트만 사용하며, 임의 KPI·추세·토큰은 추가하지 않았다.
- 1440×900에서 Header, 제목, KPI 5개, 2행 메쉬, 최근 이벤트 4건이 한 화면에 표시된다.
- 모바일은 가로 overflow 없이 2열 KPI, 흐름 목록, 최근 이벤트 순서를 유지한다.
- 상세 drawer는 선택 전 닫혀 있어 메쉬와 최근 이벤트를 가리지 않는다.

## 스크린샷

- `docs/screenshots/productization-v4-dashboard-polish/dashboard-before.png`
- `docs/screenshots/productization-v4-dashboard-polish/dashboard-pass1.png`
- `docs/screenshots/productization-v4-dashboard-polish/dashboard-pass2.png`
- `docs/screenshots/productization-v4-dashboard-polish/dashboard-final-1440.png`
- `docs/screenshots/productization-v4-dashboard-polish/dashboard-final-1920.png`
- `docs/screenshots/productization-v4-dashboard-polish/dashboard-final-768.png`
- `docs/screenshots/productization-v4-dashboard-polish/dashboard-final-390.png`
- `docs/screenshots/productization-v4-dashboard-polish/side-by-side-final.png`
