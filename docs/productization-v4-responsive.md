# ArchiveOS Productization V4 Responsive Checklist

| Viewport | 확인 기준 |
| --- | --- |
| 320×568, 360×800, 390×844, 412×915 | KPI 1~2열, 메쉬 가로 스크롤, 버튼·배지·로고 세로 줄바꿈 없음 |
| 768×1024, 1024×768 | Sidebar 축소, 서비스 카드 2열 이상, 표 스크롤 또는 카드 변환 |
| 1366×768, 1440×900, 1920×1080 | 메쉬 노드와 Settlement clipping 없음, KPI와 최근 이벤트 위계 유지 |

공통 기준:

- 수평 viewport overflow 0
- 한 글자 단위 세로 줄바꿈 0
- node/card/button/badge clipping 0
- URL·correlationId는 ellipsis 또는 안전한 줄바꿈
- 모바일 상세 정보는 캔버스를 덮지 않고 하단으로 이동
- focus ring, tab role, 메뉴 닫기 동작을 유지
