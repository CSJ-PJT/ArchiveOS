# ArchiveOS Productization V4 — Dashboard 비교 기록

## 기준 시안

이번 Dashboard 재구현의 기준은 사용자가 제공한 4분할 ArchiveOS 시안 중 좌측 상단 Dashboard입니다.

- 참조 위치: `C:\Users\dan18\Documents\ArchivePJT\.codex-remote-attachments\019f0919-8f68-7b11-a69c-620bc0f0886a\6911efd1-8213-465b-b785-07c1404ccfd7\1-Photo-1.jpg`
- 시안 숫자는 복사하지 않았으며, 화면 수치·상태·이벤트는 ArchiveOS가 수집한 Synthetic Runtime Data만 사용합니다.

## 시안 요구 요소와 구현

| 요구 요소 | 구현 결과 |
| --- | --- |
| 6개 메뉴와 좌측 고정 탐색 | 기존 Console V3 App Shell을 유지하고 Dashboard 정보 밀도에 맞춰 본문만 재구성 |
| 짧은 상단 헤더와 상태 컨트롤 | 페이지명, 연결 상태, 언어, 갱신 시각, 작은 새로고침 컨트롤을 유지 |
| KPI 5개 | 정상 서비스, 활성 이벤트, 승인 대기, 처리 적체, 생태계 균형을 동일 높이 카드로 배치 |
| 실제 추세 | 최근 30분의 실제 수집 이벤트를 5분 버킷으로 집계. 데이터가 없으면 그래프 대신 안내 문구 표시 |
| 메쉬형 흐름 | Market, Nexus, Logistics, Ledger, ArchiveOS, Settlement를 상·하단 2행 메쉬로 표시 |
| 실제 실시간 표현 | 저장된 recent/SSE runtime event만 토큰·경로 강조에 사용. 이벤트가 없으면 토큰을 만들지 않음 |
| 최근 이벤트 | 메쉬 바로 아래에 실제 최근 4건, source/target, eventType, entityId, correlationId 단축값, 상태 표시 |
| 상세 탐색 | 노드·경로·토큰 클릭 시 메쉬 위에 고정 상세 패널을 열어 캔버스 레이아웃을 밀지 않음 |
| 밝은 제품 테마 | 옅은 blue-gray 페이지 배경, white surface, 얇은 border와 절제된 상태 색상으로 통일 |

## Pass 1

- 산출물: `docs/screenshots/productization-v4-dashboard/dashboard-1440-pass1.png`
- 확인: Sidebar, 제목, KPI 5개, 메쉬와 최근 이벤트 스트립이 같은 1440×900 화면에 표시됨.
- 차이: ArchiveOS Control Tower 노드명이 잘렸고, 최근 이벤트 카드에 entity/correlation 정보가 노출되지 않았습니다.

## Pass 2

- 산출물: `docs/screenshots/productization-v4-dashboard/dashboard-1440-pass2.png`
- 수정: ArchiveOS Control Tower 노드명을 두 줄로 표시하고, 최근 이벤트 카드에 실제 entityId와 correlationId 단축값을 추가했습니다.
- 확인: 메쉬는 선형 흐름이 아닌 다중 edge 구조로 표시되며, 이벤트 없는 edge에는 임의 움직임이 없습니다.

## 최종 확인

| Viewport | 결과 | 증빙 |
| --- | --- | --- |
| 1440×900 | Header, KPI 5개, 메쉬 전체, 최근 이벤트 스트립이 별도 확대 없이 보임 | `dashboard-1440-final.png` |
| 1920×1080 | 메쉬 노드와 Settlement를 포함한 전체 Dashboard가 수평 overflow 없이 표시 | `dashboard-1920-final.png` |
| 768×1024 | 3열 KPI와 축소된 전체 메쉬를 유지 | `dashboard-768-final.png` |
| 390×844 | 2열 KPI와 서비스 흐름 요약으로 전환. 긴 동적 메쉬는 강제로 압축하지 않음 | `dashboard-390-final.png` |

## 남은 차이와 이유

- 시안의 sparkline은 일부 정적 예시를 포함하지만, 구현은 실제 최근 이벤트가 존재할 때만 표시합니다.
- 현재 런타임 표본에는 Ledger → ArchiveOS 승인 이벤트가 집중되어 있어 실제 활성 edge도 해당 흐름에 집중됩니다. 다른 경로의 임의 토큰이나 가짜 수치는 추가하지 않았습니다.
- 서비스별 capacity가 현재 runtime contract에 없으면 상세 패널은 `데이터 없음`으로 표시합니다. 0으로 대체하지 않습니다.
