# ArchiveOS Productization V4 Visual Comparison

## 시안 대비 반영 항목

| 시안의 구조 | V4 구현 |
| --- | --- |
| 밝은 운영 콘솔 | 라이트 기본 토큰과 밝은 카드·경계·상태 배지 |
| 5개 KPI | 정상 서비스, 활성 이벤트, 승인 대기, 처리 적체, 생태계 균형 |
| 메쉬형 관제 | 6개 노드와 다중 edge, 실제 SSE event token, edge cluster |
| 서비스 카드 | 주소·마지막 성공·수집 상태·운영 지표·오류 분리 |
| 운영 4개 탭 | 에이전트, 작업 역량, 작업 흐름, 자동화 유지 및 공통 카드 스타일 |
| 재무 표와 이슈 | 재무 KPI, 데이터 가용성, 서비스별 손익, 승인·정산, 대사 분리 |
| 하단 최근 이벤트 | 시간·경로·eventType·correlation·상태를 실제 runtime event로 표시 |

## 시안과 의도적으로 다른 항목

- 시안의 예시 숫자·sparkline·이벤트는 사용하지 않는다. ArchiveOS는 실제 Synthetic Runtime Data만 표시한다.
- 실제 직원, 고객, 결제, 계좌 등 개인 또는 실제 금융 정보는 보여 주지 않는다.
- 외부 시스템·Labs는 핵심 Archive 5개 서비스와 시각적으로 분리한다.
- 정산·승인 쓰기 작업은 safe-mode와 역할 검사를 유지한다.
