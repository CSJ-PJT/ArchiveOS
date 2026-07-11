# Console V3 정보 구조

| 기존 경로 | 새 핵심 화면 | 비고 |
| --- | --- | --- |
| overview, liveflow | dashboard | 운영 개요와 라이브 메쉬 통합 |
| ecosystem, managed, atlas | services | Atlas는 외부 연동 탭 |
| agents, workforce, workflows, batch, rpa | operations | 자동화는 하위 탭 |
| finance, approvals | finance | 승인·정산·대사 하위 탭 |
| knowledge, history | records | 이벤트·감사·지식 하위 탭 |
| mcp, settings | settings | MCP는 고급 도구 탭 |

기존 URL/해시의 식별자는 제거하지 않는다. 클라이언트는 기존 식별자를 적절한 핵심 화면으로 정규화한다.

PUBLIC은 6개 핵심 메뉴만 보며, 쓰기·고급 도구는 권한이 있을 때만 API 수준에서 허용한다.
