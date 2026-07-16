# ArchiveOS Productization V4 UI Audit

## 기준선

- 기준 브랜치: `refactor/archiveos-console-v3`
- V4 작업 브랜치: `feat/archiveos-productization-v4`
- 외부 서비스 수정 없이 ArchiveOS의 읽기 전용 관제 화면만 개선한다.
- 모든 수치와 상태는 저장된 Synthetic Runtime Data, 서비스 요약 또는 SSE 이벤트에서만 읽는다.

## V3에서 확인한 개선 대상

| 영역 | 확인 내용 | V4 반영 |
| --- | --- | --- |
| 테마 | 다크 기반과 라이트 카드가 섞여 있음 | 라이트를 저장값이 없을 때의 기본값으로 설정하고 토큰을 통일 |
| 대시보드 | KPI, 메쉬, 우선 조치가 서로 분리되어 있음 | 5개 KPI, 전폭 메쉬, 최근 이벤트·우선 조치·핵심 상태 구조로 정리 |
| 메쉬 | 이벤트가 경로 의미 없이 보이고 캔버스가 어두움 | 실제 eventId 기반 1회 token 이동, edge count, cluster, 상태 상세를 표시 |
| 서비스 | URL·수집 상태·오류·운영 지표의 위계가 약함 | 연결 정보와 핵심 지표를 서비스 카드 안에서 분리 |
| 재무 | `NO_DATA`와 0, 부분 수집의 의미가 흐림 | PARTIAL_DATA 안내와 데이터 가용성, 계산 범위를 명시 |
| 반응형 | 작은 화면에서 카드·메쉬·상세 정보가 과밀해질 수 있음 | 모바일 2열 KPI, 메쉬 가로 스크롤, 상세 하단 배치를 적용 |

## 사실성 원칙

- SSE가 연결된 동안 recent-event polling을 실행하지 않는다.
- SSE 오류일 때만 fallback polling을 사용한다.
- 새 이벤트가 없으면 token을 만들지 않는다.
- 재무·workforce·서비스 capability가 없으면 0이 아니라 `데이터 없음` 또는 `부분 수집`으로 표시한다.
- 실제 고객, 결제, 계좌, 주소, 개인정보를 화면·로그·스크린샷에 사용하지 않는다.
