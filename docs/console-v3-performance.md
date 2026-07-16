# Console V3 성능 기준

| 기준 | 구현 방식 |
| --- | --- |
| 초기 대시보드 요청 | auth, ecosystem, live summary, topology, recent events, balance summary의 6개 |
| 전역 새로고침 | 제거. 화면 전환 시 해당 화면 데이터만 요청 |
| 실시간 이벤트 | SSE 연결 중 폴링 0회 |
| SSE 실패 | 최근 이벤트만 1초 폴백, 연결 재개 시 중단 |
| 토큰 수 | 최근 30개, 나머지는 `+N` 클러스터 |
| 레이아웃 | 고정 최소 폭 캔버스 + 모바일 가로 스크롤, uncontrolled horizontal scroll 없음 |

로컬 측정은 실행 환경과 서비스 기동 상태에 따라 달라진다. 최종 측정값은 A-Z smoke와 브라우저 네트워크 패널에서 기록한다.
